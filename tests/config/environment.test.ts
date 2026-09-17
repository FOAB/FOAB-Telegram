import { describe, expect, it } from 'vitest';
import {
  ConfigurationError,
  loadRuntimeConfig,
  runtimeEnvironmentKeys,
} from '../../src/config/environment.js';

const embeddedCredentialUrl = ['https://user', ':', 'password', '@miniapp.example.invalid/foab'].join('');

describe('runtime environment validation', () => {
  it('accepts a synthetic bot token without making a network request', () => {
    const config = loadRuntimeConfig({
      [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
      [runtimeEnvironmentKeys.databaseUrl]:
        'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
    });

    expect(config.telegramBotToken).toBe('synthetic-token-value');
    expect(config.databaseUrl).toContain('/synthetic_db');
    expect(config.webAppHost).toBe('127.0.0.1');
    expect(config.webAppPort).toBe(3000);
    expect(config.webAppUrl).toBeNull();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('accepts an optional HTTPS Mini App URL without making a network request', () => {
    const config = loadRuntimeConfig({
      [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
      [runtimeEnvironmentKeys.databaseUrl]:
        'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
      [runtimeEnvironmentKeys.webAppHost]: '127.0.0.1',
      [runtimeEnvironmentKeys.webAppPort]: '4444',
      [runtimeEnvironmentKeys.webAppUrl]: 'https://miniapp.example.invalid/foab',
    });

    expect(config.webAppHost).toBe('127.0.0.1');
    expect(config.webAppPort).toBe(4444);
    expect(config.webAppUrl).toBe('https://miniapp.example.invalid/foab');
  });

  it.each([
    [runtimeEnvironmentKeys.webAppHost, 'https://miniapp.example.invalid'],
    [runtimeEnvironmentKeys.webAppHost, 'host with spaces'],
    [runtimeEnvironmentKeys.webAppPort, '0'],
    [runtimeEnvironmentKeys.webAppPort, '65536'],
    [runtimeEnvironmentKeys.webAppPort, 'port'],
  ])('rejects an invalid optional Web App listener value', (key, value) => {
    const error = captureConfigurationError(() =>
      loadRuntimeConfig({
        [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
        [runtimeEnvironmentKeys.databaseUrl]:
          'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
        [key]: value,
      }),
    );

    expect(error.variableNames).toContain(key);
  });

  it.each([undefined, '', '   ', ' token-with-padding '])(
    'rejects missing or malformed bot token values without echoing them',
    (token) => {
      const error = captureConfigurationError(() =>
        loadRuntimeConfig({
          [runtimeEnvironmentKeys.telegramBotToken]: token,
          [runtimeEnvironmentKeys.databaseUrl]:
            'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
        }),
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain(runtimeEnvironmentKeys.telegramBotToken);
      expect(error.message).not.toContain('token-with-padding');
      expect(error.issues[0]?.reason).toBe(
        token === undefined ? 'missing' : token.length === 0 ? 'empty' : 'surrounding_whitespace',
      );
    },
  );

  it.each([
    [undefined, 'missing'],
    ['', 'empty'],
    ['not-a-url', 'invalid_url'],
    ['https://example.invalid/path', 'wrong_protocol'],
  ] as const) (
    'rejects an absent or invalid database URL without echoing it',
    (databaseUrl, expectedReason) => {
      const error = captureConfigurationError(() =>
        loadRuntimeConfig({
          [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
          [runtimeEnvironmentKeys.databaseUrl]: databaseUrl,
        }),
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain(runtimeEnvironmentKeys.databaseUrl);
      expect(error.message).not.toContain('synthetic_password');
      expect(error.issues[0]?.reason).toBe(expectedReason);
    },
  );

  it.each(['http://miniapp.example.invalid/foab', embeddedCredentialUrl, 'https://miniapp.example.invalid/foab#fragment'])(
    'rejects an unsafe optional Mini App URL without echoing it',
    (webAppUrl) => {
      const error = captureConfigurationError(() =>
        loadRuntimeConfig({
          [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
          [runtimeEnvironmentKeys.databaseUrl]:
            'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
          [runtimeEnvironmentKeys.webAppUrl]: webAppUrl,
        }),
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain(runtimeEnvironmentKeys.webAppUrl);
      expect(error.message).not.toContain(webAppUrl);
      expect(error.issues[0]?.reason).toBe(
        webAppUrl.startsWith('http:')
          ? 'wrong_protocol'
          : webAppUrl.includes('@')
            ? 'embedded_credentials'
            : 'fragment_not_allowed',
      );
    },
  );

  it('reports only redacted shape hints for a malformed Web App assignment', () => {
    const error = captureConfigurationError(() =>
      loadRuntimeConfig({
        [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
        [runtimeEnvironmentKeys.databaseUrl]:
          'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
        [runtimeEnvironmentKeys.webAppUrl]: 'FOAB_WEB_APP_URL="https://miniapp.example.invalid"',
      }),
    );

    expect(error.issues[0]?.reason).toBe('invalid_url');
    expect(error.issues[0]?.diagnostics).toEqual({
      valueLength: 50,
      startsWithHttps: false,
      startsWithHttp: false,
      looksLikeEnvironmentAssignment: true,
      hasQuotes: true,
      hasControlCharacters: false,
      hasWhitespace: false,
      hasNonAsciiCharacters: false,
      hasBackslash: false,
    });
    expect(error.message).not.toContain('miniapp.example.invalid');
  });
});

function captureConfigurationError(action: () => unknown): ConfigurationError {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return error;
    }
  }

  throw new Error('Expected runtime configuration validation to fail.');
}
