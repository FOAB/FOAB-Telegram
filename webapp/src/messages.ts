/** Supported UI locales shared with the server settings contract. */
export type UiLocale = 'en-US' | 'pt-BR' | 'es-ES';

/** User-facing Mini App copy kept outside the TypeScript application logic. */
export interface UiMessages {
  readonly appTitle: string;
  readonly appSubtitle: string;
  readonly loading: string;
  readonly openFromTelegram: string;
  readonly sessionExpired: string;
  readonly retry: string;
  readonly groupsTitle: string;
  readonly groupsSubtitle: string;
  readonly searchGroups: string;
  readonly clearSearch: string;
  readonly noGroups: string;
  readonly noGroupMatches: string;
  readonly groupType: (type: 'group' | 'supergroup') => string;
  readonly settingsTitle: string;
  readonly settingsHomeSubtitle: string;
  readonly botSettingsTitle: string;
  readonly botSettingsButton: string;
  readonly botSettingsDescription: string;
  readonly privateSettingsSectionTitle: string;
  readonly privateLanguageLabel: string;
  readonly privateLanguageHelp: string;
  readonly settingsListTitle: string;
  readonly generalTitle: string;
  readonly generalHelp: string;
  readonly messagesSectionTitle: string;
  readonly rulesTitle: string;
  readonly rulesCategoryHelp: string;
  readonly language: string;
  readonly timeZone: string;
  readonly welcomeMessage: string;
  readonly welcomeHelp: string;
  readonly welcomeDescription: string;
  readonly welcomeMode: string;
  readonly goodbyeMessage: string;
  readonly goodbyeHelp: string;
  readonly goodbyeDescription: string;
  readonly goodbyeMode: string;
  readonly rulesText: string;
  readonly rulesHelp: string;
  readonly save: string;
  readonly saving: string;
  readonly saved: string;
  readonly back: string;
  readonly backToSettings: string;
  readonly status: string;
  readonly enabled: string;
  readonly disabled: string;
  readonly mode: string;
  readonly messageModeAlways: string;
  readonly messageModeFirstEntry: string;
  readonly deletePreviousMessage: string;
  readonly deletePreviousOn: string;
  readonly deletePreviousOff: string;
  readonly customizeMessage: string;
  readonly enable: string;
  readonly disable: string;
  readonly messageEditorHelp: string;
  readonly close: string;
  readonly reload: string;
  readonly selectGroup: string;
  readonly revisionConflict: string;
  readonly unauthorized: string;
  readonly forbidden: string;
  readonly genericError: string;
  readonly timezoneHelp: string;
  readonly localeNames: Readonly<Record<UiLocale, string>>;
}

