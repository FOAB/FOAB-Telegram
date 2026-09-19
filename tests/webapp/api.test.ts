import { createHmac } from 'node:crypto';
import type { ChatMember } from 'grammy/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  GroupRecord,
  GroupSettingsUpdate,
} from '../../src/db/group-repository.js';
import {
  createWebAppServer,
  type WebAppGroupStore,
} from '../../src/webapp/api.js';
import { WebAppSessionStore } from '../../src/webapp/session-store.js';

const syntheticToken = 'synthetic-webapp-bot-token';
const syntheticNow = 1_800_000_900;
const syntheticOrigin = 'https://miniapp.example.invalid';
const installationId = '00000000-0000-4000-8000-000000000001';
const otherInstallationId = '00000000-0000-4000-8000-000000000002';
const administratorId = 1_000_000_001;
const memberId = 1_000_000_002;
const primaryChatId = -100_100_000_001n;
const secondaryChatId = -100_100_000_002n;

describe('Mini App settings API', () => {
  let app: ReturnType<typeof createWebAppServer>;

  beforeEach(() => {
    const groups = new SyntheticGroupStore([
      createGroup(primaryChatId, installationId, 'Primary Group'),
      createGroup(secondaryChatId, installationId, 'Secondary Group'),
      createGroup(primaryChatId, otherInstallationId, 'Other Installation Group'),
    ]);
    const telegram = new SyntheticTelegramApi(new Set([`${primaryChatId}:${administratorId}`]));
    app = createWebAppServer({
      botToken: syntheticToken,
      clock: () => new Date(syntheticNow * 1_000),
      groups,
      installationId,
      sessions: new WebAppSessionStore(),
      telegram,
      webAppUrl: `${syntheticOrigin}/foab`,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes a safe liveness endpoint for container orchestration', async () => {
    const health = await app.inject({ method: 'GET', url: '/healthz' });

    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body) as unknown).toEqual({ status: 'ok' });
    expect(health.headers['cache-control']).toBe('no-store');
  });

  it('creates a signed session, exposes safe identity, and filters groups by current admin status', async () => {
    const session = await createSession(app);
    const identity = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: session.cookie },
    });
    const groups = await app.inject({
      method: 'GET',
      url: '/api/groups',
      headers: { cookie: session.cookie },
    });

    expect(identity.statusCode).toBe(200);
    expect(JSON.parse(identity.body) as unknown).toEqual({
      user: { id: administratorId, languageCode: 'pt-BR' },
      expiresAt: new Date((syntheticNow + 3_600) * 1_000).toISOString(),
    });
    expect(groups.statusCode).toBe(200);
    expect(JSON.parse(groups.body) as unknown).toEqual({
      groups: [{
        chatId: primaryChatId.toString(),
        chatType: 'supergroup',
        title: 'Primary Group',
        username: null,
        locale: 'en-US',
        timeZone: 'UTC',
        settingsRevision: 0,
        welcomeMessage: null,
        welcomeMode: 'always',
        deletePreviousWelcomeMessage: false,
        goodbyeMessage: null,
        goodbyeMode: 'always',
        deletePreviousGoodbyeMessage: false,
        rulesText: null,
      }],
    });
    expect(groups.body).not.toContain(installationId);
    expect(groups.headers['cache-control']).toBe('no-store');
    expect(groups.headers['content-security-policy']).toContain("frame-ancestors 'none'");
  });

  it('rejects invalid Telegram init data and browser requests from another origin', async () => {
    const invalidSession = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: {
        'content-type': 'application/json',
        origin: syntheticOrigin,
      },
      payload: JSON.stringify({ initData: 'auth_date=invalid&user={}' }),
    });
    const foreignOrigin = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: {
        'content-type': 'application/json',
        origin: 'https://foreign.example.invalid',
      },
      payload: JSON.stringify({ initData: 'synthetic-init-data' }),
    });

    expect(invalidSession.statusCode).toBe(401);
    expect(foreignOrigin.statusCode).toBe(403);
    expect(JSON.parse(invalidSession.body) as unknown).toEqual({ error: 'invalid_telegram_session' });
  });

  it('updates one authorized group with CSRF and optimistic revision checks', async () => {
    const session = await createSession(app);
    const update = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${primaryChatId.toString()}/settings`,
      headers: {
        'content-type': 'application/json',
        cookie: session.cookie,
        origin: syntheticOrigin,
        'x-foab-csrf': session.csrfToken,
      },
      payload: JSON.stringify({
        expectedRevision: 0,
        locale: 'pt-BR',
        welcomeMessage: 'Welcome, everyone!',
        welcomeMode: 'first',
        deletePreviousWelcomeMessage: true,
        goodbyeMode: 'first',
        deletePreviousGoodbyeMessage: true,
        rulesText: 'Be respectful.',
      }),
    });
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${primaryChatId.toString()}/settings`,
      headers: {
        'content-type': 'application/json',
        cookie: session.cookie,
        origin: syntheticOrigin,
        'x-foab-csrf': session.csrfToken,
      },
      payload: JSON.stringify({ expectedRevision: 0, timeZone: 'America/Sao_Paulo' }),
    });

    expect(update.statusCode).toBe(200);
    expect(JSON.parse(update.body) as unknown).toMatchObject({
      group: {
        chatId: primaryChatId.toString(),
        locale: 'pt-BR',
        settingsRevision: 1,
        welcomeMessage: 'Welcome, everyone!',
        welcomeMode: 'first',
        deletePreviousWelcomeMessage: true,
        goodbyeMessage: null,
        goodbyeMode: 'first',
        deletePreviousGoodbyeMessage: true,
        rulesText: 'Be respectful.',
      },
    });
    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body) as unknown).toEqual({ error: 'revision_conflict' });
  });

  it('denies cross-group writes, missing CSRF, foreign origin, and unknown fields', async () => {
    const session = await createSession(app);
    const crossGroup = await patch(app, session, secondaryChatId, {
      expectedRevision: 0,
      locale: 'pt-BR',
    });
    const missingCsrf = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${primaryChatId.toString()}/settings`,
      headers: {
        'content-type': 'application/json',
        cookie: session.cookie,
        origin: syntheticOrigin,
      },
      payload: JSON.stringify({ expectedRevision: 0, locale: 'pt-BR' }),
    });
    const foreignOrigin = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${primaryChatId.toString()}/settings`,
      headers: {
        'content-type': 'application/json',
        cookie: session.cookie,
        origin: 'https://foreign.example.invalid',
        'x-foab-csrf': session.csrfToken,
      },
      payload: JSON.stringify({ expectedRevision: 0, locale: 'pt-BR' }),
    });
    const unknownField = await patch(app, session, primaryChatId, {
      expectedRevision: 0,
      locale: 'pt-BR',
      unexpected: true,
    });

    expect(crossGroup.statusCode).toBe(403);
    expect(missingCsrf.statusCode).toBe(403);
    expect(foreignOrigin.statusCode).toBe(403);
    expect(unknownField.statusCode).toBe(400);
  });

  it('revokes the browser session and does not disclose session internals', async () => {
    const session = await createSession(app);
    const logout = await app.inject({
      method: 'DELETE',
      url: '/api/session',
      headers: {
        cookie: session.cookie,
        origin: syntheticOrigin,
        'x-foab-csrf': session.csrfToken,
      },
    });
    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: session.cookie },
    });

    expect(logout.statusCode).toBe(204);
    expect(afterLogout.statusCode).toBe(401);
    expect(logout.body).toBe('');
    const clearedCookies = Array.isArray(logout.headers['set-cookie'])
      ? logout.headers['set-cookie']
      : [logout.headers['set-cookie'] ?? ''];
    expect(clearedCookies.some((value) => value.startsWith('foab_session=;'))).toBe(true);
    expect(clearedCookies.some((value) => value.startsWith('foab_csrf=;'))).toBe(true);
    expect(logout.body).not.toContain('csrf');
  });
});

