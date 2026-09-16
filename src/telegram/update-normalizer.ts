import type { Chat, Update, User } from 'grammy/types';
import type { BotGroupStatus, GroupChatType } from '../db/schema.js';

const MAX_MESSAGE_TEXT_LENGTH = 4_096;
const MAX_MESSAGE_CAPTION_LENGTH = 1_024;
const MAX_LANGUAGE_CODE_LENGTH = 64;

/** Normalized chat identity accepted by the current group/private command boundary. */
export interface NormalizedChat {
  readonly id: bigint;
  readonly type: 'private' | GroupChatType;
  readonly title: string | null;
}

/** Normalized sender identity derived from the Telegram update. */
export interface NormalizedSender {
  readonly id: number;
  readonly isBot: boolean;
  readonly languageCode: string | null;
}

/** Safe message summary used by future command and inbox processing. */
export interface NormalizedMessageUpdate {
  readonly kind: 'message';
  readonly updateId: number;
  readonly messageId: number;
  readonly chat: NormalizedChat;
  readonly sender: NormalizedSender;
  readonly text: string | null;
  readonly caption: string | null;
  readonly ephemeralMessageId: number | null;
}

/** Safe bot-membership summary used by group registration and reconciliation. */
export interface NormalizedBotMembershipUpdate {
  readonly kind: 'my_chat_member';
  readonly updateId: number;
  readonly chat: NormalizedChat & { readonly type: GroupChatType };
  readonly actor: NormalizedSender;
  readonly botStatus: BotGroupStatus;
  readonly isActive: boolean;
}

/** Safe callback metadata used by interactive keyboards. */
export interface NormalizedCallbackQueryUpdate {
  readonly kind: 'callback_query';
  readonly updateId: number;
  readonly callbackQueryId: string;
  readonly chat: NormalizedChat;
  readonly messageId: number;
  readonly sender: NormalizedSender;
  readonly data: string;
  readonly ephemeralMessageId: number | null;
}

/** Union of update shapes that the current application is prepared to process. */
export type NormalizedTelegramUpdate =
  | NormalizedMessageUpdate
  | NormalizedBotMembershipUpdate
  | NormalizedCallbackQueryUpdate;

/**
 * Validates and projects the supported Telegram update variants into a small
 * internal contract. Unknown variants, malformed IDs, and oversized text are
 * rejected before handlers can perform a side effect.
 */
export function normalizeTelegramUpdate(update: Update): NormalizedTelegramUpdate | null {
  if (!isSafeInteger(update.update_id) || update.update_id < 0) {
    return null;
  }

  const allowedTopLevelKeys = new Set(['update_id', 'message', 'my_chat_member', 'callback_query']);
  if (Object.keys(update).some((key) => !allowedTopLevelKeys.has(key))) {
    return null;
  }

  const presentVariants = [
    update.message !== undefined,
    update.my_chat_member !== undefined,
    update.callback_query !== undefined,
  ].filter(Boolean).length;
  if (presentVariants !== 1) {
    return null;
  }

  if (update.message !== undefined) {
    return normalizeMessage(update.update_id, update.message);
  }
  if (update.my_chat_member !== undefined) {
    return normalizeBotMembership(update.update_id, update.my_chat_member);
  }
  if (update.callback_query !== undefined) {
    return normalizeCallbackQuery(update.update_id, update.callback_query);
  }
  return null;
}

/** Projects an incoming message while preserving only bounded useful fields. */
function normalizeMessage(
  updateId: number,
  message: NonNullable<Update['message']>,
): NormalizedMessageUpdate | null {
  const messageId = safePositiveInteger(message.message_id);
  const chat = normalizeChat(message.chat);
  const sender = normalizeSender(message.from);
  if (messageId === null || !chat || !sender) {
    return null;
  }

  const text = normalizeBoundedOptionalText(message.text, MAX_MESSAGE_TEXT_LENGTH);
  const caption = normalizeBoundedOptionalText(message.caption, MAX_MESSAGE_CAPTION_LENGTH);
  if (text === undefined || caption === undefined) {
    return null;
  }

  return {
    kind: 'message',
    updateId,
    messageId,
    chat,
    sender,
    text: text ?? null,
    caption: caption ?? null,
    ephemeralMessageId: safePositiveInteger(message.ephemeral_message_id) ?? null,
  };
}

