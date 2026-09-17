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

/** Safe reason codes that identify a configuration validation failure. */
export type ConfigurationIssueReason =
  | 'missing'
  | 'empty'
  | 'surrounding_whitespace'
  | 'invalid_url'
  | 'wrong_protocol'
  | 'missing_hostname'
  | 'missing_database_name'
  | 'missing_database_credentials'
  | 'embedded_credentials'
  | 'fragment_not_allowed'
  | 'invalid_host'
  | 'invalid_port';

/** A redacted configuration issue that never contains the rejected value. */
export interface ConfigurationIssue {
  readonly variableName: string;
  readonly reason: ConfigurationIssueReason;
  readonly diagnostics?: ConfigurationDiagnostics;
}

/** Non-sensitive shape hints for diagnosing a rejected Web App environment value. */
export interface ConfigurationDiagnostics {
  readonly valueLength: number;
  readonly startsWithHttps: boolean;
  readonly startsWithHttp: boolean;
  readonly looksLikeEnvironmentAssignment: boolean;
  readonly hasQuotes: boolean;
  readonly hasControlCharacters: boolean;
  readonly hasWhitespace: boolean;
  readonly hasNonAsciiCharacters: boolean;
  readonly hasBackslash: boolean;
  readonly hasPercentCharacter: boolean;
  readonly hasInvalidUrlPunctuation: boolean;
  readonly invalidUrlPunctuation: InvalidUrlPunctuationDiagnostic | null;
  readonly hasAuthorityColon: boolean;
  readonly hasNonNumericPort: boolean;
  readonly hasOutOfRangePort: boolean;
}

/** Identifies one non-secret invalid punctuation character without logging the URL. */
export interface InvalidUrlPunctuationDiagnostic {
  readonly kind:
    | 'less_than'
    | 'greater_than'
    | 'left_brace'
    | 'right_brace'
    | 'pipe'
    | 'caret'
    | 'backtick';
  readonly index: number;
}

/**
 * Reports invalid configuration using variable names and safe reason codes only.
 */
export class ConfigurationError extends Error {
  /** Environment variable names that are missing or invalid. */
  public readonly variableNames: readonly string[];
  /** Redacted issue details that never contain environment values. */
  public readonly issues: readonly ConfigurationIssue[];

