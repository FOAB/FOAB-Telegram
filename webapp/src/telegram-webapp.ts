/** Minimum Telegram Web App bridge surface consumed by the settings UI. */
export interface TelegramWebAppBridge {
  readonly initData: string;
  readonly colorScheme?: 'light' | 'dark';
  readonly themeParams?: Readonly<Record<string, string>>;
  readonly isVersionAtLeast?: (version: string) => boolean;
  readonly ready: () => void;
  readonly expand?: () => void;
  readonly close?: () => void;
  readonly BackButton?: {
    readonly isVisible: boolean;
    readonly show: () => void;
    readonly hide: () => void;
    readonly onClick: (callback: () => void) => void;
    readonly offClick: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    readonly Telegram?: {
      readonly WebApp?: TelegramWebAppBridge;
    };
  }
}

/** Initializes the Telegram bridge when the page is running inside Telegram. */
export function initializeTelegramWebApp(): TelegramWebAppBridge | null {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    return null;
  }
  webApp.ready();
  webApp.expand?.();
  applyTelegramTheme(webApp);
  return webApp;
}

/** Maps documented Telegram theme values into the CSS custom properties used by the UI. */
function applyTelegramTheme(webApp: TelegramWebAppBridge): void {
  const root = document.documentElement;
  const theme = webApp.themeParams;
  if (!theme) {
    return;
  }

  const variableMap: Readonly<Record<string, string>> = {
    bg_color: '--foab-bg-color',
    button_color: '--foab-accent-color',
    button_text_color: '--foab-accent-text-color',
    hint_color: '--foab-muted-color',
    secondary_bg_color: '--foab-secondary-bg-color',
    section_bg_color: '--foab-card-color',
    text_color: '--foab-text-color',
  };
  for (const [themeKey, cssVariable] of Object.entries(variableMap)) {
    const value = theme[themeKey];
    if (value && /^#[0-9A-Fa-f]{6,8}$/u.test(value)) {
      root.style.setProperty(cssVariable, value);
    }
  }
  if (webApp.colorScheme) {
    root.dataset.telegramColorScheme = webApp.colorScheme;
  }
}
