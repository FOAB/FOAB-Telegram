import { describe, expect, it } from 'vitest';
import { WebAppSessionStore } from '../../src/webapp/session-store.js';

const syntheticUser = { id: 1_000_000_001, languageCode: 'en' };
const sessionStart = new Date('2026-09-16T12:00:00.000Z');

describe('Web App session store', () => {
  it('creates opaque sessions, refreshes idle activity, and validates CSRF separately', () => {
    const store = new WebAppSessionStore();
    const created = store.create(syntheticUser, sessionStart);

    expect(created.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(created.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(created.session.sessionTokenHash).not.toContain(created.sessionToken);
    expect(store.validateCsrf(created.session, created.csrfToken)).toBe(true);
    expect(store.validateCsrf(created.session, 'invalid-csrf-token')).toBe(false);

    const touched = store.get(
      created.sessionToken,
      new Date(sessionStart.getTime() + 5 * 60 * 1_000),
    );
    expect(touched?.lastSeenAt.toISOString()).toBe('2026-09-16T12:05:00.000Z');
  });

  it('expires sessions after the idle window or absolute lifetime', () => {
    const store = new WebAppSessionStore();
    const created = store.create(syntheticUser, sessionStart);

    expect(store.get(created.sessionToken, new Date('2026-09-16T12:15:01.000Z'))).toBeNull();
    expect(store.get(created.sessionToken, new Date('2026-09-16T13:00:00.000Z'))).toBeNull();
  });

  it('revokes a session without affecting another session', () => {
    const store = new WebAppSessionStore();
    const first = store.create(syntheticUser, sessionStart);
    const second = store.create(syntheticUser, sessionStart);

    store.revoke(first.sessionToken);

    expect(store.get(first.sessionToken, sessionStart)).toBeNull();
    expect(store.get(second.sessionToken, sessionStart)).not.toBeNull();
    expect(store.size(sessionStart)).toBe(1);
  });

  it('renews the CSRF token for a restored session and invalidates the old value', () => {
    const store = new WebAppSessionStore();
    const created = store.create(syntheticUser, sessionStart);
    const restored = store.get(created.sessionToken, sessionStart);
    expect(restored).not.toBeNull();
    if (!restored) return;

    const renewedToken = store.renewCsrf(restored);
    const refreshed = store.get(created.sessionToken, sessionStart);
    expect(refreshed).not.toBeNull();
    if (!refreshed) return;
    expect(renewedToken).not.toBe(created.csrfToken);
    expect(store.validateCsrf(refreshed, renewedToken)).toBe(true);
    expect(store.validateCsrf(refreshed, created.csrfToken)).toBe(false);
  });
});
