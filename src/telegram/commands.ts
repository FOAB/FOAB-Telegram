import type { BotCommand, MenuButton } from 'grammy/types';
import type { SupportedLocale } from '../i18n/messages.js';

/** Commands shown in a private chat, where ordinary message delivery is appropriate. */
export const privateCommandMenu = [
  { command: 'start', description: 'Start FOAB or get setup guidance' },
  { command: 'help', description: 'Show available commands' },
  { command: 'ping', description: 'Check whether FOAB is online' },
  { command: 'id', description: 'Show the current chat and user IDs' },
  { command: 'settings', description: 'Open group settings' },
  { command: 'cancel', description: 'Cancel the active flow' },
] satisfies readonly BotCommand[];

/**
 * Selects the default private-chat entry point for group administration.
 *
 * The Mini App is the primary surface when a validated HTTPS URL is configured.
 * The Telegram command menu remains the safe default when the URL is absent.
 */
export function privateMenuButton(webAppUrl: string | null): MenuButton {
  if (webAppUrl === null) {
    return { type: 'commands' };
  }

  return {
    type: 'web_app',
    text: 'FOAB',
    web_app: { url: webAppUrl },
  };
}

/** Group commands shown to every member; each response is explicitly ephemeral. */
export const groupCommandMenu = [
  { command: 'start', description: 'Register this group', is_ephemeral: true },
  { command: 'help', description: 'Show available commands', is_ephemeral: true },
  { command: 'ping', description: 'Check whether FOAB is online', is_ephemeral: true },
  { command: 'id', description: 'Show current chat and user IDs', is_ephemeral: true },
  { command: 'cancel', description: 'Cancel your active flow', is_ephemeral: true },
] satisfies readonly BotCommand[];

/** Group commands shown to administrators; handlers still revalidate authority. */
export const groupAdministratorCommandMenu = [
  ...groupCommandMenu,
  { command: 'settings', description: 'Open group settings', is_ephemeral: true },
  { command: 'reload', description: 'Refresh FOAB group state', is_ephemeral: true },
] satisfies readonly BotCommand[];

/** A language-specific command menu published through Telegram's command scopes. */
export interface LocalizedCommandMenu {
  readonly locale: SupportedLocale;
  readonly languageCode: 'en' | 'pt' | 'es';
  readonly privateCommands: readonly BotCommand[];
  readonly groupCommands: readonly BotCommand[];
  readonly groupAdministratorCommands: readonly BotCommand[];
}

/** Localized menus use Telegram's language-code selection before the English fallback. */
export const localizedCommandMenus: readonly LocalizedCommandMenu[] = [
  {
    locale: 'en-US',
    languageCode: 'en',
    privateCommands: privateCommandMenu,
    groupCommands: groupCommandMenu,
    groupAdministratorCommands: groupAdministratorCommandMenu,
  },
  {
    locale: 'pt-BR',
    languageCode: 'pt',
    privateCommands: [
      { command: 'start', description: 'Iniciar o FOAB ou obter orientações' },
      { command: 'help', description: 'Mostrar comandos disponíveis' },
      { command: 'ping', description: 'Verificar se o FOAB está online' },
      { command: 'id', description: 'Mostrar IDs do chat e do usuário' },
      { command: 'settings', description: 'Abrir configurações do grupo' },
      { command: 'cancel', description: 'Cancelar o fluxo ativo' },
    ],
    groupCommands: [
      { command: 'start', description: 'Registrar este grupo', is_ephemeral: true },
      { command: 'help', description: 'Mostrar comandos disponíveis', is_ephemeral: true },
      { command: 'ping', description: 'Verificar se o FOAB está online', is_ephemeral: true },
      { command: 'id', description: 'Mostrar IDs do chat e do usuário', is_ephemeral: true },
      { command: 'cancel', description: 'Cancelar seu fluxo ativo', is_ephemeral: true },
    ],
    groupAdministratorCommands: [
      { command: 'start', description: 'Registrar este grupo', is_ephemeral: true },
      { command: 'help', description: 'Mostrar comandos disponíveis', is_ephemeral: true },
      { command: 'ping', description: 'Verificar se o FOAB está online', is_ephemeral: true },
      { command: 'id', description: 'Mostrar IDs do chat e do usuário', is_ephemeral: true },
      { command: 'cancel', description: 'Cancelar seu fluxo ativo', is_ephemeral: true },
      { command: 'settings', description: 'Abrir configurações do grupo', is_ephemeral: true },
      { command: 'reload', description: 'Atualizar o estado do grupo no FOAB', is_ephemeral: true },
    ],
  },
  {
    locale: 'es-ES',
    languageCode: 'es',
    privateCommands: [
      { command: 'start', description: 'Iniciar FOAB u obtener ayuda' },
      { command: 'help', description: 'Mostrar comandos disponibles' },
      { command: 'ping', description: 'Comprobar si FOAB está en línea' },
      { command: 'id', description: 'Mostrar IDs del chat y del usuario' },
      { command: 'settings', description: 'Abrir ajustes del grupo' },
      { command: 'cancel', description: 'Cancelar el flujo activo' },
    ],
    groupCommands: [
      { command: 'start', description: 'Registrar este grupo', is_ephemeral: true },
      { command: 'help', description: 'Mostrar comandos disponibles', is_ephemeral: true },
      { command: 'ping', description: 'Comprobar si FOAB está en línea', is_ephemeral: true },
      { command: 'id', description: 'Mostrar IDs del chat y del usuario', is_ephemeral: true },
      { command: 'cancel', description: 'Cancelar tu flujo activo', is_ephemeral: true },
    ],
    groupAdministratorCommands: [
      { command: 'start', description: 'Registrar este grupo', is_ephemeral: true },
      { command: 'help', description: 'Mostrar comandos disponibles', is_ephemeral: true },
      { command: 'ping', description: 'Comprobar si FOAB está en línea', is_ephemeral: true },
      { command: 'id', description: 'Mostrar IDs del chat y del usuario', is_ephemeral: true },
      { command: 'cancel', description: 'Cancelar tu flujo activo', is_ephemeral: true },
      { command: 'settings', description: 'Abrir ajustes del grupo', is_ephemeral: true },
      { command: 'reload', description: 'Actualizar el estado del grupo en FOAB', is_ephemeral: true },
    ],
  },
] satisfies readonly LocalizedCommandMenu[];

