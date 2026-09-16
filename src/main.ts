import { loadRuntimeConfig } from './config/environment.js';
import { createDatabase } from './db/database.js';
import { ensureCurrentInstallation } from './db/installation-repository.js';
import { GroupRepository } from './db/group-repository.js';
import { UpdateInboxRepository } from './db/update-inbox-repository.js';
import {
  groupAdministratorCommandMenu,
  groupCommandMenu,
  localizedCommandMenus,
  privateCommandMenu,
} from './telegram/commands.js';
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

/** Validates configuration, initializes PostgreSQL state, and starts the Telegram poller. */
async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const database = createDatabase(config.databaseUrl);
  database.pool.on('error', (error: Error) => {
    writeLog('error', 'database_idle_connection_failed', {
      errorType: error.name,
    });
  });

  try {
    await database.pool.query('SELECT 1');
    const installationId = await ensureCurrentInstallation(database.db);
    const bot = createBot(config.telegramBotToken, {
      installationId,
      groups: new GroupRepository(database.db),
      inbox: new UpdateInboxRepository(database.db),
    });

    bot.catch(({ ctx, error }) => {
      writeLog('error', 'telegram_update_failed', {
        updateId: ctx.update.update_id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });

    await bot.api.setMyCommands(privateCommandMenu, {
      scope: { type: 'all_private_chats' },
    });
    await bot.api.setMyCommands(groupCommandMenu, {
      scope: { type: 'all_group_chats' },
    });
    await bot.api.setMyCommands(groupAdministratorCommandMenu, {
      scope: { type: 'all_chat_administrators' },
    });
    for (const menu of localizedCommandMenus) {
      await bot.api.setMyCommands(menu.privateCommands, {
        scope: { type: 'all_private_chats' },
        language_code: menu.languageCode,
      });
      await bot.api.setMyCommands(menu.groupCommands, {
        scope: { type: 'all_group_chats' },
        language_code: menu.languageCode,
      });
      await bot.api.setMyCommands(menu.groupAdministratorCommands, {
        scope: { type: 'all_chat_administrators' },
        language_code: menu.languageCode,
      });
    }

    await bot.start({
      allowed_updates: ['message', 'my_chat_member'],
      onStart: (botInfo) => {
        writeLog('info', 'telegram_bot_started', { botId: botInfo.id });
      },
    });
  } finally {
    await database.pool.end();
  }
}

void main().catch((error: unknown) => {
  writeLog('error', 'telegram_bot_start_failed', {
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  process.exitCode = 1;
});
