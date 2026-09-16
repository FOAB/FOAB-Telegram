import type { Context } from 'grammy';

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