const catalogs: Readonly<Record<UiLocale, UiMessages>> = {
  'en-US': {
    appTitle: 'FOAB Administration',
    appSubtitle: 'Manage the groups where your current administrator access is confirmed.',
    loading: 'Loading settings…',
    openFromTelegram: 'Open this Mini App from Telegram to continue.',
    sessionExpired: 'Your session expired. Open the Mini App again to continue.',
    retry: 'Try again',
    groupsTitle: 'Your groups',
    groupsSubtitle: 'Choose a group to manage its shared settings.',
    searchGroups: 'Search',
    clearSearch: 'Clear search',
    noGroups: 'No active group was found where your administrator access could be confirmed.',
    noGroupMatches: 'No group matches this search.',
    groupType: (type) => type === 'supergroup' ? 'Supergroup' : 'Group',
    settingsTitle: 'Group settings',
    settingsHomeSubtitle: 'Choose a category to manage this group.',
    botSettingsTitle: 'Bot settings',
    botSettingsButton: 'Private settings',
    botSettingsDescription: 'Language used by FOAB in your private chat.',
    privateSettingsSectionTitle: 'Private chat',
    privateLanguageLabel: 'Language',
    privateLanguageHelp: 'FOAB will use this language when responding to you privately.',
    settingsListTitle: 'Settings',
    generalTitle: 'General',
    generalHelp: 'Language and time zone',
    messagesSectionTitle: 'Messages',
    rulesTitle: 'Rules',
    rulesCategoryHelp: 'Publish the rules members can read',
    language: 'Language',
    timeZone: 'Time zone',
    welcomeMessage: 'Welcome message',
    welcomeHelp: 'Sent when new members join. Leave empty to disable it.',
    welcomeDescription: 'Send a message when someone joins this group.',
    welcomeMode: 'Send the configured message whenever a new member joins.',
    goodbyeMessage: 'Goodbye message',
    goodbyeHelp: 'Sent when a member leaves. Leave empty to disable it.',
    goodbyeDescription: 'Send a message when someone leaves this group.',
    goodbyeMode: 'Send the configured message whenever a member leaves.',
    rulesText: 'Group rules',
    rulesHelp: 'Shown to members with /rules. Leave empty when the group has no published rules.',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Changes saved.',
    back: 'Back to groups',
    backToSettings: 'Back to settings',
    status: 'Status',
    enabled: 'Enabled',
    disabled: 'Disabled',
    mode: 'Mode',
    messageModeAlways: 'Always send',
    messageModeFirstEntry: 'Send first entry',
    deletePreviousMessage: 'Delete previous message',
    deletePreviousOn: 'Enabled',
    deletePreviousOff: 'Disabled',
    customizeMessage: 'Customize message',
    enable: 'Enable',
    disable: 'Disable',
    messageEditorHelp: 'Leave the field empty and save to disable this feature.',
    close: 'Close',
    reload: 'Reload',
    selectGroup: 'Select a group',
    revisionConflict: 'These settings changed elsewhere. Reload the group and review the current values.',
    unauthorized: 'Your Telegram session could not be verified.',
    forbidden: 'You are no longer an administrator of this group.',
    genericError: 'The request could not be completed. Try again.',
    timezoneHelp: 'Choose a common zone. Other supported IANA zones can be entered later through the fallback flow.',
    localeNames: { 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' },
  },
  'pt-BR': {
    appTitle: 'Administração FOAB',
    appSubtitle: 'Gerencie os grupos onde seu acesso atual de administrador foi confirmado.',
    loading: 'Carregando configurações…',
    openFromTelegram: 'Abra este Mini App pelo Telegram para continuar.',
    sessionExpired: 'Sua sessão expirou. Abra o Mini App novamente para continuar.',
    retry: 'Tentar novamente',
    groupsTitle: 'Seus grupos',
    groupsSubtitle: 'Escolha um grupo para gerenciar suas configurações compartilhadas.',
    searchGroups: 'Pesquisar',
    clearSearch: 'Limpar pesquisa',
    noGroups: 'Não foi encontrado um grupo ativo onde seu acesso de administrador pudesse ser confirmado.',
    noGroupMatches: 'Nenhum grupo corresponde a esta pesquisa.',
    groupType: (type) => type === 'supergroup' ? 'Supergrupo' : 'Grupo',
    settingsTitle: 'Configurações do grupo',
    settingsHomeSubtitle: 'Escolha uma categoria para gerenciar este grupo.',
    botSettingsTitle: 'Configurações do bot',
    botSettingsButton: 'Configurações privadas',
    botSettingsDescription: 'Idioma usado pelo FOAB na sua conversa privada.',
    privateSettingsSectionTitle: 'Conversa privada',
    privateLanguageLabel: 'Idioma',
    privateLanguageHelp: 'O FOAB usará este idioma ao responder você no privado.',
    settingsListTitle: 'Configurações',
    generalTitle: 'Geral',
    generalHelp: 'Idioma e fuso horário',
    messagesSectionTitle: 'Mensagens',
    rulesTitle: 'Regras',
    rulesCategoryHelp: 'Publique as regras que os membros podem consultar',
    language: 'Idioma',
    timeZone: 'Fuso horário',
    welcomeMessage: 'Mensagem de boas-vindas',
    welcomeHelp: 'Enviada quando novos membros entram. Deixe vazia para desativar.',
    welcomeDescription: 'Envie uma mensagem quando alguém entrar neste grupo.',
    welcomeMode: 'Enviar a mensagem configurada sempre que um novo membro entrar.',
    goodbyeMessage: 'Mensagem de despedida',
    goodbyeHelp: 'Enviada quando um membro sai. Deixe vazia para desativar.',
    goodbyeDescription: 'Envie uma mensagem quando alguém sair deste grupo.',
    goodbyeMode: 'Enviar a mensagem configurada sempre que um membro sair.',
    rulesText: 'Regras do grupo',
    rulesHelp: 'Exibidas aos membros com /rules. Deixe vazias quando o grupo não tiver regras publicadas.',
    save: 'Salvar alterações',
    saving: 'Salvando…',
    saved: 'Alterações salvas.',
    back: 'Voltar aos grupos',
    backToSettings: 'Voltar às configurações',
    status: 'Status',
    enabled: 'Ativado',
    disabled: 'Desativado',
    mode: 'Modo',
    messageModeAlways: 'Sempre enviar',
    messageModeFirstEntry: 'Enviar 1ª entrada',
    deletePreviousMessage: 'Deletar mensagem anterior',
    deletePreviousOn: 'Ativado',
    deletePreviousOff: 'Desativado',
    customizeMessage: 'Personalizar mensagem',
    enable: 'Ativar',
    disable: 'Desativar',
    messageEditorHelp: 'Deixe o campo vazio e salve para desativar este recurso.',
    close: 'Fechar',
    reload: 'Recarregar',
    selectGroup: 'Selecione um grupo',
    revisionConflict: 'Estas configurações mudaram em outro lugar. Recarregue o grupo e revise os valores atuais.',
    unauthorized: 'Sua sessão do Telegram não pôde ser verificada.',
    forbidden: 'Você não é mais administrador deste grupo.',
    genericError: 'Não foi possível concluir a solicitação. Tente novamente.',
    timezoneHelp: 'Escolha um fuso comum. Outros fusos IANA compatíveis poderão ser informados pelo fluxo alternativo.',
    localeNames: { 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' },
  },
  'es-ES': {
    appTitle: 'Administración FOAB',
    appSubtitle: 'Administra los grupos donde se confirmó tu acceso actual de administrador.',
    loading: 'Cargando ajustes…',
    openFromTelegram: 'Abre este Mini App desde Telegram para continuar.',
    sessionExpired: 'Tu sesión caducó. Abre el Mini App de nuevo para continuar.',
    retry: 'Intentar de nuevo',
    groupsTitle: 'Tus grupos',
    groupsSubtitle: 'Elige un grupo para administrar sus ajustes compartidos.',
    searchGroups: 'Buscar',
    clearSearch: 'Borrar búsqueda',
    noGroups: 'No se encontró un grupo activo donde se pudiera confirmar tu acceso de administrador.',
    noGroupMatches: 'Ningún grupo coincide con esta búsqueda.',
    groupType: (type) => type === 'supergroup' ? 'Supergrupo' : 'Grupo',
    settingsTitle: 'Ajustes del grupo',
    settingsHomeSubtitle: 'Elige una categoría para administrar este grupo.',
    botSettingsTitle: 'Ajustes del bot',
    botSettingsButton: 'Ajustes privados',
    botSettingsDescription: 'Idioma que FOAB usa en tu conversación privada.',
    privateSettingsSectionTitle: 'Chat privado',
    privateLanguageLabel: 'Idioma',
    privateLanguageHelp: 'FOAB usará este idioma al responderte en privado.',
    settingsListTitle: 'Ajustes',
    generalTitle: 'General',
    generalHelp: 'Idioma y zona horaria',
    messagesSectionTitle: 'Mensajes',
    rulesTitle: 'Reglas',
    rulesCategoryHelp: 'Publica las reglas que pueden consultar los miembros',
    language: 'Idioma',
    timeZone: 'Zona horaria',
    welcomeMessage: 'Mensaje de bienvenida',
    welcomeHelp: 'Se envía cuando entran nuevos miembros. Déjalo vacío para desactivarlo.',
    welcomeDescription: 'Envía un mensaje cuando alguien entra en este grupo.',
    welcomeMode: 'Envía el mensaje configurado cada vez que entra un nuevo miembro.',
    goodbyeMessage: 'Mensaje de despedida',
    goodbyeHelp: 'Se envía cuando un miembro sale. Déjalo vacío para desactivarlo.',
    goodbyeDescription: 'Envía un mensaje cuando alguien sale de este grupo.',
    goodbyeMode: 'Envía el mensaje configurado cada vez que sale un miembro.',
    rulesText: 'Reglas del grupo',
    rulesHelp: 'Se muestran a los miembros con /rules. Déjalo vacío si el grupo no tiene reglas publicadas.',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    saved: 'Cambios guardados.',
    back: 'Volver a los grupos',
    backToSettings: 'Volver a los ajustes',
    status: 'Estado',
    enabled: 'Activado',
    disabled: 'Desactivado',
    mode: 'Modo',
    messageModeAlways: 'Enviar siempre',
    messageModeFirstEntry: 'Enviar primera entrada',
    deletePreviousMessage: 'Eliminar mensaje anterior',
    deletePreviousOn: 'Activado',
    deletePreviousOff: 'Desactivado',
    customizeMessage: 'Personalizar mensaje',
    enable: 'Activar',
    disable: 'Desactivar',
    messageEditorHelp: 'Deja el campo vacío y guarda para desactivar este recurso.',
    close: 'Cerrar',
    reload: 'Recargar',
    selectGroup: 'Selecciona un grupo',
    revisionConflict: 'Estos ajustes cambiaron en otro lugar. Recarga el grupo y revisa los valores actuales.',
    unauthorized: 'No se pudo verificar tu sesión de Telegram.',
    forbidden: 'Ya no eres administrador de este grupo.',
    genericError: 'No se pudo completar la solicitud. Inténtalo de nuevo.',
    timezoneHelp: 'Elige una zona común. Otras zonas IANA compatibles podrán introducirse después mediante el flujo alternativo.',
    localeNames: { 'en-US': 'English', 'pt-BR': 'Português', 'es-ES': 'Español' },
  },
};

/** Maps Telegram's language hint to one of FOAB's supported UI locales. */
export function localeFromLanguageCode(languageCode: string | null): UiLocale {
  switch (languageCode?.toLowerCase().split('-')[0]) {
    case 'pt':
      return 'pt-BR';
    case 'es':
      return 'es-ES';
    default:
      return 'en-US';
  }
}

/** Returns the immutable catalog for the selected UI locale. */
export function getUiMessages(locale: UiLocale): UiMessages {
  return catalogs[locale];
}
