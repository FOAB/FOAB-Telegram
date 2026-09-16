import { Bot, type Context } from 'grammy';
import type { Message } from 'grammy/types';
import type {
  GroupRecord,
  GroupRepository,
  GroupSettingsUpdate,
} from '../db/group-repository.js';
import type { UpdateInboxRepository } from '../db/update-inbox-repository.js';
import type { BotGroupStatus } from '../db/schema.js';
import {
  getHelpMessage,
  getMessages,
  localeFromTelegram,
  supportedLocale,
} from '../i18n/messages.js';
import {
  isCurrentGroupAdministrator,
  isGroupAdministrator,
} from './authorization.js';
import {
  parseSettingsArguments,
  type SettingsCommand,
} from './commands.js';
import { ActiveFlowStore, type FlowKey } from './flow-state.js';
import {
  PrivateGroupSelectionStore,
  type PrivateSelectionKey,
} from './private-selection.js';
import { normalizeTelegramUpdate } from './update-normalizer.js';

/** Dependencies required by handlers that persist group scope. */
export interface BotDependencies {
  readonly installationId: string;
  readonly groups: GroupRepository;
  readonly inbox?: UpdateInboxRepository;
  readonly flows?: ActiveFlowStore;
  readonly privateSelections?: PrivateGroupSelectionStore;
}

/**
 * Creates the grammY bot with onboarding, help, and group settings handlers.
 *
 * @param token - Telegram bot token read from validated runtime configuration.
 * @param dependencies - Server-owned installation identity and scoped repositories.
 * @returns A configured bot instance that has not started polling yet.
 */
