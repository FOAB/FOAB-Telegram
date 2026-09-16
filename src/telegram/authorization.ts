import type { Context } from 'grammy';
import type { ChatMember } from 'grammy/types';

/** Minimal Telegram API surface needed to resolve current group membership. */
export interface GroupMemberLookup {
  readonly getChatMember: (
    chatId: number | string,
    userId: number,
  ) => Promise<ChatMember>;
}

/**
 * Checks current administrator status for the authenticated sender in the
 * exact group from the update. Telegram API failures deny access.
 */
export async function isCurrentGroupAdministrator(context: Context): Promise<boolean> {
  const chat = context.chat;
  const sender = context.from;
  if (
    !sender ||
    sender.is_bot ||
    !chat ||
    (chat.type !== 'group' && chat.type !== 'supergroup')
  ) {
    return false;
  }

  try {
    const member = await context.getChatMember(sender.id);
    return member.status === 'creator' || member.status === 'administrator';
  } catch {
    return false;
  }
}

/** Checks one server-selected group without accepting a client-supplied scope. */
export async function isGroupAdministrator(
  api: GroupMemberLookup,
  telegramChatId: bigint,
  userId: number,
): Promise<boolean> {
  try {
    const member = await api.getChatMember(telegramChatId.toString(), userId);
    return member.status === 'creator' || member.status === 'administrator';
  } catch {
    return false;
  }
}
