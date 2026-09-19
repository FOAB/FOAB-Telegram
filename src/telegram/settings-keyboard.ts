import type { InlineKeyboardMarkup } from 'grammy/types';
import type { MessageCatalog, SupportedLocale } from '../i18n/messages.js';
import {
  settingsCallbackData,
  type MessageDeliveryMode,
  type SettingsCallback,
  type SettingsFeature,
} from './commands.js';

/** Locales exposed by the initial settings experience, in stable menu order. */
const SETTINGS_LOCALES: readonly SupportedLocale[] = ['en-US', 'pt-BR', 'es-ES'];

/** Common time zones available without typing; commands remain available for other IANA zones. */
const SETTINGS_TIME_ZONES: readonly string[] = [
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/Lisbon',
];

/** Builds the group or selected-private-group settings overview keyboard. */
export function settingsOverviewKeyboard(
  messages: MessageCatalog,
  webAppUrl?: string,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [
    [
      callbackButton(messages.settingsWelcomeButton, { kind: 'show-feature', feature: 'welcome' }),
      callbackButton(messages.settingsRulesButton, { kind: 'show-feature', feature: 'rules' }),
    ],
    [
      callbackButton(messages.settingsGoodbyeButton, { kind: 'show-feature', feature: 'goodbye' }),
      callbackButton(messages.settingsLanguageButton, { kind: 'show-language' }),
    ],
    [callbackButton(messages.settingsTimeZoneButton, { kind: 'show-time-zone' })],
    [callbackButton(messages.settingsCloseButton, { kind: 'close' })],
  ];
  if (webAppUrl !== undefined) {
    rows.unshift([{ text: messages.settingsWebAppButton, web_app: { url: webAppUrl } }]);
  }
  return {
    inline_keyboard: rows,
  };
}

/** Builds the focused fallback menu for one Mini App feature. */
export function settingsFeatureKeyboard(
  messages: MessageCatalog,
  feature: SettingsFeature,
  configured: boolean,
  mode: MessageDeliveryMode,
  deletePrevious: boolean,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = [
    [
      callbackButton(`${messages.settingsFeatureDisableButton}${configured ? ' ✅' : ''}`, { kind: 'disable-feature', feature }),
      callbackButton(`${messages.settingsFeatureActivateButton}${configured ? '' : ' ✅'}`, { kind: 'enable-feature', feature }),
    ],
    [callbackButton(messages.settingsFeatureEditButton, { kind: 'edit-feature', feature })],
  ];
  if (feature !== 'rules') {
    rows.push([
      callbackButton(`${messages.settingsFeatureAlwaysButton}${mode === 'always' ? ' ✅' : ''}`, { kind: 'set-feature-mode', feature, mode: 'always' }),
      callbackButton(`${messages.settingsFeatureFirstEntryButton}${mode === 'first' ? ' ✅' : ''}`, { kind: 'set-feature-mode', feature, mode: 'first' }),
    ]);
    rows.push([callbackButton(
      `${messages.settingsFeatureDeletePreviousButton} ${deletePrevious ? '✅' : '❌'}`,
      { kind: 'toggle-feature-delete', feature },
    )]);
  }
  rows.push([callbackButton(messages.settingsBackButton, { kind: 'back' })]);
  return { inline_keyboard: rows };
}

/** Builds the locale picker with a return action and no client-supplied values. */
export function settingsLanguageKeyboard(messages: MessageCatalog): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      SETTINGS_LOCALES.map((locale) =>
        callbackButton(messages.localeName(locale), { kind: 'set-locale', value: locale })),
      [callbackButton(messages.settingsBackButton, { kind: 'back' })],
    ],
  };
}

/** Builds a bounded common time-zone picker; arbitrary validated zones remain command-compatible. */
export function settingsTimeZoneKeyboard(messages: MessageCatalog): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      ...SETTINGS_TIME_ZONES.map((timeZone) => [
        callbackButton(timeZone, { kind: 'set-time-zone', value: timeZone }),
      ]),
      [callbackButton(messages.settingsBackButton, { kind: 'back' })],
    ],
  };
}

/** Builds one private-chat button for each server-owned group selection. */
export function privateGroupSelectionKeyboard(
  messages: MessageCatalog,
  groups: readonly { readonly index: number; readonly title: string }[],
  webAppUrl?: string,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup['inline_keyboard'] = groups.map((group) => [
    callbackButton(
      messages.privateGroupButton(group.index, group.title),
      { kind: 'select-group', index: group.index },
    ),
  ]);
  rows.unshift([callbackButton(messages.privateSettingsButton, { kind: 'show-private-settings' })]);
  if (webAppUrl !== undefined) {
    rows.unshift([{ text: messages.settingsWebAppButton, web_app: { url: webAppUrl } }]);
  }
  return {
    inline_keyboard: rows,
  };
}

/** Builds the private FOAB settings menu, separate from any group settings. */
export function privateSettingsKeyboard(messages: MessageCatalog): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [callbackButton(messages.privateLanguageButton, { kind: 'show-private-language' })],
      [callbackButton(messages.settingsBackButton, { kind: 'private-settings-back' })],
    ],
  };
}

/** Builds the private language picker without accepting client-supplied locale values. */
export function privateLanguageKeyboard(messages: MessageCatalog): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      SETTINGS_LOCALES.map((locale) =>
        callbackButton(messages.localeName(locale), { kind: 'set-private-locale', value: locale })),
      [callbackButton(messages.settingsBackButton, { kind: 'show-private-settings' })],
    ],
  };
}

/** Creates a callback button from a closed, server-generated action. */
function callbackButton(text: string, action: SettingsCallback) {
  return {
    text,
    callback_data: settingsCallbackData(action),
  } as const;
}
