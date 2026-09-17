import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import type {
  GroupRecord,
  GroupSettingsUpdate,
} from '../db/group-repository.js';
import { isGroupAdministrator, type GroupMemberLookup } from '../telegram/authorization.js';
import { parseSupportedLocale, isSupportedTimeZone } from '../telegram/commands.js';
import { validateTelegramWebAppInitData } from './telegram-init-data.js';
import { WebAppSessionStore, type WebAppSession } from './session-store.js';

const SESSION_COOKIE_NAME = 'foab_session';
const CSRF_COOKIE_NAME = 'foab_csrf';
const CSRF_HEADER_NAME = 'x-foab-csrf';
const MAX_JSON_BODY_BYTES = 16_384;
const TELEGRAM_INT64_MIN = -9_223_372_036_854_775_808n;
const TELEGRAM_INT64_MAX = 9_223_372_036_854_775_807n;

/** Database operations required by the Mini App without exposing an unscoped query. */
export interface WebAppGroupStore {
  readonly listActive: (
    installationId: string,
    limit?: number,
  ) => Promise<readonly GroupRecord[]>;
  readonly findByChatId: (
    installationId: string,
    telegramChatId: bigint,
  ) => Promise<GroupRecord | null>;
  readonly updateSettings: (
    installationId: string,
    telegramChatId: bigint,
    expectedRevision: number,
    update: GroupSettingsUpdate,
  ) => Promise<GroupRecord | null>;
}

/** Dependencies owned by the running FOAB installation. */
export interface WebAppServerDependencies {
  readonly botToken: string;
  readonly installationId: string;
  readonly webAppUrl: string;
  readonly groups: WebAppGroupStore;
  readonly telegram: GroupMemberLookup;
  readonly sessions?: WebAppSessionStore;
  readonly clock?: () => Date;
}

/** Minimal browser-visible session response; the cookie remains HttpOnly. */
export interface WebAppSessionResponse {
  readonly user: {
    readonly id: number;
    readonly languageCode: string | null;
  };
  readonly csrfToken: string;
  readonly expiresAt: string;
}

/** Allowlisted group fields exposed to the Mini App. */
export interface WebAppGroupResponse {
  readonly chatId: string;
  readonly chatType: GroupRecord['chatType'];
  readonly title: string;
  readonly locale: string;
  readonly timeZone: string;
  readonly settingsRevision: number;
}

