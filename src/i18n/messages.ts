/** Supported interface locales for initial private and group onboarding. */
export type SupportedLocale = 'en-US' | 'pt-BR' | 'es-ES';

/** User-facing messages for onboarding, help, and the first settings flow. */
export interface MessageCatalog {
  readonly privateStart: string;
  readonly groupStart: string;
  readonly help: string;
  readonly ping: string;
  readonly id: (chatId: string, userId: number) => string;
  readonly rules: (rulesText: string) => string;
  readonly rulesNotConfigured: string;
  readonly settingsWelcomeButton: string;
  readonly settingsRulesButton: string;
  readonly settingsGoodbyeButton: string;
  readonly settingsLanguageButton: string;
  readonly settingsTimeZoneButton: string;
  readonly settingsBackButton: string;
  readonly settingsCloseButton: string;
  readonly settingsWebAppButton: string;
  readonly settingsLanguagePrompt: string;
  readonly settingsTimeZonePrompt: string;
  readonly settingsFeatureStatus: (feature: 'welcome' | 'rules' | 'goodbye', enabled: boolean) => string;
  readonly settingsFeatureEditButton: string;
  readonly settingsFeatureDisableButton: string;
  readonly settingsFeaturePrompt: (feature: 'welcome' | 'rules' | 'goodbye') => string;
  readonly settingsFeatureUpdated: (feature: 'welcome' | 'rules' | 'goodbye', enabled: boolean) => string;
  readonly settingsFeatureTooLong: string;
  readonly localeName: (locale: SupportedLocale) => string;
  readonly privateGroupButton: (index: number, title: string) => string;
  readonly administratorHelp: string;
  readonly privateSettings: string;
  readonly privateGroupsHeader: string;
  readonly privateGroupsEmpty: string;
  readonly privateGroupList: (entries: readonly string[]) => string;
  readonly privateSelectionUsage: string;
  readonly privateSelectionExpired: string;
  readonly groupSettings: (locale: string, timeZone: string, revision: number) => string;
  readonly settingsUsage: string;
  readonly settingsUpdated: string;
  readonly settingsNotAuthorized: string;
  readonly settingsConflict: string;
  readonly reloadCompleted: string;
  readonly reloadFailed: string;
  readonly reloadNotAuthorized: string;
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
      'Available commands:\n/start — Register this group and show setup guidance.\n/help — Show this help message.\n/ping — Check whether FOAB is online.\n/id — Show the current chat and user IDs.\n/rules — Show this group\'s rules.\n/cancel — Cancel your active FOAB flow.',
    ping: 'FOAB is online.',
    id: (chatId, userId) => `Chat ID: ${chatId}\nYour user ID: ${userId}`,
    rules: (rulesText) => `Group rules:\n\n${rulesText}`,
    rulesNotConfigured: 'No group rules have been configured.',
    settingsWelcomeButton: '💬 Welcome',
    settingsRulesButton: '📜 Rules',
    settingsGoodbyeButton: '👋 Goodbye',
    settingsLanguageButton: 'Language',
    settingsTimeZoneButton: 'Time zone',
    settingsBackButton: 'Back',
    settingsCloseButton: 'Close',
    settingsWebAppButton: 'Open settings app',
    settingsLanguagePrompt: 'Choose the group language:',
    settingsTimeZonePrompt: 'Choose a common time zone. Use the command form for another supported IANA zone.',
    settingsFeatureStatus: (feature, enabled) => `${settingsFeatureNameEn(feature)}\n\nStatus: ${enabled ? 'Enabled' : 'Disabled'}`,
    settingsFeatureEditButton: 'Edit',
    settingsFeatureDisableButton: 'Disable',
    settingsFeaturePrompt: (feature) => `Send the new ${settingsFeatureNameEn(feature).toLowerCase()} text. Send /cancel to stop.`,
    settingsFeatureUpdated: (feature, enabled) => `${settingsFeatureNameEn(feature)} ${enabled ? 'enabled' : 'disabled'}.`,
    settingsFeatureTooLong: 'This text is too long for Telegram or the selected feature. Shorten it and try again.',
    localeName: (locale) => ({ 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' })[locale],
    privateGroupButton: (index, title) => `${index}. ${title}`,
    administratorHelp:
      "\nAdministrator commands:\n/settings — View or update this group's language and time zone.\n/reload — Refresh this group's current FOAB state.",
    privateSettings:
      'Use /settings to list groups where your administrator status is confirmed. Then use /settings select <number> and update the selected group with `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES`, or `/settings timezone Area/Location`.',
    privateGroupsHeader: 'Groups where you are a current administrator:',
    privateGroupsEmpty: 'No active group was found where your current administrator status could be confirmed.',
    privateGroupList: (entries) => `Choose a group with /settings select <number>:\n${entries.join('\n')}`,
    privateSelectionUsage: 'Run /settings first in this private chat, then use /settings select <number>. The selection expires after 10 minutes.',
    privateSelectionExpired: 'That group selection is missing or expired. Run /settings to load the current administrator groups again.',
    groupSettings: (locale, timeZone, revision) =>
      `Group settings (revision ${revision}):\nLanguage: ${locale}\nTime zone: ${timeZone}\n\nUse /settings language <en-US|pt-BR|es-ES> or /settings timezone <IANA zone> to update them. Use /cancel to close this settings flow.`,
    settingsUsage:
      'Use /settings to view this group, or /settings language <en-US|pt-BR|es-ES> and /settings timezone <IANA zone>.',
    settingsUpdated: 'Group settings updated successfully.',
    settingsNotAuthorized: 'Only a current administrator of this exact group can change its settings.',
    settingsConflict: 'These settings changed before your command was applied. Run /settings again and retry.',
    reloadCompleted: "FOAB reloaded this group's current state successfully.",
    reloadFailed: 'FOAB could not reload this group state. Check that the bot is still a group administrator and try again.',
    reloadNotAuthorized: 'Only a current administrator of this exact group can reload its FOAB state.',
    cancelNoActiveFlow: 'You have no active FOAB flow in this group.',
    cancelCompleted: 'Your active FOAB flow was cancelled.',
  },
  'pt-BR': {
    privateStart:
      'Sou o FOAB, um bot de administração de grupos. Adicione-me a um grupo e envie /start nele para registrá-lo. Use /help para ver os comandos disponíveis.',
    groupStart:
      'O FOAB está pronto neste grupo. Use /help para ver os comandos disponíveis no momento.',
    help:
      'Comandos disponíveis:\n/start — Registrar este grupo e mostrar orientações iniciais.\n/help — Mostrar esta ajuda.\n/ping — Verificar se o FOAB está online.\n/id — Mostrar os IDs do chat e do usuário.\n/rules — Mostrar as regras deste grupo.\n/cancel — Cancelar seu fluxo ativo do FOAB.',
    ping: 'O FOAB está online.',
    id: (chatId, userId) => `ID do chat: ${chatId}\nSeu ID de usuário: ${userId}`,
    rules: (rulesText) => `Regras do grupo:\n\n${rulesText}`,
    rulesNotConfigured: 'As regras do grupo ainda não foram configuradas.',
    settingsWelcomeButton: '💬 Boas-vindas',
    settingsRulesButton: '📜 Regras',
    settingsGoodbyeButton: '👋 Adeus',
    settingsLanguageButton: 'Idioma',
    settingsTimeZoneButton: 'Fuso horário',
    settingsBackButton: 'Voltar',
    settingsCloseButton: 'Fechar',
    settingsWebAppButton: 'Abrir app de configurações',
    settingsLanguagePrompt: 'Escolha o idioma do grupo:',
    settingsTimeZonePrompt: 'Escolha um fuso horário comum. Use o comando para outro fuso IANA compatível.',
    settingsFeatureStatus: (feature, enabled) => `${settingsFeatureNamePt(feature)}\n\nStatus: ${enabled ? 'Ativado' : 'Desativado'}`,
    settingsFeatureEditButton: 'Editar',
    settingsFeatureDisableButton: 'Desativar',
    settingsFeaturePrompt: (feature) => `Envie o novo texto de ${settingsFeatureNamePt(feature).toLowerCase()}. Envie /cancel para cancelar.`,
    settingsFeatureUpdated: (feature, enabled) => `${settingsFeatureNamePt(feature)} ${enabled ? 'ativada' : 'desativada'}.`,
    settingsFeatureTooLong: 'Esse texto é longo demais para o Telegram ou para o recurso selecionado. Reduza o texto e tente novamente.',
    localeName: (locale) => ({ 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' })[locale],
    privateGroupButton: (index, title) => `${index}. ${title}`,
    administratorHelp:
      '\nComandos de administrador:\n/settings — Ver ou atualizar o idioma e o fuso horário deste grupo.\n/reload — Atualizar o estado atual deste grupo no FOAB.',
    privateSettings:
      'Use /settings para listar grupos onde seu status de administrador foi confirmado. Depois use /settings select <número> e atualize o grupo selecionado com `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES` ou `/settings timezone Area/Location`.',
    privateGroupsHeader: 'Grupos onde seu status atual de administrador foi confirmado:',
    privateGroupsEmpty: 'Não foi encontrado um grupo ativo onde seu status atual de administrador pudesse ser confirmado.',
    privateGroupList: (entries) => `Escolha um grupo com /settings select <número>:\n${entries.join('\n')}`,
    privateSelectionUsage: 'Execute /settings primeiro nesta conversa privada e depois use /settings select <número>. A seleção expira em 10 minutos.',
    privateSelectionExpired: 'Essa seleção de grupo não existe ou expirou. Execute /settings para carregar novamente os grupos administrados por você.',
    groupSettings: (locale, timeZone, revision) =>
      `Configurações do grupo (revisão ${revision}):\nIdioma: ${locale}\nFuso horário: ${timeZone}\n\nUse /settings language <en-US|pt-BR|es-ES> ou /settings timezone <fuso IANA> para atualizar. Use /cancel para fechar este fluxo de configurações.`,
    settingsUsage:
      'Use /settings para consultar este grupo, ou /settings language <en-US|pt-BR|es-ES> e /settings timezone <fuso IANA>.',
    settingsUpdated: 'Configurações do grupo atualizadas com sucesso.',
    settingsNotAuthorized: 'Somente um administrador atual deste grupo pode alterar suas configurações.',
    settingsConflict: 'Essas configurações mudaram antes do seu comando. Execute /settings novamente e tente de novo.',
    reloadCompleted: 'O FOAB atualizou o estado atual deste grupo com sucesso.',
    reloadFailed: 'O FOAB não conseguiu atualizar o estado deste grupo. Verifique se o bot continua administrador e tente novamente.',
    reloadNotAuthorized: 'Somente um administrador atual deste grupo pode atualizar o estado do FOAB.',
    cancelNoActiveFlow: 'Você não tem um fluxo ativo do FOAB neste grupo.',
    cancelCompleted: 'Seu fluxo ativo do FOAB foi cancelado.',
  },
  'es-ES': {
    privateStart:
      'Soy FOAB, un bot de administración de grupos. Añádeme a un grupo y envía /start allí para registrarlo. Usa /help para ver los comandos disponibles.',
    groupStart:
      'FOAB está listo en este grupo. Usa /help para ver los comandos disponibles actualmente.',
    help:
      'Comandos disponibles:\n/start — Registrar este grupo y mostrar instrucciones iniciales.\n/help — Mostrar esta ayuda.\n/ping — Comprobar si FOAB está en línea.\n/id — Mostrar los IDs del chat y del usuario.\n/rules — Mostrar las reglas de este grupo.\n/cancel — Cancelar tu flujo activo de FOAB.',
    ping: 'FOAB está en línea.',
    id: (chatId, userId) => `ID del chat: ${chatId}\nTu ID de usuario: ${userId}`,
    rules: (rulesText) => `Reglas del grupo:\n\n${rulesText}`,
    rulesNotConfigured: 'Las reglas del grupo todavía no están configuradas.',
    settingsWelcomeButton: '💬 Bienvenida',
    settingsRulesButton: '📜 Reglas',
    settingsGoodbyeButton: '👋 Despedida',
    settingsLanguageButton: 'Idioma',
    settingsTimeZoneButton: 'Zona horaria',
    settingsBackButton: 'Volver',
    settingsCloseButton: 'Cerrar',
    settingsWebAppButton: 'Abrir app de ajustes',
    settingsLanguagePrompt: 'Elige el idioma del grupo:',
    settingsTimeZonePrompt: 'Elige una zona horaria común. Usa el comando para otra zona IANA compatible.',
    settingsFeatureStatus: (feature, enabled) => `${settingsFeatureNameEs(feature)}\n\nEstado: ${enabled ? 'Activado' : 'Desactivado'}`,
    settingsFeatureEditButton: 'Editar',
    settingsFeatureDisableButton: 'Desactivar',
    settingsFeaturePrompt: (feature) => `Envía el nuevo texto de ${settingsFeatureNameEs(feature).toLowerCase()}. Envía /cancel para cancelar.`,
    settingsFeatureUpdated: (feature, enabled) => `${settingsFeatureNameEs(feature)} ${enabled ? 'activada' : 'desactivada'}.`,
    settingsFeatureTooLong: 'Este texto es demasiado largo para Telegram o para la función seleccionada. Acórtalo y vuelve a intentarlo.',
    localeName: (locale) => ({ 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' })[locale],
    privateGroupButton: (index, title) => `${index}. ${title}`,
    administratorHelp:
      '\nComandos de administrador:\n/settings — Ver o actualizar el idioma y la zona horaria de este grupo.\n/reload — Actualizar el estado actual de este grupo en FOAB.',
    privateSettings:
      'Usa /settings para listar grupos donde se confirmó tu estado de administrador. Después usa /settings select <número> y actualiza el grupo elegido con `/settings language en-US`, `/settings language pt-BR`, `/settings language es-ES` o `/settings timezone Area/Location`.',
    privateGroupsHeader: 'Grupos donde se confirmó tu estado actual de administrador:',
    privateGroupsEmpty: 'No se encontró un grupo activo donde se pudiera confirmar tu estado actual de administrador.',
    privateGroupList: (entries) => `Elige un grupo con /settings select <número>:\n${entries.join('\n')}`,
    privateSelectionUsage: 'Ejecuta /settings primero en este chat privado y después usa /settings select <número>. La selección caduca en 10 minutos.',
    privateSelectionExpired: 'Esa selección de grupo no existe o caducó. Ejecuta /settings para cargar de nuevo los grupos que administras.',
    groupSettings: (locale, timeZone, revision) =>
      `Ajustes del grupo (revisión ${revision}):\nIdioma: ${locale}\nZona horaria: ${timeZone}\n\nUsa /settings language <en-US|pt-BR|es-ES> o /settings timezone <zona IANA> para actualizar. Usa /cancel para cerrar este flujo de ajustes.`,
    settingsUsage:
      'Usa /settings para consultar este grupo, o /settings language <en-US|pt-BR|es-ES> y /settings timezone <zona IANA>.',
    settingsUpdated: 'Ajustes del grupo actualizados correctamente.',
    settingsNotAuthorized: 'Solo un administrador actual de este grupo puede cambiar sus ajustes.',
    settingsConflict: 'Estos ajustes cambiaron antes de aplicar tu comando. Ejecuta /settings de nuevo y vuelve a intentarlo.',
    reloadCompleted: 'FOAB actualizó correctamente el estado actual de este grupo.',
    reloadFailed: 'FOAB no pudo actualizar el estado de este grupo. Comprueba que el bot siga siendo administrador e inténtalo de nuevo.',
    reloadNotAuthorized: 'Solo un administrador actual de este grupo puede actualizar el estado de FOAB.',
    cancelNoActiveFlow: 'No tienes un flujo activo de FOAB en este grupo.',
    cancelCompleted: 'Tu flujo activo de FOAB fue cancelado.',
  },
};

/** Returns the localized feature label used by the inline fallback flow. */
function settingsFeatureNameEn(feature: 'welcome' | 'rules' | 'goodbye'): string {
  switch (feature) {
    case 'welcome':
      return 'Welcome message';
    case 'rules':
      return 'Rules';
    case 'goodbye':
      return 'Goodbye message';
  }
}

/** Returns the localized feature label used by the inline fallback flow. */
function settingsFeatureNamePt(feature: 'welcome' | 'rules' | 'goodbye'): string {
  switch (feature) {
    case 'welcome':
      return 'Mensagem de boas-vindas';
    case 'rules':
      return 'Regras';
    case 'goodbye':
      return 'Mensagem de despedida';
  }
}

/** Returns the localized feature label used by the inline fallback flow. */
function settingsFeatureNameEs(feature: 'welcome' | 'rules' | 'goodbye'): string {
  switch (feature) {
    case 'welcome':
      return 'Mensaje de bienvenida';
    case 'rules':
      return 'Reglas';
    case 'goodbye':
      return 'Mensaje de despedida';
  }
}

/** Returns the requested initial message catalog. */
export function getMessages(locale: SupportedLocale): MessageCatalog {
  return catalogs[locale];
}

/** Builds help for the caller's current scope and authority. */
export function getHelpMessage(
  locale: SupportedLocale,
  isAdministrator: boolean,
  isPrivateChat = false,
): string {
  const messages = getMessages(locale);
  if (isPrivateChat) {
    return `${messages.help}\n\n${messages.privateSettings}`;
  }
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
