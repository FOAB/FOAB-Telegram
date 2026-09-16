/** Names of environment variables that the minimal Telegram runtime requires. */
export const runtimeEnvironmentKeys = {
  telegramBotToken: 'FOAB_TELEGRAM_BOT_TOKEN',
  databaseUrl: 'FOAB_DATABASE_URL',
  webAppHost: 'FOAB_WEB_APP_HOST',
  webAppPort: 'FOAB_WEB_APP_PORT',
  webAppUrl: 'FOAB_WEB_APP_URL',
} as const;

/** Validated configuration needed to start the Telegram bot process. */
export interface RuntimeConfig {
  readonly telegramBotToken: string;
  readonly databaseUrl: string;
  readonly webAppHost: string;
  readonly webAppPort: number;
  readonly webAppUrl: string | null;
}

/**
 * Reports invalid configuration using variable names only, never their values.
 */
export class ConfigurationError extends Error {
  /** Environment variable names that are missing or invalid. */
  public readonly variableNames: readonly string[];

  public constructor(variableNames: readonly string[]) {
    super(`Missing or invalid environment variables: ${variableNames.join(', ')}`);
    this.name = 'ConfigurationError';
    this.variableNames = [...variableNames];
  }
}

/**
 * Validates the minimum runtime configuration before any network connection starts.
 *
 * @param environment - Environment values to validate; tests pass synthetic values.
 * @returns An immutable configuration object containing only the required bot token.
 * @throws {ConfigurationError} If the token or PostgreSQL URL is missing or malformed.
 */
export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const tokenKey = runtimeEnvironmentKeys.telegramBotToken;
  const databaseUrlKey = runtimeEnvironmentKeys.databaseUrl;
  const webAppHostKey = runtimeEnvironmentKeys.webAppHost;
  const webAppPortKey = runtimeEnvironmentKeys.webAppPort;
  const webAppUrlKey = runtimeEnvironmentKeys.webAppUrl;
  const token = environment[tokenKey];
  const databaseUrl = environment[databaseUrlKey];
  const webAppHost = environment[webAppHostKey] ?? '127.0.0.1';
  const webAppPort = environment[webAppPortKey] ?? '3000';
  const webAppUrl = environment[webAppUrlKey];
  const invalidVariables: string[] = [];

  if (token === undefined || token.trim().length === 0 || token !== token.trim()) {
    invalidVariables.push(tokenKey);
  }

  if (databaseUrl === undefined || !isValidPostgresUrl(databaseUrl)) {
    invalidVariables.push(databaseUrlKey);
  }

  if (!isValidWebAppHost(webAppHost)) {
    invalidVariables.push(webAppHostKey);
  }

  if (!isValidWebAppPort(webAppPort)) {
    invalidVariables.push(webAppPortKey);
  }

  if (webAppUrl !== undefined && !isValidWebAppUrl(webAppUrl)) {
    invalidVariables.push(webAppUrlKey);
  }

  if (invalidVariables.length > 0 || token === undefined || databaseUrl === undefined) {
    throw new ConfigurationError(invalidVariables);
  }

  return Object.freeze({
    telegramBotToken: token,
    databaseUrl,
    webAppHost,
    webAppPort: Number(webAppPort),
    webAppUrl: webAppUrl ?? null,
  });
}

/** Validates URL shape without retaining or exposing any credential component. */
function isValidPostgresUrl(value: string): boolean {
  if (value.trim() !== value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'postgres:' || url.protocol === 'postgresql:') &&
      url.hostname.length > 0 &&
      url.pathname.length > 1 &&
      url.username.length > 0 &&
      url.password.length > 0
    );
  } catch {
    return false;
  }
}

/** Validates an optional HTTPS Mini App origin without accepting embedded credentials. */
function isValidWebAppUrl(value: string): boolean {
  if (value.trim() !== value) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0 &&
      url.hash.length === 0
    );
  } catch {
    return false;
  }
}

/** Validates a bind host without allowing a URL or shell-like delimiter. */
function isValidWebAppHost(value: string): boolean {
  return value.length > 0 && value.length <= 253 && /^[A-Za-z0-9.:[\]_-]+$/u.test(value);
}

/** Validates a TCP port using decimal syntax and the non-reserved range. */
function isValidWebAppPort(value: string): boolean {
  if (!/^[0-9]{1,5}$/u.test(value)) {
    return false;
  }
  const port = Number(value);
  return Number.isInteger(port) && port >= 1_024 && port <= 65_535;
}
