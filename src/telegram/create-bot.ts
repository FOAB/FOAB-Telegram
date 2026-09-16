import { Bot, type Context } from 'grammy';

const START_MESSAGE =
  'FOAB is online. Group administration features are being implemented.';

/**
 * Creates the grammY bot and registers the first public, non-mutating command.
 *
 * This bootstrap intentionally performs no moderation, database access, or cross-group
 * lookup. Feature handlers will be added only with their authorization and data contracts.
 *
 * @param token - Telegram bot token read from validated runtime configuration.
 * @returns A configured bot instance that has not started polling yet.
 */
export function createBot(token: string): Bot<Context> {
  const bot = new Bot(token);

  bot.command('start', async (context) => {
    await context.reply(START_MESSAGE);
  });

  return bot;
}
