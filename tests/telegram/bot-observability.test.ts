import type { Update } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { telegramUpdateKind } from '../../src/telegram/create-bot.js';

describe('Telegram bot observability boundary', () => {
  it('classifies only the update variants handled by the bot', () => {
    const updates = [
      { update_id: 1, message: {} },
      { update_id: 2, my_chat_member: {} },
      { update_id: 3, callback_query: {} },
    ] as unknown as Update[];

    expect(updates.map(telegramUpdateKind)).toEqual([
      'message',
      'my_chat_member',
      'callback_query',
    ]);
  });

  it('marks unsupported Telegram variants as unclassified', () => {
    const update = { update_id: 4, chat_join_request: {} } as unknown as Update;

    expect(telegramUpdateKind(update)).toBeNull();
  });
});