/** Projects a bot membership update and computes active state from Telegram status. */
function normalizeBotMembership(
  updateId: number,
  membership: NonNullable<Update['my_chat_member']>,
): NormalizedBotMembershipUpdate | null {
  const chat = normalizeChat(membership.chat);
  const actor = normalizeSender(membership.from);
  const status = normalizeBotStatus(membership.new_chat_member.status);
  if (!chat || !actor || !status || (chat.type !== 'group' && chat.type !== 'supergroup')) {
    return null;
  }

  const isActive = status === 'restricted' && membership.new_chat_member.status === 'restricted'
    ? membership.new_chat_member.is_member
    : status !== 'left' && status !== 'kicked';

  return {
    kind: 'my_chat_member',
    updateId,
    chat: { ...chat, type: chat.type },
    actor,
    botStatus: status,
    isActive,
  };
}

/** Projects a callback query only when it belongs to a concrete private/group message. */
function normalizeCallbackQuery(
  updateId: number,
  callbackQuery: NonNullable<Update['callback_query']>,
): NormalizedCallbackQueryUpdate | null {
  const message = callbackQuery.message;
  const sender = normalizeSender(callbackQuery.from);
  const data = callbackQuery.data;
  if (!message || !sender || !isSafeCallbackQueryId(callbackQuery.id) || !isSafeCallbackData(data)) {
    return null;
  }

  const chat = normalizeChat(message.chat);
  const messageId = safeNonNegativeInteger(message.message_id);
  const ephemeralMessageId = safePositiveInteger(message.ephemeral_message_id);
  if (!chat || messageId === null || (messageId === 0 && ephemeralMessageId === null)) {
    return null;
  }

  return {
    kind: 'callback_query',
    updateId,
    callbackQueryId: callbackQuery.id,
    chat,
    messageId,
    sender,
    data,
    ephemeralMessageId,
  };
}

/** Keeps only supported private, group, and supergroup chat identity fields. */
function normalizeChat(chat: Chat): NormalizedChat | null {
  const id = safeTelegramChatId(chat.id);
  if (id === null) {
    return null;
  }

  if (chat.type === 'private') {
    return { id, type: 'private', title: null };
  }
  if (chat.type !== 'group' && chat.type !== 'supergroup') {
    return null;
  }
  if (typeof chat.title !== 'string' || chat.title.trim().length === 0 || chat.title.length > 255) {
    return null;
  }
  return { id, type: chat.type, title: chat.title.trim() };
}

/** Projects sender identity without copying names or other personal fields. */
function normalizeSender(user: User | undefined): NormalizedSender | null {
  if (!user || !safePositiveInteger(user.id) || typeof user.is_bot !== 'boolean') {
    return null;
  }
  if (user.language_code !== undefined &&
      (typeof user.language_code !== 'string' || user.language_code.length > MAX_LANGUAGE_CODE_LENGTH)) {
    return null;
  }
  return {
    id: user.id,
    isBot: user.is_bot,
    languageCode: user.language_code ?? null,
  };
}

/** Maps only the statuses persisted by the current group registry. */
function normalizeBotStatus(status: string): BotGroupStatus | null {
  switch (status) {
    case 'creator':
    case 'administrator':
    case 'member':
    case 'restricted':
    case 'left':
    case 'kicked':
      return status;
    default:
      return null;
  }
}

/** Accepts a Telegram integer only while it remains exact in JavaScript. */
function safeTelegramChatId(value: number): bigint | null {
  return Number.isSafeInteger(value) ? BigInt(value) : null;
}

/** Accepts a positive exact Telegram identifier. */
function safePositiveInteger(value: number | undefined): number | null {
  return value !== undefined && isSafeInteger(value) && value > 0 ? value : null;
}

/** Accepts zero for ephemeral Telegram message placeholders while preserving integer safety. */
function safeNonNegativeInteger(value: number | undefined): number | null {
  return value !== undefined && isSafeInteger(value) && value >= 0 ? value : null;
}

/** Keeps callback identifiers opaque while preventing unbounded values from entering the boundary. */
function isSafeCallbackQueryId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

/** Enforces Telegram's 1-64-byte callback-data contract before parsing any action. */
function isSafeCallbackData(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && new TextEncoder().encode(value).length <= 64;
}

/** Avoids accepting non-numeric values at the runtime boundary. */
function isSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

/** Returns null for absent text and rejects values above the Telegram boundary. */
function normalizeBoundedOptionalText(
  value: string | undefined,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    return undefined;
  }
  return value;
}
