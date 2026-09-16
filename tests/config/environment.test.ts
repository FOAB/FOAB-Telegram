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
    });

    expect(config.telegramBotToken).toBe('synthetic-token-value');
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([undefined, '', '   ', ' token-with-padding '])(
    'rejects missing or malformed bot token values without echoing them',
    (token) => {
      const error = captureConfigurationError(() =>
        loadRuntimeConfig({
          [runtimeEnvironmentKeys.telegramBotToken]: token,
        }),
      );

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.message).toContain(runtimeEnvironmentKeys.telegramBotToken);
      expect(error.message).not.toContain('token-with-padding');
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