export function createBot(token: string, dependencies: BotDependencies): Bot<Context> {
  const bot = new Bot(token);
  const flows = dependencies.flows ?? new ActiveFlowStore();
  const privateSelections = dependencies.privateSelections ?? new PrivateGroupSelectionStore();

  bot.use(async (context, next) => {
    const normalized = normalizeTelegramUpdate(context.update);
    if (!normalized) {
      return;
    }
    if (!dependencies.inbox) {
      await next();
      return;
    }

    const claimed = await dependencies.inbox.claim(
      dependencies.installationId,
      normalized.updateId,
      normalized.kind,
    );
    if (!claimed) {
      return;
    }

    try {
      await next();
      const processed = await dependencies.inbox.markProcessed(
        dependencies.installationId,
        normalized.updateId,
      );
      if (!processed) {
        throw new Error('The Telegram update lease could not be completed.');
      }
    } catch (error: unknown) {
      try {
        await dependencies.inbox.markFailed(
          dependencies.installationId,
          normalized.updateId,
          error instanceof Error ? error.name : 'UnknownError',
        );
      } catch {
        // Preserve the original handler failure without logging sensitive details.
      }
      throw error;
    }
  });

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
    const administrator = group ? await isCurrentGroupAdministrator(context) : false;
    await replyToCommand(
      context,
      getHelpMessage(locale, administrator, context.chat?.type === 'private'),
    );
  });

  bot.command('settings', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const settingsCommand = parseSettingsArguments(
      typeof context.match === 'string' ? context.match : '',
    );
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(context.from?.language_code);
    const messages = getMessages(locale);

    if (!group) {
      await handlePrivateSettings(
        context,
        dependencies,
        privateSelections,
        settingsCommand,
        messages,
      );
      return;
    }
    if (!group.isActive || !(await isCurrentGroupAdministrator(context))) {
      await replyToCommand(context, messages.settingsNotAuthorized);
      return;
    }

    if (settingsCommand.kind === 'invalid' || settingsCommand.kind === 'select-group') {
      await replyToCommand(context, messages.settingsUsage);
      return;
    }

    const key = getFlowKey(context, dependencies.installationId);
    if (!key) {
      await replyToCommand(context, messages.settingsNotAuthorized);
      return;
    }

    if (settingsCommand.kind === 'show') {
      flows.begin(key, 'settings');
      await replyToCommand(
        context,
        messages.groupSettings(group.locale, group.timeZone, group.settingsRevision),
      );
      return;
    }

    const update = settingsUpdateFromCommand(settingsCommand);
    const updated = await dependencies.groups.updateSettings(
      dependencies.installationId,
      group.telegramChatId,
      group.settingsRevision,
      update,
    );
    if (!updated) {
      await replyToCommand(context, messages.settingsConflict);
      return;
    }

    flows.cancel(key, 'settings');
    await replyToCommand(context, getMessages(supportedLocale(updated.locale)).settingsUpdated);
  });

  bot.command('cancel', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(context.from?.language_code);
    const messages = getMessages(locale);
    if (!group && context.chat?.type === 'private') {
      const key = getPrivateSelectionKey(context, dependencies.installationId);
      await replyToCommand(
        context,
        key && privateSelections.clear(key)
          ? messages.cancelCompleted
          : messages.cancelNoActiveFlow,
      );
      return;
    }
    const key = getFlowKey(context, dependencies.installationId, group?.telegramChatId);
    await replyToCommand(
      context,
      key && flows.cancel(key, 'settings')
        ? messages.cancelCompleted
        : messages.cancelNoActiveFlow,
    );
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

/** Handles private group discovery and updates with normal private-chat replies. */
async function handlePrivateSettings(
  context: Context,
  dependencies: BotDependencies,
  selections: PrivateGroupSelectionStore,
  command: SettingsCommand,
  messages: ReturnType<typeof getMessages>,
): Promise<void> {
  const key = getPrivateSelectionKey(context, dependencies.installationId);
  const sender = context.from;
  if (!key || !sender) {
    await replyToCommand(context, messages.privateSettings);
    return;
  }
  if (command.kind === 'invalid') {
    await replyToCommand(context, messages.privateSettings);
    return;
  }

  if (command.kind === 'show') {
    const activeGroups = await dependencies.groups.listActive(dependencies.installationId, 25);
    const administratorGroups: GroupRecord[] = [];
    for (const group of activeGroups) {
      if (await isGroupAdministrator(context.api, group.telegramChatId, sender.id)) {
        administratorGroups.push(group);
      }
    }

    if (administratorGroups.length === 0) {
      selections.clear(key);
      await replyToCommand(context, messages.privateGroupsEmpty);
      return;
    }

    selections.set(key, administratorGroups.map((group) => group.telegramChatId));
    const entries = administratorGroups.map(
      (group, index) => `${index + 1}. ${safeGroupTitle(group.title)}`,
    );
    await replyToCommand(
      context,
      `${messages.privateGroupsHeader}\n${messages.privateGroupList(entries)}`,
    );
    return;
  }

  if (command.kind === 'select-group') {
    const selectedGroupId = selections.select(key, command.index);
    if (selectedGroupId === null) {
      await replyToCommand(context, messages.privateSelectionExpired);
      return;
    }

    const group = await dependencies.groups.findByChatId(
      dependencies.installationId,
      selectedGroupId,
    );
    if (!group || !group.isActive || !(await isGroupAdministrator(context.api, selectedGroupId, sender.id))) {
      selections.clear(key);
      await replyToCommand(context, messages.settingsNotAuthorized);
      return;
    }

    const groupMessages = getMessages(supportedLocale(group.locale));
    await replyToCommand(
      context,
      groupMessages.groupSettings(group.locale, group.timeZone, group.settingsRevision),
    );
    return;
  }

  const selectedGroupId = selections.resolveSelected(key);
  if (selectedGroupId === null) {
    await replyToCommand(context, messages.privateSelectionUsage);
    return;
  }

  const group = await dependencies.groups.findByChatId(
    dependencies.installationId,
    selectedGroupId,
  );
  if (!group || !group.isActive || !(await isGroupAdministrator(context.api, selectedGroupId, sender.id))) {
    selections.clear(key);
    await replyToCommand(context, messages.settingsNotAuthorized);
    return;
  }

  const updated = await dependencies.groups.updateSettings(
    dependencies.installationId,
    selectedGroupId,
    group.settingsRevision,
    settingsUpdateFromCommand(command),
  );
  if (!updated) {
    await replyToCommand(context, messages.settingsConflict);
    return;
  }

  selections.clear(key);
  await replyToCommand(context, getMessages(supportedLocale(updated.locale)).settingsUpdated);
}

/** Creates a private selection identity from the authenticated private update. */
function getPrivateSelectionKey(
  context: Context,
  installationId: string,
): PrivateSelectionKey | null {
  const chat = context.chat;
  const sender = context.from;
  if (!chat || chat.type !== 'private' || !sender || sender.is_bot) {
    return null;
  }
  return {
    installationId,
    privateChatId: chat.id,
    userId: sender.id,
  };
}

/** Keeps an observed Telegram title on one plain line before private display. */
function safeGroupTitle(title: string): string {
  return title.replace(/\s+/gu, ' ').trim().slice(0, 255);
}

/** Creates a cancellation identity from the authenticated update scope. */
function getFlowKey(
  context: Context,
  installationId: string,
  groupChatId?: bigint,
): FlowKey | null {
  const sender = context.from;
  const chat = context.chat;
  if (!sender || sender.is_bot || !chat || groupChatId === undefined) {
    return null;
  }
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return null;
  }

  return {
    installationId,
    telegramChatId: groupChatId,
    userId: sender.id,
  };
}

/** Converts the parser's closed union into the repository's allowlisted patch. */
function settingsUpdateFromCommand(
  command: Extract<SettingsCommand, { kind: 'set-locale' | 'set-time-zone' }>,
): GroupSettingsUpdate {
  if (command.kind === 'set-locale') {
    return { locale: command.value } as const;
  }
  return { timeZone: command.value } as const;
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
