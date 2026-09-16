import { describe, expect, it } from 'vitest';
import { getMessages } from '../../src/i18n/messages.js';
import {
  privateGroupSelectionKeyboard,
  settingsOverviewKeyboard,
} from '../../src/telegram/settings-keyboard.js';

describe('settings interaction keyboards', () => {
  it('keeps group settings on callback buttons without a Web App-only dependency', () => {
    const keyboard = settingsOverviewKeyboard(getMessages('en-US'));
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.every((button) => 'callback_data' in button)).toBe(true);
    expect(buttons.some((button) => 'web_app' in button)).toBe(false);
  });

  it('puts the Web App first in private settings and keeps group selection server-owned', () => {
    const messages = getMessages('pt-BR');
    const keyboard = privateGroupSelectionKeyboard(
      messages,
      [{ index: 1, title: 'Synthetic Group' }],
      'https://miniapp.example.invalid/foab',
    );

    expect(keyboard.inline_keyboard[0]?.[0]).toEqual({
      text: messages.settingsWebAppButton,
      web_app: { url: 'https://miniapp.example.invalid/foab' },
    });
    expect(keyboard.inline_keyboard[1]?.[0]).toMatchObject({
      text: '1. Synthetic Group',
      callback_data: 'foab:settings:group:1',
    });
  });
});
