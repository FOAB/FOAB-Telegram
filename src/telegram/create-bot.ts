import { Bot, type Context } from 'grammy';
import type { Message } from 'grammy/types';
import type { GroupRepository } from '../db/group-repository.js';
import type { BotGroupStatus } from '../db/schema.js';
import {
  getMessages,
  localeFromTelegram,
  supportedLocale,
} from '../i18n/messages.js';

/** Dependencies required by handlers that persist group scope. */
export interface BotDependencies {
  readonly installationId: string;
  readonly groups: GroupRepository;
}

/**
 * Creates the grammY bot with minimal onboarding and group membership handlers.
 *
 * @param token - Telegram bot token read from validated runtime configuration.
 * @param dependencies - Server-owned installation identity and scoped repositories.
 * @returns A configured bot instance that has not started polling yet.
 */
export function createBot(token: string, dependencies: BotDependencies): Bot<Context> {
  const bot = new Bot(token);

  bot.on('my_chat_member', async (context) => {
    const chat = context.myChatMember.chat;
    if (chat.type !== 'group' && chat.type !== 'supergroup') {
      return;
    }

    const membership = context.myChatMember.new_chat_member;
    const status = mapBotGroupStatus(membership.status);
    const isActive = membership.status === 'restricted'
      ? membership.is_member
      : status !== 'left' && status !== 'kicked';

    await dependencies.groups.register(dependencies.installationId, {
      telegramChatId: BigInt(chat.id),
      chatType: chat.type,
      title: chat.title,
      username: chat.username ?? null,
      botStatus: status,
      isActive,
    });
  });

  bot.command('start', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(context.from?.language_code);
    const messages = getMessages(locale);
    await replyToCommand(context, group ? messages.groupStart : messages.privateStart);
  });

  bot.command('help', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(context.from?.language_code);
    await replyToCommand(context, getMessages(locale).help);
  });

  return bot;
}

/** Builds the privacy-preserving Telegram payload for a group command response. */
export function ephemeralCommandReplyOptions(
  message: Message,
  receiverUserId: number,
) {
  return {
    ephemeral_message_parameters: { receiver_user_id: receiverUserId },
    ...(message.ephemeral_message_id === undefined
      ? {}
      : { reply_parameters: { ephemeral_message_id: message.ephemeral_message_id } }),
  };
}

/** Sends command feedback privately in groups and normally in private chats. */
async function replyToCommand(context: Context, text: string): Promise<void> {
  const chat = context.chat;
  if (chat?.type === 'group' || chat?.type === 'supergroup') {
    const sender = context.from;
    if (!sender) {
      return;
    }
    const message = context.msg;
    if (!message) {
      return;
    }

    await context.api.sendMessage(
      chat.id,
      text,
      ephemeralCommandReplyOptions(message, sender.id),
    );
    return;
  }

  await context.reply(text);
}

/** Saves group metadata from a command without changing membership state. */
async function observeCurrentGroup(
  context: Context,
  dependencies: BotDependencies,
) {
  const chat = context.chat;
  if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
    return null;
  }

  return dependencies.groups.observe(dependencies.installationId, {
    telegramChatId: BigInt(chat.id),
    chatType: chat.type,
    title: chat.title,
    username: chat.username ?? null,
  });
}

/** Converts Telegram's current bot membership status into the persisted contract. */
function mapBotGroupStatus(status: string): BotGroupStatus {
  switch (status) {
    case 'creator':
    case 'administrator':
    case 'member':
    case 'restricted':
    case 'left':
    case 'kicked':
      return status;
    default:
      return 'left';
  }
}
