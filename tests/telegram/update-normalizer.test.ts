import type { Update } from 'grammy/types';
import { describe, expect, it } from 'vitest';
import { ephemeralMessageUpdate } from '../fixtures/telegram-api-10-3.js';
import { normalizeTelegramUpdate } from '../../src/telegram/update-normalizer.js';

describe('Telegram update normalization', () => {
  it('projects a group message into bounded identity and message fields', () => {
    expect(normalizeTelegramUpdate(ephemeralMessageUpdate)).toEqual({
      kind: 'message',
      updateId: 9_000_000_001,
      messageId: 0,
      chat: {
        id: -1_000_000_000_001n,
        type: 'supergroup',
        title: 'Synthetic FOAB Community',
      },
      sender: {
        id: 1_000_000_001,
        isBot: false,
        languageCode: null,
      },
      text: '/config',
      caption: null,
      ephemeralMessageId: 7_000_000_001,
    });
  });

  it('accepts private messages with normal delivery semantics', () => {
    const update = {
      update_id: 9_000_000_010,
      message: {
        chat: { id: 1_000_000_001, type: 'private', first_name: 'Synthetic' },
        date: 1_800_000_000,
        from: { id: 1_000_000_001, is_bot: false, first_name: 'Synthetic' },
        message_id: 7_000_000_010,
        text: '/settings',
      },
    } satisfies Update;

    const normalized = normalizeTelegramUpdate(update);
    if (!normalized || normalized.kind !== 'message') {
      throw new Error('The synthetic private message was not normalized.');
    }
    expect(normalized.chat.type).toBe('private');
    expect(normalized.text).toBe('/settings');
  });

  it('normalizes a group membership transition and computes active state', () => {
    const update = {
      update_id: 9_000_000_011,
      my_chat_member: {
        chat: {
          id: -1_000_000_000_001,
          title: 'Synthetic FOAB Community',
          type: 'supergroup',
        },
        date: 1_800_000_000,
        from: { id: 1_000_000_001, is_bot: false, first_name: 'Synthetic' },
        old_chat_member: {
          status: 'member',
          user: { id: 2_000_000_001, is_bot: true, first_name: 'FOAB' },
        },
        new_chat_member: {
          status: 'left',
          user: { id: 2_000_000_001, is_bot: true, first_name: 'FOAB' },
        },
      },
    } satisfies Update;

    expect(normalizeTelegramUpdate(update)).toMatchObject({
      kind: 'my_chat_member',
      botStatus: 'left',
      isActive: false,
      chat: { id: -1_000_000_000_001n, type: 'supergroup' },
    });
  });

  it('projects a callback query while preserving only bounded action metadata', () => {
    const update = {
      update_id: 9_000_000_012,
      callback_query: {
        id: 'synthetic-callback-001',
        from: { id: 1_000_000_001, is_bot: false, first_name: 'Synthetic' },
        chat_instance: 'synthetic-chat-instance',
        data: 'foab:settings:language',
        message: {
          chat: {
            id: -1_000_000_000_001,
            title: 'Synthetic FOAB Community',
            type: 'supergroup',
          },
          date: 1_800_000_000,
          message_id: 0,
          ephemeral_message_id: 7_000_000_002,
        },
      },
    } satisfies Update;

    expect(normalizeTelegramUpdate(update)).toEqual({
      kind: 'callback_query',
      updateId: 9_000_000_012,
      callbackQueryId: 'synthetic-callback-001',
      chat: {
        id: -1_000_000_000_001n,
        type: 'supergroup',
        title: 'Synthetic FOAB Community',
      },
      messageId: 0,
      sender: {
        id: 1_000_000_001,
        isBot: false,
        languageCode: null,
      },
      data: 'foab:settings:language',
      ephemeralMessageId: 7_000_000_002,
    });
  });

  it('rejects unsupported variants, unsafe IDs, and oversized text', () => {
    const oversized = {
      ...ephemeralMessageUpdate,
      message: { ...ephemeralMessageUpdate.message, text: 'x'.repeat(4_097) },
    } satisfies Update;
    const unknownVariant = {
      ...ephemeralMessageUpdate,
      callback_query: {},
    } as unknown as Update;
    const unsafeUpdateId = {
      ...ephemeralMessageUpdate,
      update_id: Number.MAX_SAFE_INTEGER + 1,
    } satisfies Update;

    expect(normalizeTelegramUpdate(oversized)).toBeNull();
    expect(normalizeTelegramUpdate(unknownVariant)).toBeNull();
    expect(normalizeTelegramUpdate(unsafeUpdateId)).toBeNull();
  });

  it('rejects a zero ordinary message ID without an ephemeral message ID', () => {
    const invalidOrdinaryMessage = {
      update_id: ephemeralMessageUpdate.update_id,
      message: {
        chat: ephemeralMessageUpdate.message.chat,
        date: ephemeralMessageUpdate.message.date,
        from: ephemeralMessageUpdate.message.from,
        message_id: 0,
        receiver_user: ephemeralMessageUpdate.message.receiver_user,
        text: ephemeralMessageUpdate.message.text,
      },
    } satisfies Update;

    expect(normalizeTelegramUpdate(invalidOrdinaryMessage)).toBeNull();
  });
});
