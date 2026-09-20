import type { UiLocale } from './messages.js';

export type MessageDeliveryMode = 'always' | 'first';

/** Safe user identity returned by the server-side session endpoint. */
export interface SessionUser {
  readonly id: number;
  readonly languageCode: string | null;
  readonly privateLocale: UiLocale;
}

/** Browser-visible authenticated session state. */
export interface SessionState {
  readonly user: SessionUser;
  readonly csrfToken?: string;
  readonly expiresAt: string;
}

/** Safe group settings DTO returned by the API. */
export interface GroupSettings {
  readonly chatId: string;
  readonly chatType: 'group' | 'supergroup';
  readonly title: string;
  readonly username: string | null;
  readonly locale: UiLocale;
  readonly timeZone: string;
  readonly settingsRevision: number;
  readonly welcomeMessage: string | null;
  readonly welcomeEnabled: boolean;
  readonly welcomeMode: MessageDeliveryMode;
  readonly deletePreviousWelcomeMessage: boolean;
  readonly goodbyeMessage: string | null;
  readonly goodbyeEnabled: boolean;
  readonly goodbyeMode: MessageDeliveryMode;
  readonly deletePreviousGoodbyeMessage: boolean;
  readonly rulesText: string | null;
}

/** Allowlisted group settings that the authenticated administrator may edit. */
export interface GroupSettingsUpdate {
  readonly locale?: UiLocale;
  readonly timeZone?: string;
  readonly welcomeMessage?: string | null;
  readonly welcomeEnabled?: boolean;
  readonly welcomeMode?: MessageDeliveryMode;
  readonly deletePreviousWelcomeMessage?: boolean;
  readonly goodbyeMessage?: string | null;
  readonly goodbyeEnabled?: boolean;
  readonly goodbyeMode?: MessageDeliveryMode;
  readonly deletePreviousGoodbyeMessage?: boolean;
  readonly rulesText?: string | null;
}

/** Structured API failure without framework or database details. */
export class WebAppApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string) {
    super(code);
    this.name = 'WebAppApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Typed client for the same-origin FOAB Mini App API. */
export class WebAppApiClient {
  private csrfToken: string | null = null;

