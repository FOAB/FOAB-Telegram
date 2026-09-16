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
  readonly noGroups: string;
  readonly groupType: (type: 'group' | 'supergroup') => string;
  readonly configure: string;
  readonly settingsTitle: string;
  readonly language: string;
  readonly timeZone: string;
  readonly save: string;
  readonly saving: string;
  readonly saved: string;
  readonly back: string;
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
    noGroups: 'No active group was found where your administrator access could be confirmed.',
    groupType: (type) => type === 'supergroup' ? 'Supergroup' : 'Group',
    configure: 'Configure',
    settingsTitle: 'Group settings',
    language: 'Language',
    timeZone: 'Time zone',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Changes saved.',
    back: 'Back to groups',
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
    noGroups: 'Não foi encontrado um grupo ativo onde seu acesso de administrador pudesse ser confirmado.',
    groupType: (type) => type === 'supergroup' ? 'Supergrupo' : 'Grupo',
    configure: 'Configurar',
    settingsTitle: 'Configurações do grupo',
    language: 'Idioma',
    timeZone: 'Fuso horário',
    save: 'Salvar alterações',
    saving: 'Salvando…',
    saved: 'Alterações salvas.',
    back: 'Voltar aos grupos',
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
    noGroups: 'No se encontró un grupo activo donde se pudiera confirmar tu acceso de administrador.',
    groupType: (type) => type === 'supergroup' ? 'Supergrupo' : 'Grupo',
    configure: 'Configurar',
    settingsTitle: 'Ajustes del grupo',
    language: 'Idioma',
    timeZone: 'Zona horaria',
    save: 'Guardar cambios',
    saving: 'Guardando…',
    saved: 'Cambios guardados.',
    back: 'Volver a los grupos',
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