  public constructor(issues: readonly ConfigurationIssue[]) {
    const variableNames = issues.map((issue) => issue.variableName);
    const details = issues.map((issue) => `${issue.variableName}:${issue.reason}`).join(', ');
    super(`Missing or invalid environment variables: ${details}`);
    this.name = 'ConfigurationError';
    this.variableNames = [...variableNames];
    this.issues = issues.map((issue) => ({ ...issue }));
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
  const issues: ConfigurationIssue[] = [];

  if (token === undefined) {
    issues.push({ variableName: tokenKey, reason: 'missing' });
  } else if (token.length === 0) {
    issues.push({ variableName: tokenKey, reason: 'empty' });
  } else if (token !== token.trim()) {
    issues.push({ variableName: tokenKey, reason: 'surrounding_whitespace' });
  }

  const databaseIssue = databaseUrl === undefined ? 'missing' : getPostgresUrlIssue(databaseUrl);
  if (databaseIssue !== null) {
    issues.push({ variableName: databaseUrlKey, reason: databaseIssue });
  }

  if (!isValidWebAppHost(webAppHost)) {
    issues.push({ variableName: webAppHostKey, reason: 'invalid_host' });
  }

  if (!isValidWebAppPort(webAppPort)) {
    issues.push({ variableName: webAppPortKey, reason: 'invalid_port' });
  }

  const webAppIssue = webAppUrl === undefined ? null : getWebAppUrlIssue(webAppUrl);
  if (webAppIssue !== null) {
    issues.push({
      variableName: webAppUrlKey,
      reason: webAppIssue,
      ...(webAppUrl === undefined ? {} : { diagnostics: getConfigurationDiagnostics(webAppUrl) }),
    });
  }

  if (issues.length > 0 || token === undefined || databaseUrl === undefined) {
    throw new ConfigurationError(issues);
  }

  return Object.freeze({
    telegramBotToken: token,
    databaseUrl,
    webAppHost,
    webAppPort: Number(webAppPort),
    webAppUrl: webAppUrl ?? null,
  });
}

/** Builds redacted shape hints without returning or logging the rejected value. */
function getConfigurationDiagnostics(value: string): ConfigurationDiagnostics {
  const authority = value.slice('https://'.length).split(/[/?#]/u, 1)[0] ?? '';
  const authorityColonIndex = authority.lastIndexOf(':');
  const hasAuthorityColon = value.startsWith('https://') && authorityColonIndex >= 0 && !authority.startsWith('[');
  const portText = hasAuthorityColon ? authority.slice(authorityColonIndex + 1) : '';
  const hasNonNumericPort = hasAuthorityColon && !/^\d+$/u.test(portText);
  const hasOutOfRangePort = hasAuthorityColon && /^\d+$/u.test(portText) && Number(portText) > 65_535;
  const invalidUrlPunctuation = findInvalidUrlPunctuation(value);

  return {
    valueLength: value.length,
    startsWithHttps: value.startsWith('https://'),
    startsWithHttp: value.startsWith('http://'),
    looksLikeEnvironmentAssignment: /^[A-Za-z_][A-Za-z0-9_]*=/u.test(value),
    hasQuotes: value.includes('"') || value.includes("'"),
    hasControlCharacters: /[\u0000-\u001F\u007F]/u.test(value),
    hasWhitespace: /\s/u.test(value),
    hasNonAsciiCharacters: /[^\x00-\x7F]/u.test(value),
    hasBackslash: value.includes('\\'),
    hasPercentCharacter: value.includes('%'),
    hasInvalidUrlPunctuation: invalidUrlPunctuation !== null,
    invalidUrlPunctuation,
    hasAuthorityColon,
    hasNonNumericPort,
    hasOutOfRangePort,
  };
}

/** Returns the first prohibited punctuation marker as a safe category and index. */
function findInvalidUrlPunctuation(value: string): InvalidUrlPunctuationDiagnostic | null {
  const punctuationKinds = new Map<string, InvalidUrlPunctuationDiagnostic['kind']>([
    ['<', 'less_than'],
    ['>', 'greater_than'],
    ['{', 'left_brace'],
    ['}', 'right_brace'],
    ['|', 'pipe'],
    ['^', 'caret'],
    ['`', 'backtick'],
  ]);

  for (const [index, character] of [...value].entries()) {
    const kind = punctuationKinds.get(character);
    if (kind !== undefined) {
      return { kind, index };
    }
  }
  return null;
}

/** Returns a safe reason for a malformed PostgreSQL URL without exposing its value. */
function getPostgresUrlIssue(value: string): ConfigurationIssueReason | null {
  if (value.length === 0) {
    return 'empty';
  }
  if (value.trim() !== value) {
    return 'surrounding_whitespace';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return 'wrong_protocol';
    }
    if (url.hostname.length === 0) {
      return 'missing_hostname';
    }
    if (url.pathname.length <= 1) {
      return 'missing_database_name';
    }
    if (url.username.length === 0 || url.password.length === 0) {
      return 'missing_database_credentials';
    }
    return null;
  } catch {
    return 'invalid_url';
  }
}

/** Returns a safe reason for an invalid HTTPS Mini App URL without exposing its value. */
function getWebAppUrlIssue(value: string): ConfigurationIssueReason | null {
  if (value.length === 0) {
    return 'empty';
  }
  if (value.trim() !== value) {
    return 'surrounding_whitespace';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return 'wrong_protocol';
    }
    if (url.hostname.length === 0) {
      return 'missing_hostname';
    }
    if (url.username.length > 0 || url.password.length > 0) {
      return 'embedded_credentials';
    }
    if (url.hash.length > 0) {
      return 'fragment_not_allowed';
    }
    return null;
  } catch {
    return 'invalid_url';
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
