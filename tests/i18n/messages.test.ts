import { describe, expect, it } from 'vitest';
import {
  getHelpMessage,
  getMessages,
  localeFromTelegram,
  supportedLocale,
} from '../../src/i18n/messages.js';

describe('initial message catalogs', () => {
  it.each([
    ['pt-BR', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['es-ES', 'es-ES'],
    ['es', 'es-ES'],
    ['en-US', 'en-US'],
    [undefined, 'en-US'],
  ] as const)('maps Telegram language %s to %s', (input, expected) => {
    expect(localeFromTelegram(input)).toBe(expected);
  });

  it('falls back safely when a stored group locale is unsupported', () => {
    expect(supportedLocale('fr-FR')).toBe('en-US');
    expect(getMessages('en-US').help).toContain('/start');
  });

  it('adds administrator help only after the caller is authorized', () => {
    expect(getHelpMessage('en-US', false)).not.toContain('/settings');
    expect(getHelpMessage('en-US', true)).toContain('/settings');
    expect(getHelpMessage('en-US', true)).toContain('/reload');
    expect(getHelpMessage('en-US', false)).not.toContain('/reload');
  });
});
