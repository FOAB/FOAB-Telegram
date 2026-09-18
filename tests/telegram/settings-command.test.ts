import { describe, expect, it } from 'vitest';
import {
  groupAdministratorCommandMenu,
  groupCommandMenu,
  localizedCommandMenus,
  parseSettingsArguments,
  parseSettingsCallbackData,
  privateCommandMenu,
} from '../../src/telegram/commands.js';

describe('settings command contract', () => {
  it('accepts only the supported locale and IANA time-zone forms', () => {
    expect(parseSettingsArguments('language pt-BR')).toEqual({
      kind: 'set-locale',
      value: 'pt-BR',
    });
    expect(parseSettingsArguments('locale es-ES')).toEqual({
      kind: 'set-locale',
      value: 'es-ES',
    });
    expect(parseSettingsArguments('timezone America/Sao_Paulo')).toEqual({
      kind: 'set-time-zone',
      value: 'America/Sao_Paulo',
    });
    expect(parseSettingsArguments('timezone UTC')).toEqual({
      kind: 'set-time-zone',
      value: 'UTC',
    });
    expect(parseSettingsArguments('select 2')).toEqual({
      kind: 'select-group',
      index: 2,
    });
  });

  it('rejects unknown fields, invalid values, and extra arguments', () => {
    expect(parseSettingsArguments('language fr-FR')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('timezone Not/AZone')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('unknown value')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('language pt-BR extra')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('timezone America/Sao_Paulo\nunsafe')).toEqual({
      kind: 'invalid',
    });
    expect(parseSettingsArguments('select 0')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('select 101')).toEqual({ kind: 'invalid' });
    expect(parseSettingsArguments('select 1.0')).toEqual({ kind: 'invalid' });
  });

  it('accepts only closed settings callback actions', () => {
    expect(parseSettingsCallbackData('foab:settings:group:2')).toEqual({
      kind: 'select-group',
      index: 2,
    });
    expect(parseSettingsCallbackData('foab:settings:locale:pt-BR')).toEqual({
      kind: 'set-locale',
      value: 'pt-BR',
    });
    expect(parseSettingsCallbackData('foab:settings:time-zone:America/Sao_Paulo')).toEqual({
      kind: 'set-time-zone',
      value: 'America/Sao_Paulo',
    });
    expect(parseSettingsCallbackData('foab:settings:locale:fr-FR')).toBeNull();
    expect(parseSettingsCallbackData('foab:settings:group:0')).toBeNull();
    expect(parseSettingsCallbackData('other:settings:language')).toBeNull();
  });

  it('keeps settings visible to private chats and group administrators only', () => {
    expect(privateCommandMenu.map((command) => command.command)).toContain('settings');
    expect(groupCommandMenu.map((command) => command.command)).not.toContain('settings');
    expect(groupAdministratorCommandMenu.map((command) => command.command)).toContain('settings');
    expect(groupAdministratorCommandMenu.map((command) => command.command)).toContain('reload');
    expect(groupAdministratorCommandMenu.map((command) => command.command)).toEqual(
      expect.arrayContaining(['ping', 'id']),
    );
    expect(localizedCommandMenus).toHaveLength(3);
    expect(localizedCommandMenus.map((menu) => menu.languageCode)).toEqual(['en', 'pt', 'es']);
    for (const menu of localizedCommandMenus) {
      expect(menu.privateCommands.every((command) => !('is_ephemeral' in command))).toBe(true);
      expect(menu.groupCommands.every((command) => command.is_ephemeral === true)).toBe(true);
      expect(menu.groupAdministratorCommands.every((command) => command.is_ephemeral === true)).toBe(true);
      expect(menu.groupAdministratorCommands.map((command) => command.command)).toEqual(
        expect.arrayContaining(['ping', 'id', 'settings']),
      );
      expect(menu.groupAdministratorCommands.map((command) => command.command)).toEqual(
        expect.arrayContaining(['reload']),
      );
    }
  });
});
