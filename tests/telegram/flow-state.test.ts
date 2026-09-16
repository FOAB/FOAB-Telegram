import { describe, expect, it } from 'vitest';
import { ActiveFlowStore, type FlowKey } from '../../src/telegram/flow-state.js';

const groupAUser1: FlowKey = {
  installationId: '00000000-0000-4000-8000-000000000001',
  telegramChatId: -1000000000001n,
  userId: 1000000001,
};

describe('transient flow isolation', () => {
  it('cancels only the exact installation, group, and user flow', () => {
    const store = new ActiveFlowStore();
    const sameGroupOtherUser = { ...groupAUser1, userId: 1000000002 };
    const otherGroup = { ...groupAUser1, telegramChatId: -1000000000002n };

    store.begin(groupAUser1, 'settings');
    expect(store.has(groupAUser1, 'settings')).toBe(true);
    expect(store.has(sameGroupOtherUser, 'settings')).toBe(false);
    expect(store.has(otherGroup, 'settings')).toBe(false);
    expect(store.cancel(sameGroupOtherUser, 'settings')).toBe(false);
    expect(store.cancel(groupAUser1, 'settings')).toBe(true);
    expect(store.has(groupAUser1, 'settings')).toBe(false);
  });
});
