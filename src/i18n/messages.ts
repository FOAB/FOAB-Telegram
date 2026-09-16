/** Supported interface locales for initial private and group onboarding. */
export type SupportedLocale = 'en-US' | 'pt-BR' | 'es-ES';

/** User-facing messages for the initial onboarding commands. */
export interface MessageCatalog {
  readonly privateStart: string;
  readonly groupStart: string;
  readonly help: string;
}

const catalogs: Readonly<Record<SupportedLocale, MessageCatalog>> = {
  'en-US': {
    privateStart:
      'I am FOAB, a group administration bot. Add me to a group and send /start there to register it. Use /help for available commands.',
    groupStart:
      'FOAB is ready in this group. Use /help to see the commands currently available.',
    help:
      'Available commands:\n/start — Register this group and show setup guidance.\n/help — Show this help message.',
  },
  'pt-BR': {
    privateStart:
      'Sou o FOAB, um bot de administração de grupos. Adicione-me a um grupo e envie /start nele para registrá-lo. Use /help para ver os comandos disponíveis.',
    groupStart:
      'O FOAB está pronto neste grupo. Use /help para ver os comandos disponíveis no momento.',
    help:
      'Comandos disponíveis:\n/start — Registrar este grupo e mostrar orientações iniciais.\n/help — Mostrar esta ajuda.',
  },
  'es-ES': {
    privateStart:
      'Soy FOAB, un bot de administración de grupos. Añádeme a un grupo y envía /start allí para registrarlo. Usa /help para ver los comandos disponibles.',
    groupStart:
      'FOAB está listo en este grupo. Usa /help para ver los comandos disponibles actualmente.',
    help:
      'Comandos disponibles:\n/start — Registrar este grupo y mostrar instrucciones iniciales.\n/help — Mostrar esta ayuda.',
  },
};

/** Returns the requested initial message catalog. */
export function getMessages(locale: SupportedLocale): MessageCatalog {
  return catalogs[locale];
}

/** Maps Telegram's language hint to an available locale, defaulting safely to English. */
export function localeFromTelegram(languageCode: string | undefined): SupportedLocale {
  switch (languageCode?.toLowerCase().split('-')[0]) {
    case 'pt':
      return 'pt-BR';
    case 'es':
      return 'es-ES';
    default:
      return 'en-US';
  }
}

/** Validates a stored locale before using it for user-facing output. */
export function supportedLocale(value: string | undefined): SupportedLocale {
  switch (value) {
    case 'pt-BR':
    case 'es-ES':
    case 'en-US':
      return value;
    default:
      return 'en-US';
  }
}
