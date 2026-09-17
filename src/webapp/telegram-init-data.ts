import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_INIT_DATA_BYTES = 8_192;
const MAX_QUERY_ID_LENGTH = 256;
const MAX_LANGUAGE_CODE_LENGTH = 64;
const MAX_CLOCK_SKEW_SECONDS = 60;
const ALLOWED_FIELDS = new Set([
  'auth_date',
  'can_send_after',
  'chat',
  'chat_instance',
  'chat_join_request_query_id',
  'chat_type',
  'hash',
  'query_id',
  'receiver',
  'signature',
  'start_param',
  'user',
]);

/** Minimal identity established by a valid Telegram Mini App signature. */
export interface ValidatedWebAppUser {
  readonly id: number;
  readonly isBot: boolean;
  readonly languageCode: string | null;
}

/** Server-owned result of validating Telegram Web App init data. */
export interface ValidatedWebAppInitData {
  readonly user: ValidatedWebAppUser;
  readonly authDate: Date;
  readonly queryId: string | null;
}

/**
 * Validates Telegram Web App init data without trusting browser-provided roles,
 * chat IDs, or installation identifiers.
 *
 * @param rawInitData - The exact `Telegram.WebApp.initData` query string.
 * @param botToken - The server-held token for the current FOAB installation.
 * @param nowSeconds - Current Unix time; injectable for deterministic tests.
 * @param maxAgeSeconds - Maximum accepted age for the signed payload.
 * @returns The authenticated user and signed timestamp, or `null` on failure.
 */
export function validateTelegramWebAppInitData(
  rawInitData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
  maxAgeSeconds = 900,
): ValidatedWebAppInitData | null {
  if (
    rawInitData.length === 0 ||
    new TextEncoder().encode(rawInitData).length > MAX_INIT_DATA_BYTES ||
    botToken.length === 0 ||
    !Number.isSafeInteger(nowSeconds) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    maxAgeSeconds > 86_400
  ) {
    return null;
  }

  const params = new URLSearchParams(rawInitData);
  const pairs: string[] = [];
  let hash: string | null = null;
  const seenFields = new Set<string>();

  for (const [key, value] of params.entries()) {
    if (!ALLOWED_FIELDS.has(key) || seenFields.has(key)) {
      return null;
    }
    seenFields.add(key);
    if (key === 'hash') {
      hash = value;
      continue;
    }
    pairs.push(`${key}=${value}`);
  }

  if (!hash || !/^[a-f0-9]{64}$/u.test(hash) || !seenFields.has('auth_date') || !seenFields.has('user')) {
    return null;
  }

  const dataCheckString = pairs
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const receivedHash = Buffer.from(hash, 'hex');
  if (receivedHash.length !== expectedHash.length || !timingSafeEqual(receivedHash, expectedHash)) {
    return null;
  }

  const authDateValue = params.get('auth_date');
  const userValue = params.get('user');
  if (!authDateValue || !userValue || !/^[0-9]+$/u.test(authDateValue)) {
    return null;
  }

  const authDateSeconds = Number(authDateValue);
  if (
    !Number.isSafeInteger(authDateSeconds) ||
    authDateSeconds > nowSeconds + MAX_CLOCK_SKEW_SECONDS ||
    nowSeconds - authDateSeconds > maxAgeSeconds
  ) {
    return null;
  }

  const user = parseWebAppUser(userValue);
  if (!user) {
    return null;
  }

  const queryId = params.get('query_id');
  if (queryId !== null && (queryId.length === 0 || queryId.length > MAX_QUERY_ID_LENGTH)) {
    return null;
  }

  return {
    user,
    authDate: new Date(authDateSeconds * 1_000),
    queryId,
  };
}

/** Parses only the identity fields that the Web App backend actually needs. */
function parseWebAppUser(rawUser: string): ValidatedWebAppUser | null {
  let value: unknown;
  try {
    value = JSON.parse(rawUser) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }

  const id = value['id'];
  const isBot = value['is_bot'];
  const languageCode = value['language_code'];
  if (
    typeof id !== 'number' ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    (isBot !== undefined && typeof isBot !== 'boolean') ||
    (languageCode !== undefined &&
      (typeof languageCode !== 'string' || languageCode.length > MAX_LANGUAGE_CODE_LENGTH))
  ) {
    return null;
  }

  return {
    id,
    isBot: isBot ?? false,
    languageCode: languageCode ?? null,
  };
}

/** Narrows JSON.parse output without accepting arbitrary object spreading. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
