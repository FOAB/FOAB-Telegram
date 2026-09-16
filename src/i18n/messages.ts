/** Supported interface locales for initial private and group onboarding. */
export type SupportedLocale = 'en-US' | 'pt-BR' | 'es-ES';

/** User-facing messages for onboarding, help, and the first settings flow. */
export interface MessageCatalog {
  readonly privateStart: string;
  readonly groupStart: string;
  readonly help: string;
  readonly administratorHelp: string;
  readonly privateSettings: string;
  readonly groupSettings: (locale: string, timeZone: string, revision: number) => string;
  readonly settingsUsage: string;
  readonly settingsUpdated: string;
  readonly settingsNotAuthorized: string;
  readonly settingsConflict: string;
  readonly cancelNoActiveFlow: string;
  readonly cancelCompleted: string;
}

const catalogs: Readonly<Record<SupportedLocale, MessageCatalog>> = {
  'en-US': {
    privateStart:
      'I am FOAB, a group administration bot. Add me to a group and send /start there to register it. Use /help for available commands.',
    groupStart:
      'FOAB is ready in this group. Use /help to see the commands currently available.',
    help:
      'Available commands:\n/start — Register this group and show setup guidance.\n/help — Show this help message.\n/cancel — Cancel your active FOAB flow.',
    administratorHelp:
      "\nAdministrator commands:\n/settings — View or update this group's language and time zone.",
    privateSettings:
      'Open /settings in the target group. FOAB accepts `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES`, or `/settings timezone Area/Location`.',
    groupSettings: (locale, timeZone, revision) =>
      `Group settings (revision ${revision}):\nLanguage: ${locale}\nTime zone: ${timeZone}\n\nUse /settings language <en-US|pt-BR|es-ES> or /settings timezone <IANA zone> to update them. Use /cancel to close this settings flow.`,
    settingsUsage:
      'Use /settings to view this group, or /settings language <en-US|pt-BR|es-ES> and /settings timezone <IANA zone>.',
    settingsUpdated: 'Group settings updated successfully.',
    settingsNotAuthorized: 'Only a current administrator of this exact group can change its settings.',
    settingsConflict: 'These settings changed before your command was applied. Run /settings again and retry.',
    cancelNoActiveFlow: 'You have no active FOAB flow in this group.',
    cancelCompleted: 'Your active FOAB flow was cancelled.',
  },
  'pt-BR': {
    privateStart:
      'Sou o FOAB, um bot de administração de grupos. Adicione-me a um grupo e envie /start nele para registrá-lo. Use /help para ver os comandos disponíveis.',
    groupStart:
      'O FOAB está pronto neste grupo. Use /help para ver os comandos disponíveis no momento.',
    help:
      'Comandos disponíveis:\n/start — Registrar este grupo e mostrar orientações iniciais.\n/help — Mostrar esta ajuda.\n/cancel — Cancelar seu fluxo ativo do FOAB.',
    administratorHelp:
      '\nComandos de administrador:\n/settings — Ver ou atualizar o idioma e o fuso horário deste grupo.',
    privateSettings:
      'Abra /settings no grupo desejado. O FOAB aceita `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES` ou `/settings timezone Area/Location`.',
    groupSettings: (locale, timeZone, revision) =>
      `Configurações do grupo (revisão ${revision}):\nIdioma: ${locale}\nFuso horário: ${timeZone}\n\nUse /settings language <en-US|pt-BR|es-ES> ou /settings timezone <fuso IANA> para atualizar. Use /cancel para fechar este fluxo de configurações.`,
    settingsUsage:
      'Use /settings para consultar este grupo, ou /settings language <en-US|pt-BR|es-ES> e /settings timezone <fuso IANA>.',
    settingsUpdated: 'Configurações do grupo atualizadas com sucesso.',
    settingsNotAuthorized: 'Somente um administrador atual deste grupo pode alterar suas configurações.',
    settingsConflict: 'Essas configurações mudaram antes do seu comando. Execute /settings novamente e tente de novo.',
    cancelNoActiveFlow: 'Você não tem um fluxo ativo do FOAB neste grupo.',
    cancelCompleted: 'Seu fluxo ativo do FOAB foi cancelado.',
  },
  'es-ES': {
    privateStart:
      'Soy FOAB, un bot de administración de grupos. Añádeme a un grupo y envía /start allí para registrarlo. Usa /help para ver los comandos disponibles.',
    groupStart:
      'FOAB está listo en este grupo. Usa /help para ver los comandos disponibles actualmente.',
    help:
      'Comandos disponibles:\n/start — Registrar este grupo y mostrar instrucciones iniciales.\n/help — Mostrar esta ayuda.\n/cancel — Cancelar tu flujo activo de FOAB.',
    administratorHelp:
      '\nComandos de administrador:\n/settings — Ver o actualizar el idioma y la zona horaria de este grupo.',
    privateSettings:
      'Abre /settings en el grupo elegido. FOAB acepta `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES` o `/settings timezone Area/Location`.',
    groupSettings: (locale, timeZone, revision) =>
      `Ajustes del grupo (revisión ${revision}):\nIdioma: ${locale}\nZona horaria: ${timeZone}\n\nUsa /settings language <en-US|pt-BR|es-ES> o /settings timezone <zona IANA> para actualizar. Usa /cancel para cerrar este flujo de ajustes.`,
    settingsUsage:
      'Usa /settings para consultar este grupo, o /settings language <en-US|pt-BR|es-ES> y /settings timezone <zona IANA>.',
    settingsUpdated: 'Ajustes del grupo actualizados correctamente.',
    settingsNotAuthorized: 'Solo un administrador actual de este grupo puede cambiar sus ajustes.',
    settingsConflict: 'Estos ajustes cambiaron antes de aplicar tu comando. Ejecuta /settings de nuevo y vuelve a intentarlo.',
    cancelNoActiveFlow: 'No tienes un flujo activo de FOAB en este grupo.',
    cancelCompleted: 'Tu flujo activo de FOAB fue cancelado.',
  },
};

/** Returns the requested initial message catalog. */
export function getMessages(locale: SupportedLocale): MessageCatalog {
  return catalogs[locale];
}

/** Builds help for the caller's current scope and authority. */
export function getHelpMessage(locale: SupportedLocale, isAdministrator: boolean): string {
  const messages = getMessages(locale);
  return isAdministrator ? `${messages.help}${messages.administratorHelp}` : messages.help;
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
