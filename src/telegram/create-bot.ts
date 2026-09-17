import { Bot, type Context } from 'grammy';
import type { Chat, InlineKeyboardMarkup, Message } from 'grammy/types';
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
  parseSettingsCallbackData,
  type SettingsCallback,
  type SettingsCommand,
} from './commands.js';
import { ActiveFlowStore, type FlowKey } from './flow-state.js';
import {
  PrivateGroupSelectionStore,
  type PrivateSelectionKey,
} from './private-selection.js';
import { normalizeTelegramUpdate } from './update-normalizer.js';
import {
  privateGroupSelectionKeyboard,
  settingsLanguageKeyboard,
  settingsOverviewKeyboard,
  settingsTimeZoneKeyboard,
} from './settings-keyboard.js';

/** Safe update variants emitted by the bot's operational telemetry. */
export type BotUpdateKind = 'message' | 'my_chat_member' | 'callback_query';

/** Chat categories that may appear in an operational event without chat identity. */
export type BotChatType = 'private' | 'group' | 'supergroup' | 'channel';

/** Explicit allowlist for non-sensitive Telegram processing telemetry. */
export interface BotLogFields {
  readonly updateKind?: BotUpdateKind;
  readonly chatType?: BotChatType;
  readonly command?: 'start' | 'help' | 'ping' | 'id' | 'settings' | 'cancel';
  readonly inboxClaimed?: boolean;
  readonly observedGroup?: boolean;
  readonly groupActive?: boolean;
  readonly adminCheck?: boolean;
  readonly botStatus?: BotGroupStatus;
  readonly membershipActive?: boolean;
}

/** Logger contract restricted to the safe fields emitted by bot handlers. */
export interface BotLogger {
  readonly info: (event: string, fields?: BotLogFields) => void;
}

/** Dependencies required by handlers that persist group scope. */
export interface BotDependencies {
  readonly installationId: string;
  readonly groups: GroupRepository;
  readonly webAppUrl?: string;
  readonly inbox?: UpdateInboxRepository;
  readonly flows?: ActiveFlowStore;
  readonly privateSelections?: PrivateGroupSelectionStore;
  readonly logger?: BotLogger;
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
    const receivedUpdateKind = telegramUpdateKind(context.update);
    const receivedChatType = botChatType(context.chat);
    const receivedFields: BotLogFields = {
      ...(receivedUpdateKind === null ? {} : { updateKind: receivedUpdateKind }),
      ...(receivedChatType === null ? {} : { chatType: receivedChatType }),
    };
    dependencies.logger?.info(
      'telegram_update_received',
      receivedFields,
    );
    const normalized = normalizeTelegramUpdate(context.update);
    if (!normalized) {
      dependencies.logger?.info('telegram_update_ignored', receivedFields);
      return;
    }
    if (!dependencies.inbox) {
      dependencies.logger?.info('telegram_update_accepted', {
        updateKind: normalized.kind,
        inboxClaimed: true,
      });
      await next();
      return;
    }

    const claimed = await dependencies.inbox.claim(
      dependencies.installationId,
      normalized.updateId,
      normalized.kind,
    );
    if (!claimed) {
      dependencies.logger?.info('telegram_update_skipped', {
        updateKind: normalized.kind,
        inboxClaimed: false,
      });
      return;
    }
    dependencies.logger?.info('telegram_update_claimed', {
      updateKind: normalized.kind,
      inboxClaimed: true,
    });

