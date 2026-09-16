/** Names of environment variables that the minimal Telegram runtime requires. */
export const runtimeEnvironmentKeys = {
  telegramBotToken: 'FOAB_TELEGRAM_BOT_TOKEN',
} as const;

/** Validated configuration needed to start the Telegram bot process. */
export interface RuntimeConfig {
  readonly telegramBotToken: string;
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
 * @throws {ConfigurationError} If the token is absent, blank, or padded with whitespace.
 */
export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const tokenKey = runtimeEnvironmentKeys.telegramBotToken;
  const token = environment[tokenKey];

  if (token === undefined || token.trim().length === 0 || token !== token.trim()) {
    throw new ConfigurationError([tokenKey]);
  }

  return Object.freeze({ telegramBotToken: token });
}