/** Creates the schema-validated Mini App API with secure browser boundaries. */
export function createWebAppServer(
  dependencies: WebAppServerDependencies,
): FastifyInstance {
  const origin = getHttpsOrigin(dependencies.webAppUrl);
  const webAppPath = getWebAppPath(dependencies.webAppUrl);
  const sessions = dependencies.sessions ?? new WebAppSessionStore();
  const clock = dependencies.clock ?? (() => new Date());
  const app = fastify({
    bodyLimit: MAX_JSON_BODY_BYTES,
    logger: false,
    trustProxy: false,
  });

  void app.register(cookie);
  registerBuiltWebApp(app, webAppPath);
  app.addHook('onSend', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Content-Security-Policy', contentSecurityPolicy());
    reply.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
  });
  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode = getSafeErrorStatusCode(error);
    sendApiError(reply, statusCode, statusCode === 413 ? 'payload_too_large' : 'server_error');
  });

  app.get('/healthz', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  app.post('/api/session', async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    if (!isExactOrigin(request, origin) || !isJsonRequest(request)) {
      return sendApiError(reply, 403, 'origin_denied');
    }
    const body = parseSessionBody(request.body);
    if (!body) {
      return sendApiError(reply, 400, 'invalid_request');
    }

    const validated = validateTelegramWebAppInitData(
      body.initData,
      dependencies.botToken,
      Math.floor(clock().getTime() / 1_000),
    );
    if (!validated || validated.user.isBot) {
      return sendApiError(reply, 401, 'invalid_telegram_session');
    }

    try {
      const created = sessions.create({
        id: validated.user.id,
        languageCode: validated.user.languageCode,
      }, clock());
      reply.setCookie(SESSION_COOKIE_NAME, created.sessionToken, {
        httpOnly: true,
        maxAge: 60 * 60,
        path: '/',
        sameSite: 'strict',
        secure: true,
      });
      reply.setCookie(CSRF_COOKIE_NAME, created.csrfToken, {
        httpOnly: false,
        maxAge: 60 * 60,
        path: '/',
        sameSite: 'strict',
        secure: true,
      });
      return reply.code(201).send(toSessionResponse(created.session, created.csrfToken));
    } catch {
      return sendApiError(reply, 503, 'session_unavailable');
    }
  });

  app.get('/api/session', async (request, reply) => {
    if (!isPermittedOrigin(request, origin)) {
      return sendApiError(reply, 403, 'origin_denied');
    }
    const session = getSession(request, sessions, clock());
    if (!session) {
      return sendApiError(reply, 401, 'unauthorized');
    }
    return reply.send(toSessionIdentity(session));
  });

  app.delete('/api/session', async (request, reply) => {
    if (!isExactOrigin(request, origin)) {
      return sendApiError(reply, 403, 'origin_denied');
    }
    const sessionToken = getSessionCookie(request);
    const session = sessionToken ? sessions.get(sessionToken, clock()) : null;
    if (session && !hasValidCsrf(request, sessions, session)) {
      return sendApiError(reply, 403, 'csrf_denied');
    }
    if (sessionToken) {
      sessions.revoke(sessionToken);
    }
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    reply.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/api/groups', async (request, reply) => {
    if (!isPermittedOrigin(request, origin)) {
      return sendApiError(reply, 403, 'origin_denied');
    }
    const session = getSession(request, sessions, clock());
    if (!session) {
      return sendApiError(reply, 401, 'unauthorized');
    }

    const activeGroups = await dependencies.groups.listActive(dependencies.installationId, 100);
    const groups: WebAppGroupResponse[] = [];
    for (const group of activeGroups) {
      if (await isGroupAdministrator(dependencies.telegram, group.telegramChatId, session.user.id)) {
        groups.push(toGroupResponse(group));
      }
    }
    return reply.send({ groups });
  });

  app.patch('/api/groups/:chatId/settings', async (
    request: FastifyRequest<{ Params: { chatId: string }; Body: unknown }>,
    reply,
  ) => {
    if (!isExactOrigin(request, origin) || !isJsonRequest(request)) {
      return sendApiError(reply, 403, 'origin_denied');
    }
    const session = getSession(request, sessions, clock());
    if (!session) {
      return sendApiError(reply, 401, 'unauthorized');
    }
    if (!hasValidCsrf(request, sessions, session)) {
      return sendApiError(reply, 403, 'csrf_denied');
    }

    const chatId = parseGroupChatId(request.params.chatId);
    const patch = parseSettingsPatch(request.body);
    if (chatId === null || patch === null) {
      return sendApiError(reply, 400, 'invalid_request');
    }

    const group = await dependencies.groups.findByChatId(dependencies.installationId, chatId);
    if (
      !group ||
      !group.isActive ||
      !(await isGroupAdministrator(dependencies.telegram, chatId, session.user.id))
    ) {
      return sendApiError(reply, 403, 'forbidden');
    }

    const updated = await dependencies.groups.updateSettings(
      dependencies.installationId,
      chatId,
      patch.expectedRevision,
      patch.update,
    );
    if (!updated) {
      return sendApiError(reply, 409, 'revision_conflict');
    }
    return reply.send({ group: toGroupResponse(updated) });
  });

  return app;
}

/** Serves the built Mini App when the repository's production bundle exists. */
function registerBuiltWebApp(app: FastifyInstance, webAppPath: string): void {
  const webAppRoot = fileURLToPath(new URL('../../webapp/dist/', import.meta.url));
  if (!existsSync(webAppRoot)) {
    return;
  }
  void app.register(fastifyStatic, {
    index: 'index.html',
    prefix: webAppPath,
    root: webAppRoot,
  });
}

/** Produces a response that cannot reveal implementation or input details. */
function sendApiError(reply: FastifyReply, statusCode: number, code: string) {
  return reply.code(statusCode).send({ error: code });
}

/** Converts a server-owned session into the browser contract. */
function toSessionResponse(
  session: WebAppSession,
  csrfToken: string,
): WebAppSessionResponse {
  return {
    user: {
      id: session.user.id,
      languageCode: session.user.languageCode,
    },
    csrfToken,
    expiresAt: session.expiresAt.toISOString(),
  };
}

/** Converts a session into a safe identity response without its CSRF secret. */
function toSessionIdentity(
  session: WebAppSession,
): Pick<WebAppSessionResponse, 'user' | 'expiresAt'> {
  return {
    user: {
      id: session.user.id,
      languageCode: session.user.languageCode,
    },
    expiresAt: session.expiresAt.toISOString(),
  };
}

/** Converts only the fields needed by the settings UI. */
function toGroupResponse(group: GroupRecord): WebAppGroupResponse {
  return {
    chatId: group.telegramChatId.toString(),
    chatType: group.chatType,
    title: group.title,
    locale: group.locale,
    timeZone: group.timeZone,
    settingsRevision: group.settingsRevision,
  };
}

/** Resolves the cookie without exposing cookie-parser internals to route code. */
function getSessionCookie(request: FastifyRequest): string | null {
  const value = request.cookies[SESSION_COOKIE_NAME];
  return typeof value === 'string' ? value : null;
}

