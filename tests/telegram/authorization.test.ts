import type { Context } from 'grammy';
import { describe, expect, it } from 'vitest';
import { isCurrentGroupAdministrator } from '../../src/telegram/authorization.js';

describe('group authorization boundary', () => {
  it('checks the update sender in the update chat and accepts current admins', async () => {
    let checkedUserId: number | undefined;
    const context = {
      chat: { id: -1000000000001, type: 'supergroup', title: 'Synthetic Group' },
      from: { id: 1000000001, is_bot: false, first_name: 'Synthetic' },
      getChatMember: async (userId: number) => {
        checkedUserId = userId;
        return { status: 'administrator' };
      },
    } as unknown as Context;

    await expect(isCurrentGroupAdministrator(context)).resolves.toBe(true);
    expect(checkedUserId).toBe(1000000001);
  });

  it('denies members, bot senders, private chats, and API failures', async () => {
    const memberContext = {
      chat: { id: -1000000000001, type: 'group', title: 'Synthetic Group' },
      from: { id: 1000000001, is_bot: false, first_name: 'Synthetic' },
      getChatMember: async () => ({ status: 'member' }),
    } as unknown as Context;
    const botSenderContext = {
      ...memberContext,
      from: { id: 1000000002, is_bot: true, first_name: 'Synthetic Bot' },
    } as unknown as Context;
    const privateContext = {
      ...memberContext,
      chat: { id: 1000000001, type: 'private', first_name: 'Synthetic' },
    } as unknown as Context;
    const failedContext = {
      ...memberContext,
      getChatMember: async () => {
        throw new Error('synthetic Telegram API failure');
      },
    } as unknown as Context;

    await expect(isCurrentGroupAdministrator(memberContext)).resolves.toBe(false);
    await expect(isCurrentGroupAdministrator(botSenderContext)).resolves.toBe(false);
    await expect(isCurrentGroupAdministrator(privateContext)).resolves.toBe(false);
    await expect(isCurrentGroupAdministrator(failedContext)).resolves.toBe(false);
  });
});