  /** Exchanges the exact Telegram bridge value for a server-side session. */
  public async createSession(initData: string): Promise<SessionState> {
    const result = await this.request('/api/session', {
      body: JSON.stringify({ initData }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const session = parseSession(result);
    this.csrfToken = session.csrfToken ?? readCookie('foab_csrf');
    return session;
  }

  /** Restores a live HttpOnly session after a page reload. */
  public async getSession(): Promise<SessionState> {
    const result = await this.request('/api/session', { method: 'GET' });
    const session = parseSession(result);
    this.csrfToken = readCookie('foab_csrf');
    return session;
  }

  /** Lists only groups for which the server confirms current administrator access. */
  public async listGroups(): Promise<readonly GroupSettings[]> {
    const result = await this.request('/api/groups', { method: 'GET' });
    if (!isRecord(result) || !Array.isArray(result['groups'])) {
      throw new WebAppApiError(502, 'invalid_response');
    }
    const groups: GroupSettings[] = [];
    for (const value of result['groups']) {
      const group = parseGroup(value);
      if (!group) {
        throw new WebAppApiError(502, 'invalid_response');
      }
      groups.push(group);
    }
    return groups;
  }

  /** Applies an allowlisted settings patch using the revision shown by the UI. */
  public async updateSettings(
    group: GroupSettings,
    update: GroupSettingsUpdate,
  ): Promise<GroupSettings> {
    const csrfToken = this.csrfToken ?? readCookie('foab_csrf');
    if (!csrfToken) {
      throw new WebAppApiError(401, 'unauthorized');
    }
    const result = await this.request(`/api/groups/${encodeURIComponent(group.chatId)}/settings`, {
      body: JSON.stringify({ expectedRevision: group.settingsRevision, ...update }),
      headers: {
        'content-type': 'application/json',
        'x-foab-csrf': csrfToken,
      },
      method: 'PATCH',
    });
    if (!isRecord(result)) {
      throw new WebAppApiError(502, 'invalid_response');
    }
    const updated = parseGroup(result['group']);
    if (!updated) {
      throw new WebAppApiError(502, 'invalid_response');
    }
    return updated;
  }

  /** Saves the authenticated user's private-chat language preference. */
  public async updatePrivateLocale(locale: UiLocale): Promise<UiLocale> {
    const csrfToken = this.csrfToken ?? readCookie('foab_csrf');
    if (!csrfToken) {
      throw new WebAppApiError(401, 'unauthorized');
    }
    const result = await this.request('/api/preferences', {
      body: JSON.stringify({ locale }),
      headers: {
        'content-type': 'application/json',
        'x-foab-csrf': csrfToken,
      },
      method: 'PATCH',
    });
    if (!isRecord(result) || !isUiLocale(result['privateLocale'])) {
      throw new WebAppApiError(502, 'invalid_response');
    }
    return result['privateLocale'];
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(path, { ...init, credentials: 'same-origin' });
    } catch {
      throw new WebAppApiError(0, 'network_error');
    }

    let body: unknown = null;
    if (response.status !== 204) {
      try {
        body = await response.json() as unknown;
      } catch {
        throw new WebAppApiError(response.status, 'invalid_response');
      }
    }
    if (!response.ok) {
      throw new WebAppApiError(response.status, readErrorCode(body));
    }
    return body;
  }
}

/** Parses the intentionally small session DTO from an untrusted response. */
function parseSession(value: unknown): SessionState {
  if (!isRecord(value) || !isRecord(value['user'])) {
    throw new WebAppApiError(502, 'invalid_response');
  }
  const user = value['user'];
  const id = user['id'];
  const languageCode = user['languageCode'];
  const privateLocale = user['privateLocale'];
  const csrfToken = value['csrfToken'];
  const expiresAt = value['expiresAt'];
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    (languageCode !== null && typeof languageCode !== 'string') ||
    !isUiLocale(privateLocale) ||
    (csrfToken !== undefined && !isOpaqueToken(csrfToken)) ||
    typeof expiresAt !== 'string'
  ) {
    throw new WebAppApiError(502, 'invalid_response');
  }
  return {
    ...(csrfToken === undefined ? {} : { csrfToken }),
    expiresAt,
    user: { id, languageCode, privateLocale },
  };
}

/** Parses the allowlisted group DTO and rejects server contract drift. */
function parseGroup(value: unknown): GroupSettings | null {
  if (!isRecord(value)) {
    return null;
  }
  const chatId = value['chatId'];
  const chatType = value['chatType'];
  const title = value['title'];
  const username = value['username'];
  const locale = value['locale'];
  const timeZone = value['timeZone'];
  const settingsRevision = value['settingsRevision'];
  const welcomeMessage = value['welcomeMessage'];
  const welcomeEnabled = value['welcomeEnabled'];
  const welcomeMode = value['welcomeMode'];
  const deletePreviousWelcomeMessage = value['deletePreviousWelcomeMessage'];
  const goodbyeMessage = value['goodbyeMessage'];
  const goodbyeEnabled = value['goodbyeEnabled'];
  const goodbyeMode = value['goodbyeMode'];
  const deletePreviousGoodbyeMessage = value['deletePreviousGoodbyeMessage'];
  const rulesText = value['rulesText'];
  if (
    typeof chatId !== 'string' ||
    !/^-?[0-9]{1,20}$/u.test(chatId) ||
    chatId.startsWith('0') ||
    chatId === '-0' ||
    !chatId.startsWith('-') ||
    (chatType !== 'group' && chatType !== 'supergroup') ||
    typeof title !== 'string' ||
    (username !== null && typeof username !== 'string') ||
    typeof locale !== 'string' ||
    !isUiLocale(locale) ||
    typeof timeZone !== 'string' ||
    !isNullableConfigurationText(welcomeMessage) ||
    typeof welcomeEnabled !== 'boolean' ||
    (welcomeMode !== 'always' && welcomeMode !== 'first') ||
    typeof deletePreviousWelcomeMessage !== 'boolean' ||
    !isNullableConfigurationText(goodbyeMessage) ||
    typeof goodbyeEnabled !== 'boolean' ||
    (goodbyeMode !== 'always' && goodbyeMode !== 'first') ||
    typeof deletePreviousGoodbyeMessage !== 'boolean' ||
    !isNullableConfigurationText(rulesText) ||
    typeof settingsRevision !== 'number' ||
    !Number.isSafeInteger(settingsRevision) ||
    settingsRevision < 0
  ) {
    return null;
  }
  return {
    chatId,
    chatType,
    goodbyeMessage,
    goodbyeEnabled,
    goodbyeMode,
    deletePreviousGoodbyeMessage,
    locale,
    rulesText,
    settingsRevision,
    timeZone,
    title,
    username,
    welcomeMessage,
    welcomeEnabled,
    welcomeMode,
    deletePreviousWelcomeMessage,
  };
}

/** Rejects malformed or oversized configuration text returned by the server. */
function isNullableConfigurationText(value: unknown): value is string | null {
  return value === null || (
    typeof value === 'string' &&
    value.length <= 4_096 &&
    !value.includes('\u0000')
  );
}

/** Narrows the API locale string to the shared UI union. */
function isUiLocale(value: unknown): value is UiLocale {
  return value === 'en-US' || value === 'pt-BR' || value === 'es-ES';
}

/** Reads only machine error codes returned by the API. */
function readErrorCode(value: unknown): string {
  if (isRecord(value) && typeof value['error'] === 'string' && /^[a-z_]{1,64}$/u.test(value['error'])) {
    return value['error'];
  }
  return 'request_failed';
}

/** Reads the non-HttpOnly same-origin CSRF cookie after session restoration. */
function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const cookie of document.cookie.split(';')) {
    const value = cookie.trim();
    if (value.startsWith(prefix)) {
      return decodeCookie(value.slice(prefix.length));
    }
  }
  return null;
}

/** Decodes cookie syntax without turning malformed browser data into an exception. */
function decodeCookie(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return isOpaqueToken(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

/** Recognizes the fixed-size opaque values issued by the server. */
function isOpaqueToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value);
}

/** Narrows parsed JSON objects without accepting arrays or primitives. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