/** Gets a server-side session from the opaque HttpOnly cookie. */
function getSession(
  request: FastifyRequest,
  sessions: WebAppSessionStore,
  now: Date,
): WebAppSession | null {
  const token = getSessionCookie(request);
  return token ? sessions.get(token, now) : null;
}

/** Checks the CSRF header against the authenticated session record. */
function hasValidCsrf(
  request: FastifyRequest,
  sessions: WebAppSessionStore,
  session: WebAppSession,
): boolean {
  const value = request.headers[CSRF_HEADER_NAME];
  return typeof value === 'string' && sessions.validateCsrf(session, value);
}

/** Requires an exact configured origin on state-changing requests. */
function isExactOrigin(request: FastifyRequest, origin: string): boolean {
  return request.headers.origin === origin;
}

/** Rejects an explicitly supplied foreign origin while allowing same-origin GET fetches. */
function isPermittedOrigin(request: FastifyRequest, origin: string): boolean {
  const requestOrigin = request.headers.origin;
  return requestOrigin === undefined || requestOrigin === origin;
}

/** Requires JSON for bodies so alternate parsers cannot change the contract. */
function isJsonRequest(request: FastifyRequest): boolean {
  const contentType = request.headers['content-type'];
  return typeof contentType === 'string' && contentType.toLowerCase().startsWith('application/json');
}

/** Validates the exact session creation body and its bounded raw init-data field. */
function parseSessionBody(value: unknown): { readonly initData: string } | null {
  if (!isRecord(value) || !hasExactKeys(value, ['initData'])) {
    return null;
  }
  const initData = value['initData'];
  return typeof initData === 'string' && initData.length > 0 && initData.length <= 8_192
    ? { initData }
    : null;
}

/** Validates the exact optimistic settings patch accepted by the API. */
function parseSettingsPatch(value: unknown): {
  readonly expectedRevision: number;
  readonly update: GroupSettingsUpdate;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  const keys = Object.keys(value);
  const allowedKeys = new Set(['expectedRevision', 'locale', 'timeZone']);
  if (keys.some((key) => !allowedKeys.has(key)) || !keys.includes('expectedRevision')) {
    return null;
  }

  const expectedRevision = value['expectedRevision'];
  if (
    typeof expectedRevision !== 'number' ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision > 2_147_483_647
  ) {
    return null;
  }

  const localeValue = value['locale'];
  const timeZoneValue = value['timeZone'];
  const locale = typeof localeValue === 'string' ? parseSupportedLocale(localeValue) : null;
  const timeZone = typeof timeZoneValue === 'string' && isSupportedTimeZone(timeZoneValue)
    ? timeZoneValue
    : null;
  if (localeValue !== undefined && locale === null) {
    return null;
  }
  if (timeZoneValue !== undefined && timeZone === null) {
    return null;
  }
  if (locale === null && timeZone === null) {
    return null;
  }

  return {
    expectedRevision,
    update: {
      ...(locale === null ? {} : { locale }),
      ...(timeZone === null ? {} : { timeZone }),
    },
  };
}

/** Parses only negative Telegram group IDs within the signed 64-bit range. */
function parseGroupChatId(value: string): bigint | null {
  if (!/^-?[0-9]{1,20}$/u.test(value)) {
    return null;
  }
  try {
    const chatId = BigInt(value);
    return chatId < 0n && chatId >= TELEGRAM_INT64_MIN && chatId <= TELEGRAM_INT64_MAX
      ? chatId
      : null;
  } catch {
    return null;
  }
}

/** Allows JSON objects while rejecting arrays and primitive request bodies. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Preserves only bounded client-error status codes from the framework. */
function getSafeErrorStatusCode(value: unknown): number {
  if (!isRecord(value)) {
    return 500;
  }
  const statusCode = value['statusCode'];
  return typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500
    ? statusCode
    : 500;
}

/** Applies an exact-key contract rather than accepting arbitrary object fields. */
function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
}

/** Validates the configured HTTPS origin before the server can accept sessions. */
function getHttpsOrigin(webAppUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(webAppUrl);
  } catch {
    throw new Error('The Mini App URL is invalid.');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new Error('The Mini App URL must be an HTTPS URL without credentials or a fragment.');
  }
  return parsed.origin;
}

/** Converts a configured Mini App path into a safe static mount prefix. */
function getWebAppPath(webAppUrl: string): string {
  const parsed = new URL(webAppUrl);
  const path = parsed.pathname.replace(/\/+$/u, '');
  return path.length === 0 ? '/' : path;
}

/** Limits browser capabilities and permits only the Telegram Web App bridge script. */
function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
  ].join('; ');
}
