import { describe, expect, it } from 'vitest';
import { getMessages } from '../../src/i18n/messages.js';
import {
  privateGroupSelectionKeyboard,
  settingsFeatureKeyboard,
  settingsOverviewKeyboard,
} from '../../src/telegram/settings-keyboard.js';

describe('settings interaction keyboards', () => {
  it('keeps group settings on callback buttons without a Web App-only dependency', () => {
    const keyboard = settingsOverviewKeyboard(getMessages('en-US'));
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.every((button) => 'callback_data' in button)).toBe(true);
    expect(buttons.some((button) => 'web_app' in button)).toBe(false);
  });

  it('exposes the same direct feature categories as the Mini App fallback', () => {
    const messages = getMessages('pt-BR');
    const keyboard = settingsOverviewKeyboard(messages);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.map((button) => button.text)).toEqual(expect.arrayContaining([
      messages.settingsWelcomeButton,
      messages.settingsRulesButton,
      messages.settingsGoodbyeButton,
    ]));
    expect(buttons.map((button) => 'callback_data' in button ? button.callback_data : '')).toEqual(
      expect.arrayContaining([
        'foab:settings:feature:welcome',
        'foab:settings:feature:rules',
        'foab:settings:feature:goodbye',
      ]),
    );
  });

  it('offers activation, editing, delivery mode, deletion, and back actions for a configured feature', () => {
    const keyboard = settingsFeatureKeyboard(getMessages('en-US'), 'welcome', true, 'always', false);
    const buttons = keyboard.inline_keyboard.flat();

    expect(buttons.map((button) => 'callback_data' in button ? button.callback_data : '')).toEqual([
      'foab:settings:disable-feature:welcome',
      'foab:settings:enable-feature:welcome',
      'foab:settings:edit-feature:welcome',
      'foab:settings:feature-mode:welcome:always',
      'foab:settings:feature-mode:welcome:first',
      'foab:settings:toggle-feature-delete:welcome',
      'foab:settings:back',
    ]);
  });

  it('places the Mini App first while retaining callback fallback actions', () => {
    const messages = getMessages('en-US');
    const keyboard = settingsOverviewKeyboard(messages, 'https://miniapp.example.invalid/foab');

    expect(keyboard.inline_keyboard[0]?.[0]).toEqual({
      text: messages.settingsWebAppButton,
      web_app: { url: 'https://miniapp.example.invalid/foab' },
    });
    expect(keyboard.inline_keyboard.slice(1).flat().every((button) => 'callback_data' in button)).toBe(true);
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
