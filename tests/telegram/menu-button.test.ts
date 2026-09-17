import { describe, expect, it } from 'vitest';
import { privateMenuButton } from '../../src/telegram/commands.js';

describe('private Mini App menu button', () => {
  it('uses the command list when no Mini App URL is configured', () => {
    expect(privateMenuButton(null)).toEqual({ type: 'commands' });
  });

  it('uses the Mini App as the primary private administration entry point', () => {
    expect(privateMenuButton('https://admin.example.invalid/foab')).toEqual({
      type: 'web_app',
      text: 'FOAB',
      web_app: { url: 'https://admin.example.invalid/foab' },
    });
  });
});
