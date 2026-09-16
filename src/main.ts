import { loadRuntimeConfig } from './config/environment.js';
import { createBot } from './telegram/create-bot.js';

interface SafeLogFields {
  readonly botId?: number;
  readonly updateId?: number;
  readonly errorType?: string;
}

/** Writes a single structured event using an explicit, non-sensitive field allowlist. */
function writeLog(
  level: 'info' | 'error',
  event: string,
  fields: SafeLogFields = {},
): void {
  const record = { timestamp: new Date().toISOString(), level, event, ...fields };
  const output = `${JSON.stringify(record)}\n`;

  if (level === 'error') {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
}

/** Starts long polling and installs update-error handling without logging raw updates. */
async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const bot = createBot(config.telegramBotToken);

  bot.catch(({ ctx, error }) => {
    writeLog('error', 'telegram_update_failed', {
      updateId: ctx.update.update_id,
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
  });

  await bot.start({
    onStart: (botInfo) => {
      writeLog('info', 'telegram_bot_started', { botId: botInfo.id });
    },
  });
}

void main().catch((error: unknown) => {
  writeLog('error', 'telegram_bot_start_failed', {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