async function createSession(
  app: ReturnType<typeof createWebAppServer>,
): Promise<{ readonly cookie: string; readonly csrfToken: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session',
    headers: {
      'content-type': 'application/json',
      origin: syntheticOrigin,
    },
    payload: JSON.stringify({
      initData: signedInitData({
        auth_date: String(syntheticNow - 30),
        user: JSON.stringify({
          id: administratorId,
          is_bot: false,
          language_code: 'pt-BR',
          first_name: 'Synthetic',
        }),
      }),
    }),
  });
  expect(response.statusCode).toBe(201);

  const setCookie = response.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = cookieHeader?.split(';', 1)[0];
  const body = JSON.parse(response.body) as { readonly csrfToken?: unknown };
  if (cookie === undefined || typeof body.csrfToken !== 'string') {
    throw new Error('Synthetic session response did not contain the expected cookie and CSRF token.');
  }
  return { cookie, csrfToken: body.csrfToken };
}

async function patch(
  app: ReturnType<typeof createWebAppServer>,
  session: { readonly cookie: string; readonly csrfToken: string },
  chatId: bigint,
  body: Readonly<Record<string, unknown>>,
) {
  return app.inject({
    method: 'PATCH',
    url: `/api/groups/${chatId.toString()}/settings`,
    headers: {
      'content-type': 'application/json',
      cookie: session.cookie,
      origin: syntheticOrigin,
      'x-foab-csrf': session.csrfToken,
    },
    payload: JSON.stringify(body),
  });
}

