import { describe, expect, it } from 'vitest';
import {
  ConfigurationError,
  loadRuntimeConfig,
  runtimeEnvironmentKeys,
} from '../../src/config/environment.js';

describe('runtime environment validation', () => {
  it('accepts a synthetic bot token without making a network request', () => {
    const config = loadRuntimeConfig({
      [runtimeEnvironmentKeys.telegramBotToken]: 'synthetic-token-value',
      [runtimeEnvironmentKeys.databaseUrl]:
        'postgresql://synthetic_user:synthetic_password@127.0.0.1:5432/synthetic_db',
    });

    expect(config.telegramBotToken).toBe('synthetic-token-value');
    expect(config.databaseUrl).toContain('/synthetic_db');
    expect(Object.isFrozen(config)).toBe(true);
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
