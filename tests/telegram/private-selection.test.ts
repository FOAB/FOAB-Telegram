import { describe, expect, it } from 'vitest';
import {
  PrivateGroupSelectionStore,
  type PrivateSelectionKey,
} from '../../src/telegram/private-selection.js';

const key: PrivateSelectionKey = {
  installationId: '00000000-0000-4000-8000-000000000001',
  privateChatId: 1000000001,
  userId: 1000000001,
};

describe('private group selection', () => {
  it('maps a private numeric choice to a server-owned group ID', () => {
    const store = new PrivateGroupSelectionStore({ clock: () => 1_000_000 });
    store.set(key, [-1000000000001n, -1000000000002n]);

    expect(store.resolve(key, 1)).toBe(-1000000000001n);
    expect(store.select(key, 2)).toBe(-1000000000002n);
    expect(store.resolveSelected(key)).toBe(-1000000000002n);
    expect(store.resolve(key, 3)).toBeNull();
  });

  it('expires and isolates selections by private identity', () => {
    let now = 1_000_000;
    const store = new PrivateGroupSelectionStore({ clock: () => now, ttlMs: 1_000 });
    const otherUser = { ...key, userId: 1000000002 };
    store.set(key, [-1000000000001n]);

    expect(store.has(otherUser)).toBe(false);
    now += 1_000;
    expect(store.resolve(key, 1)).toBeNull();
    expect(store.clear(key)).toBe(false);
  });
});