function signedInitData(fields: Readonly<Record<string, string>>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(syntheticToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

function createGroup(
  chatId: bigint,
  scopedInstallationId: string,
  title: string,
): GroupRecord {
  const timestamp = new Date('2026-09-16T12:00:00.000Z');
  return {
    botStatus: 'administrator',
    chatType: 'supergroup',
    createdAt: timestamp,
    installationId: scopedInstallationId,
    isActive: true,
    locale: 'en-US',
    settingsRevision: 0,
    telegramChatId: chatId,
    timeZone: 'UTC',
    title,
    updatedAt: timestamp,
    username: null,
    welcomeMessage: null,
    welcomeMode: 'always',
    deletePreviousWelcomeMessage: false,
    welcomeSentOnce: false,
    welcomeLastMessageId: null,
    goodbyeMessage: null,
    goodbyeMode: 'always',
    deletePreviousGoodbyeMessage: false,
    goodbyeSentOnce: false,
    goodbyeLastMessageId: null,
    rulesText: null,
  };
}

class SyntheticGroupStore implements WebAppGroupStore {
  public constructor(private readonly records: GroupRecord[]) {}

  public async listActive(scopedInstallationId: string): Promise<readonly GroupRecord[]> {
    return this.records.filter((group) => group.installationId === scopedInstallationId && group.isActive);
  }

  public async findByChatId(scopedInstallationId: string, chatId: bigint): Promise<GroupRecord | null> {
    return this.records.find(
      (group) => group.installationId === scopedInstallationId && group.telegramChatId === chatId,
    ) ?? null;
  }

  public async updateSettings(
    scopedInstallationId: string,
    chatId: bigint,
    expectedRevision: number,
    update: GroupSettingsUpdate,
  ): Promise<GroupRecord | null> {
    const group = await this.findByChatId(scopedInstallationId, chatId);
    if (!group || !group.isActive || group.settingsRevision !== expectedRevision) {
      return null;
    }
    const updated: GroupRecord = {
      ...group,
      ...(update.locale === undefined ? {} : { locale: update.locale }),
      ...(update.timeZone === undefined ? {} : { timeZone: update.timeZone }),
      ...(update.welcomeMessage === undefined ? {} : { welcomeMessage: update.welcomeMessage }),
      ...(update.welcomeMode === undefined ? {} : { welcomeMode: update.welcomeMode }),
      ...(update.deletePreviousWelcomeMessage === undefined ? {} : { deletePreviousWelcomeMessage: update.deletePreviousWelcomeMessage }),
      ...(update.goodbyeMessage === undefined ? {} : { goodbyeMessage: update.goodbyeMessage }),
      ...(update.goodbyeMode === undefined ? {} : { goodbyeMode: update.goodbyeMode }),
      ...(update.deletePreviousGoodbyeMessage === undefined ? {} : { deletePreviousGoodbyeMessage: update.deletePreviousGoodbyeMessage }),
      ...(update.rulesText === undefined ? {} : { rulesText: update.rulesText }),
      settingsRevision: group.settingsRevision + 1,
    };
    const index = this.records.indexOf(group);
    this.records[index] = updated;
    return updated;
  }
}

class SyntheticTelegramApi {
  public constructor(private readonly administrators: ReadonlySet<string>) {}

  public async getChatMember(chatId: number | string, userId: number): Promise<ChatMember> {
    if (this.administrators.has(`${chatId}:${userId}`)) {
      return { status: 'administrator' } as ChatMember;
    }
    return { status: 'member' } as ChatMember;
  }
}
