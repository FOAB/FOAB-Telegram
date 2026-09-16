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
    expect(config.webAppUrl).toBeNull();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('accepts an optional HTTPS Mini App URL without making a network request', () => {
    const config = loadRuntimeConfig({
      [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
      [runtimeEnvironmentKeys.databaseUrl]:
        'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
      [runtimeEnvironmentKeys.webAppUrl]: 'https://miniapp.example.invalid/foab',
    });

    expect(config.webAppUrl).toBe('https://miniapp.example.invalid/foab');
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
    },
  );

  it.each([undefined, '', 'not-a-url', 'https://example.invalid/path']) (
    'rejects an absent or invalid database URL without echoing it',
    (databaseUrl) => {
      const error = captureConfigurationError(() =>
        loadRuntimeConfig({
          [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
          [runtimeEnvironmentKeys.databaseUrl]: databaseUrl,
        }),
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain(runtimeEnvironmentKeys.databaseUrl);
      expect(error.message).not.toContain('synthetic_password');
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
    },
  );
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
