/** Names of environment variables that the minimal Telegram runtime requires. */
export const runtimeEnvironmentKeys = {
  telegramBotToken: 'FOAB_TELEGRAM_BOT_TOKEN',
  databaseUrl: 'FOAB_DATABASE_URL',
} as const;

/** Validated configuration needed to start the Telegram bot process. */
export interface RuntimeConfig {
  readonly telegramBotToken: string;
  readonly databaseUrl: string;
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
  const token = environment[tokenKey];
  const databaseUrl = environment[databaseUrlKey];
  const invalidVariables: string[] = [];

  if (token === undefined || token.trim().length === 0 || token !== token.trim()) {
    invalidVariables.push(tokenKey);
  }

  if (databaseUrl === undefined || !isValidPostgresUrl(databaseUrl)) {
    invalidVariables.push(databaseUrlKey);
  }

  if (invalidVariables.length > 0 || token === undefined || databaseUrl === undefined) {
    throw new ConfigurationError(invalidVariables);
  }

  return Object.freeze({ telegramBotToken: token, databaseUrl });
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