/** Typed settings command variants accepted by the closed command grammar. */
export type SettingsCommand =
  | { readonly kind: 'show' }
  | { readonly kind: 'select-group'; readonly index: number }
  | { readonly kind: 'set-locale'; readonly value: SupportedLocale }
  | { readonly kind: 'set-time-zone'; readonly value: string }
  | { readonly kind: 'invalid' };

/** Closed callback actions emitted by FOAB's settings keyboards. */
export type SettingsCallback =
  | { readonly kind: 'select-group'; readonly index: number }
  | { readonly kind: 'show-language' }
  | { readonly kind: 'show-time-zone' }
  | { readonly kind: 'set-locale'; readonly value: SupportedLocale }
  | { readonly kind: 'set-time-zone'; readonly value: string }
  | { readonly kind: 'back' }
  | { readonly kind: 'close' };

/** Encodes a typed settings action into a bounded callback payload. */
export function settingsCallbackData(action: SettingsCallback): string {
  switch (action.kind) {
    case 'select-group':
      return `foab:settings:group:${action.index}`;
    case 'show-language':
      return 'foab:settings:language';
    case 'show-time-zone':
      return 'foab:settings:timezone';
    case 'set-locale':
      return `foab:settings:locale:${action.value}`;
    case 'set-time-zone':
      return `foab:settings:time-zone:${action.value}`;
    case 'back':
      return 'foab:settings:back';
    case 'close':
      return 'foab:settings:close';
  }
}

/** Parses only callback payloads created by the settings keyboard builder. */
export function parseSettingsCallbackData(input: string): SettingsCallback | null {
  if (input === 'foab:settings:language') {
    return { kind: 'show-language' };
  }
  if (input === 'foab:settings:timezone') {
    return { kind: 'show-time-zone' };
  }
  if (input === 'foab:settings:back') {
    return { kind: 'back' };
  }
  if (input === 'foab:settings:close') {
    return { kind: 'close' };
  }

  const [prefix, settings, action, value, ...rest] = input.split(':');
  if (prefix !== 'foab' || settings !== 'settings' || rest.length > 0 || !value) {
    return null;
  }

  if (action === 'group') {
    const index = Number(value);
    return isSelectionIndex(value, index)
      ? { kind: 'select-group', index }
      : null;
  }
  if (action === 'locale') {
    const locale = parseSupportedLocale(value);
    return locale ? { kind: 'set-locale', value: locale } : null;
  }
  if (action === 'time-zone' && isSupportedTimeZone(value)) {
    return { kind: 'set-time-zone', value };
  }
  return null;
}

/** Parses `/settings` arguments without evaluating or forwarding administrator input. */
export function parseSettingsArguments(input: string): SettingsCommand {
  const parts = input.trim().split(/\s+/u).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { kind: 'show' };
  }
  if (parts.length !== 2) {
    return { kind: 'invalid' };
  }

  const [name, value] = parts;
  if (!name || !value || value.length > 64) {
    return { kind: 'invalid' };
  }

  if (name === 'select' || name === 'group') {
    const index = Number(value);
    return isSelectionIndex(value, index)
      ? { kind: 'select-group', index }
      : { kind: 'invalid' };
  }

  if (name === 'language' || name === 'locale') {
    const locale = parseSupportedLocale(value);
    return locale ? { kind: 'set-locale', value: locale } : { kind: 'invalid' };
  }

  if (name === 'timezone' || name === 'time_zone') {
    return isSupportedTimeZone(value)
      ? { kind: 'set-time-zone', value }
      : { kind: 'invalid' };
  }

  return { kind: 'invalid' };
}

/** Parses only the locales that FOAB exposes to users. */
export function parseSupportedLocale(value: string): SupportedLocale | null {
  switch (value) {
    case 'en-US':
    case 'pt-BR':
    case 'es-ES':
      return value;
    default:
      return null;
  }
}

/** Validates a bounded IANA time-zone name using the host's ICU time-zone data. */
export function isSupportedTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 64 || !isSafeTimeZoneCharacters(value)) {
    return false;
  }
  if (value === 'UTC') {
    return true;
  }

  try {
    return Intl.supportedValuesOf('timeZone').includes(value);
  } catch {
    return false;
  }
}

/** Applies a small allowlist before passing a value to the ICU validator. */
function isSafeTimeZoneCharacters(value: string): boolean {
  for (const character of value) {
    if (!/[A-Za-z0-9_+\-./]/u.test(character)) {
      return false;
    }
  }
  return true;
}

/** Accepts only a bounded one-based decimal selector for server-owned lists. */
function isSelectionIndex(value: string, parsed: number): boolean {
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100 || value.length > 3) {
    return false;
  }
  for (const character of value) {
    if (character < '0' || character > '9') {
      return false;
    }
  }
  return true;
}