    try {
      await next();
      const processed = await dependencies.inbox.markProcessed(
        dependencies.installationId,
        normalized.updateId,
      );
      if (!processed) {
        throw new Error('The Telegram update lease could not be completed.');
      }
      dependencies.logger?.info('telegram_update_processed', {
        updateKind: normalized.kind,
      });
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
    dependencies.logger?.info('telegram_group_membership_registered', {
      chatType: chat.type,
      botStatus: status,
      membershipActive: isActive,
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

  bot.command('ping', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(context.from?.language_code);
    await replyToCommand(context, getMessages(locale).ping);
  });

  bot.command('id', async (context) => {
    const group = await observeCurrentGroup(context, dependencies);
    const sender = context.from;
    const chat = context.chat;
    if (!sender || !chat) {
      return;
    }
    const locale = group
      ? supportedLocale(group.locale)
      : localeFromTelegram(sender.language_code);
    await replyToCommand(context, getMessages(locale).id(String(chat.id), sender.id));
  });

  bot.on('callback_query:data', async (context) => {
    const action = parseSettingsCallbackData(context.callbackQuery.data);
    if (!action) {
      await context.answerCallbackQuery();
      return;
    }

    try {
      const feedback = await handleSettingsCallback(
        context,
        dependencies,
        flows,
        privateSelections,
        action,
      );
      await context.answerCallbackQuery(feedback ? { text: feedback } : undefined);
    } catch (error: unknown) {
      try {
        await context.answerCallbackQuery();
      } catch {
        // Preserve the original handler failure without exposing callback data.
      }
      throw error;
    }
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
    const chatType = botChatType(context.chat);
    dependencies.logger?.info('telegram_settings_scope_resolved', {
      ...(chatType === null ? {} : { chatType }),
      observedGroup: group !== null,
      ...(group === null ? {} : { groupActive: group.isActive }),
      command: 'settings',
    });

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
    const administrator = await isCurrentGroupAdministrator(context);
    dependencies.logger?.info('telegram_settings_admin_checked', {
      chatType: group.chatType,
      observedGroup: true,
      groupActive: group.isActive,
      adminCheck: administrator,
      command: 'settings',
    });
    if (!group.isActive || !administrator) {
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
        settingsOverviewKeyboard(messages),
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
    const updatedMessages = getMessages(supportedLocale(updated.locale));
    await replyToCommand(
      context,
      updatedMessages.settingsUpdated,
      settingsOverviewKeyboard(updatedMessages),
    );
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
async function replyToCommand(
  context: Context,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
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

    const options = replyMarkup === undefined
      ? ephemeralCommandReplyOptions(message, sender.id)
      : {
        ...ephemeralCommandReplyOptions(message, sender.id),
        reply_markup: replyMarkup,
      };
    await context.api.sendMessage(chat.id, text, options);
    return;
  }

  if (replyMarkup === undefined) {
    await context.reply(text);
    return;
  }
  await context.reply(text, { reply_markup: replyMarkup });
}

/** Saves group metadata from a command without changing membership state. */
async function observeCurrentGroup(
  context: Context,
  dependencies: BotDependencies,
) {
  const chat = context.chat;
  if (!chat || (chat.type !== 'group' && chat.type !== 'supergroup')) {
    const chatType = botChatType(chat);
    dependencies.logger?.info(
      'telegram_group_observation_skipped',
      chatType === null ? {} : { chatType },
    );
    return null;
  }

  const group = await dependencies.groups.observe(dependencies.installationId, {
    telegramChatId: BigInt(chat.id),
    chatType: chat.type,
    title: chat.title,
    username: chat.username ?? null,
  });
  dependencies.logger?.info('telegram_group_observed', {
    chatType: chat.type,
    observedGroup: true,
    groupActive: group.isActive,
  });
  return group;
}

/** Identifies only update variants that the runtime explicitly handles. */
export function telegramUpdateKind(update: Context['update']): BotUpdateKind | null {
  if (update.message !== undefined) {
    return 'message';
  }
  if (update.my_chat_member !== undefined) {
    return 'my_chat_member';
  }
  if (update.callback_query !== undefined) {
    return 'callback_query';
  }
  return null;
}

/** Converts Telegram chat types to the bounded operational-log vocabulary. */
function botChatType(chat: Chat | undefined): BotChatType | null {
  if (!chat) {
    return null;
  }
  return chat.type;
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
      privateGroupSelectionKeyboard(
        messages,
        administratorGroups.map((group, index) => ({
          index: index + 1,
          title: safeGroupTitle(group.title),
        })),
        dependencies.webAppUrl,
      ),
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
      settingsOverviewKeyboard(groupMessages, dependencies.webAppUrl),
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
  const updatedMessages = getMessages(supportedLocale(updated.locale));
  await replyToCommand(
    context,
    updatedMessages.settingsUpdated,
    settingsOverviewKeyboard(updatedMessages, dependencies.webAppUrl),
  );
}

/** Handles one typed settings callback while rechecking the current target scope. */
async function handleSettingsCallback(
  context: Context,
  dependencies: BotDependencies,
  flows: ActiveFlowStore,
  privateSelections: PrivateGroupSelectionStore,
  action: SettingsCallback,
): Promise<string | null> {
  const sender = context.from;
  const chat = context.chat;
  if (!sender || sender.is_bot || !chat) {
    return null;
  }

  if (chat.type === 'private') {
    return handlePrivateSettingsCallback(
      context,
      dependencies,
      privateSelections,
      action,
    );
  }
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return handleGroupSettingsCallback(context, dependencies, flows, action);
  }
  return null;
}

/** Handles buttons from a group ephemeral settings message. */
async function handleGroupSettingsCallback(
  context: Context,
  dependencies: BotDependencies,
  flows: ActiveFlowStore,
  action: SettingsCallback,
): Promise<string | null> {
  const chat = context.chat;
  const sender = context.from;
  if (!chat || !sender || (chat.type !== 'group' && chat.type !== 'supergroup')) {
    return null;
  }
  if (!Number.isSafeInteger(chat.id)) {
    return null;
  }

  const group = await dependencies.groups.findByChatId(
    dependencies.installationId,
    BigInt(chat.id),
  );
  const messages = getMessages(supportedLocale(group?.locale));
  if (!group || !group.isActive || !(await isCurrentGroupAdministrator(context))) {
    await editSettingsMessage(context, messages.settingsNotAuthorized);
    return messages.settingsNotAuthorized;
  }

  const key = getFlowKey(context, dependencies.installationId, group.telegramChatId);
  if (!key) {
    await editSettingsMessage(context, messages.settingsNotAuthorized);
    return messages.settingsNotAuthorized;
  }

  if (action.kind === 'close') {
    flows.cancel(key, 'settings');
    await editSettingsMessage(context, messages.cancelCompleted);
    return null;
  }
  if (action.kind === 'back') {
    await editSettingsMessage(
      context,
      messages.groupSettings(group.locale, group.timeZone, group.settingsRevision),
      settingsOverviewKeyboard(messages),
    );
    return null;
  }
  if (action.kind === 'show-language') {
    await editSettingsMessage(context, messages.settingsLanguagePrompt, settingsLanguageKeyboard(messages));
    return null;
  }
  if (action.kind === 'show-time-zone') {
    await editSettingsMessage(context, messages.settingsTimeZonePrompt, settingsTimeZoneKeyboard(messages));
    return null;
  }
  if (action.kind === 'select-group') {
    return null;
  }
  const updated = await dependencies.groups.updateSettings(
    dependencies.installationId,
    group.telegramChatId,
    group.settingsRevision,
    settingsUpdateFromCallback(action),
  );
  if (!updated) {
    await editSettingsMessage(context, messages.settingsConflict, settingsOverviewKeyboard(messages));
    return messages.settingsConflict;
  }

  flows.cancel(key, 'settings');
  const updatedMessages = getMessages(supportedLocale(updated.locale));
  await editSettingsMessage(
    context,
    updatedMessages.groupSettings(updated.locale, updated.timeZone, updated.settingsRevision),
    settingsOverviewKeyboard(updatedMessages),
  );
  return updatedMessages.settingsUpdated;
}

/** Handles buttons from a private group list or selected-group settings message. */
async function handlePrivateSettingsCallback(
  context: Context,
  dependencies: BotDependencies,
  selections: PrivateGroupSelectionStore,
  action: SettingsCallback,
): Promise<string | null> {
  const key = getPrivateSelectionKey(context, dependencies.installationId);
  const sender = context.from;
  const messages = getMessages(localeFromTelegram(sender?.language_code));
  if (!key || !sender) {
    await editSettingsMessage(context, messages.settingsNotAuthorized);
    return messages.settingsNotAuthorized;
  }

  if (action.kind === 'select-group') {
    const selectedGroupId = selections.select(key, action.index);
    if (selectedGroupId === null) {
      await editSettingsMessage(context, messages.privateSelectionExpired);
      return messages.privateSelectionExpired;
    }

    const group = await dependencies.groups.findByChatId(
      dependencies.installationId,
      selectedGroupId,
    );
    if (!group || !group.isActive || !(await isGroupAdministrator(context.api, selectedGroupId, sender.id))) {
      selections.clear(key);
      await editSettingsMessage(context, messages.settingsNotAuthorized);
      return messages.settingsNotAuthorized;
    }

    const groupMessages = getMessages(supportedLocale(group.locale));
    await editSettingsMessage(
      context,
      groupMessages.groupSettings(group.locale, group.timeZone, group.settingsRevision),
      settingsOverviewKeyboard(groupMessages, dependencies.webAppUrl),
    );
    return null;
  }

  const selectedGroupId = selections.resolveSelected(key);
  if (selectedGroupId === null) {
    await editSettingsMessage(context, messages.privateSelectionUsage);
    return messages.privateSelectionUsage;
  }

  const group = await dependencies.groups.findByChatId(
    dependencies.installationId,
    selectedGroupId,
  );
  if (!group || !group.isActive || !(await isGroupAdministrator(context.api, selectedGroupId, sender.id))) {
    selections.clear(key);
    await editSettingsMessage(context, messages.settingsNotAuthorized);
    return messages.settingsNotAuthorized;
  }

  const groupMessages = getMessages(supportedLocale(group.locale));
  if (action.kind === 'close') {
    selections.clear(key);
    await editSettingsMessage(context, groupMessages.cancelCompleted);
    return null;
  }
  if (action.kind === 'back') {
    await editSettingsMessage(
      context,
      groupMessages.groupSettings(group.locale, group.timeZone, group.settingsRevision),
      settingsOverviewKeyboard(groupMessages, dependencies.webAppUrl),
    );
    return null;
  }
  if (action.kind === 'show-language') {
    await editSettingsMessage(
      context,
      groupMessages.settingsLanguagePrompt,
      settingsLanguageKeyboard(groupMessages),
    );
    return null;
  }
  if (action.kind === 'show-time-zone') {
    await editSettingsMessage(
      context,
      groupMessages.settingsTimeZonePrompt,
      settingsTimeZoneKeyboard(groupMessages),
    );
    return null;
  }
  const updated = await dependencies.groups.updateSettings(
    dependencies.installationId,
    selectedGroupId,
    group.settingsRevision,
    settingsUpdateFromCallback(action),
  );
  if (!updated) {
    await editSettingsMessage(context, groupMessages.settingsConflict, settingsOverviewKeyboard(groupMessages));
    return groupMessages.settingsConflict;
  }

  const updatedMessages = getMessages(supportedLocale(updated.locale));
  await editSettingsMessage(
    context,
    updatedMessages.groupSettings(updated.locale, updated.timeZone, updated.settingsRevision),
    settingsOverviewKeyboard(updatedMessages, dependencies.webAppUrl),
  );
  return updatedMessages.settingsUpdated;
}

/** Edits the original private or group ephemeral settings message without public fallback. */
async function editSettingsMessage(
  context: Context,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const message = context.msg;
  const sender = context.from;
  const chat = message?.chat;
  if (!message || !sender || !chat) {
    return;
  }

  const markup = replyMarkup ?? { inline_keyboard: [] };
  if ((chat.type === 'group' || chat.type === 'supergroup') && message.ephemeral_message_id !== undefined) {
    await context.api.editEphemeralMessageText(
      chat.id,
      sender.id,
      message.ephemeral_message_id,
      text,
      { reply_markup: markup },
    );
    return;
  }
  if (chat.type === 'private' && message.message_id > 0) {
    await context.api.editMessageText(chat.id, message.message_id, text, { reply_markup: markup });
    return;
  }
  if (chat.type === 'group' || chat.type === 'supergroup') {
    await context.api.sendMessage(chat.id, text, {
      ephemeral_message_parameters: { receiver_user_id: sender.id },
      reply_markup: markup,
    });
  }
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

/** Converts a typed keyboard setting action into the repository's allowlisted patch. */
function settingsUpdateFromCallback(
  action: Extract<SettingsCallback, { kind: 'set-locale' | 'set-time-zone' }>,
): GroupSettingsUpdate {
  if (action.kind === 'set-locale') {
    return { locale: action.value } as const;
  }
  return { timeZone: action.value } as const;
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
