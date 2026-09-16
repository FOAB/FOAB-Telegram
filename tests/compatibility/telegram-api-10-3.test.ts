import { describe, expect, it } from 'vitest';
import {
  ephemeralMessageUpdate,
  guardJoinRequestUpdate,
  richMessageUpdate,
} from '../fixtures/telegram-api-10-3.js';

describe('synthetic Telegram Bot API 10.3 fixtures', () => {
  it('retains recipient-scoped ephemeral message metadata', () => {
    const message = ephemeralMessageUpdate.message;

    expect(message?.receiver_user?.id).toBe(1_000_000_001);
    expect(message?.ephemeral_message_id).toBe(7_000_000_001);
    expect(message?.chat.id).toBe(-1_000_000_000_001);
  });

  it('retains the Guard join-request query identifier', () => {
    expect(guardJoinRequestUpdate.chat_join_request?.query_id).toBe(
      'synthetic-guard-query-001',
    );
  });

  it('retains structured rich-message content', () => {
    expect(richMessageUpdate.message?.rich_message?.blocks).toEqual([]);
  });
});
