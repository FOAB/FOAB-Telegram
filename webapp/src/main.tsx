import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  WebAppApiClient,
  WebAppApiError,
  type GroupSettings,
  type GroupSettingsUpdate,
  type MessageDeliveryMode,
  type SessionState,
} from './api.js';
import {
  IconArrowLeft,
  IconChevronRight,
  IconDoorExit,
  IconFileText,
  IconListCheck,
  IconMessage,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { getUiMessages, localeFromLanguageCode, type UiLocale } from './messages.js';
import { initializeTelegramWebApp, type TelegramWebAppBridge } from './telegram-webapp.js';
import './styles.css';

const TIME_ZONE_OPTIONS = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon'] as const;
type SettingsSection = 'home' | 'general' | 'welcome' | 'goodbye' | 'rules';
type MessageFeatureDraft = Pick<GroupSettingsUpdate, 'welcomeMessage' | 'goodbyeMessage' | 'welcomeMode' | 'goodbyeMode' | 'deletePreviousWelcomeMessage' | 'deletePreviousGoodbyeMessage'>;

/** Root application for the private FOAB administration Mini App. */
function App(): ReactElement {
  const webApp = useMemo(() => initializeTelegramWebApp(), []);
  const api = useMemo(() => new WebAppApiClient(), []);
  const [session, setSession] = useState<SessionState | null>(null);
  const [groups, setGroups] = useState<readonly GroupSettings[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [privateSettingsOpen, setPrivateSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let currentSession: SessionState;
      try {
        currentSession = await api.getSession();
      } catch (getSessionError: unknown) {
        if (!(getSessionError instanceof WebAppApiError) || getSessionError.code !== 'unauthorized') {
          throw getSessionError;
        }
        const initData = webApp?.initData ?? '';
        if (initData.length === 0) {
          throw new WebAppApiError(401, 'not_launched_from_telegram');
        }
        currentSession = await api.createSession(initData);
      }
      const currentGroups = await api.listGroups();
      setSession(currentSession);
      setGroups(currentGroups);
      setPrivateSettingsOpen(false);
      setSelectedChatId((current) => current && currentGroups.some((group) => group.chatId === current)
        ? current
        : null);
      setSettingsSection('home');
    } catch (loadError: unknown) {
      setSession(null);
      setGroups([]);
      setError(errorMessage(loadError, webApp, 'en-US'));
    } finally {
      setLoading(false);
    }
  }, [api, webApp]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const backButton = webApp?.BackButton;
    if (!backButton || (webApp.isVersionAtLeast && !webApp.isVersionAtLeast('6.1'))) {
      return;
    }
    const handleBack = () => {
      if (privateSettingsOpen) {
        setPrivateSettingsOpen(false);
        return;
      }
      if (settingsSection !== 'home') {
        setSettingsSection('home');
      } else {
        setSelectedChatId(null);
      }
    };
    if (selectedChatId || privateSettingsOpen) {
      backButton.show();
      backButton.onClick(handleBack);
    } else {
      backButton.hide();
    }
    return () => backButton.offClick(handleBack);
  }, [privateSettingsOpen, selectedChatId, settingsSection, webApp]);

  const locale = session?.user.privateLocale ?? localeFromLanguageCode(session?.user.languageCode ?? null);
  const messages = getUiMessages(locale);
  const selectedGroup = groups.find((group) => group.chatId === selectedChatId) ?? null;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  if (loading) {
    return <PageShell messages={messages} webApp={webApp}><LoadingState text={messages.loading} /></PageShell>;
  }
  if (error || !session) {
    return (
      <PageShell messages={messages} webApp={webApp}>
        <ErrorState message={error ?? messages.genericError} onRetry={() => void load()} messages={messages} />
      </PageShell>
    );
  }
  if (privateSettingsOpen) {
    return (
      <PageShell messages={messages} webApp={webApp}>
        <BotSettingsView
          api={api}
          locale={session.user.privateLocale}
          messages={messages}
          onBack={() => setPrivateSettingsOpen(false)}
          onSaved={(privateLocale) => {
            setSession((current) => current
              ? { ...current, user: { ...current.user, privateLocale } }
              : current);
          }}
        />
      </PageShell>
    );
  }
  if (selectedGroup) {
    return (
      <PageShell messages={messages} webApp={webApp}>
        <SettingsView
          api={api}
          group={selectedGroup}
          messages={messages}
          section={settingsSection}
          onBack={() => {
            setPrivateSettingsOpen(false);
            setSelectedChatId(null);
            setSettingsSection('home');
          }}
          onSectionChange={setSettingsSection}
          onSaved={(updated) => {
            setGroups((current) => current.map((group) => group.chatId === updated.chatId ? updated : group));
          }}
        />
      </PageShell>
    );
  }
  return (
    <PageShell messages={messages} webApp={webApp}>
      <GroupsView
        groups={groups}
        messages={messages}
        onSelect={(chatId) => {
          setSelectedChatId(chatId);
          setSettingsSection('home');
        }}
        onReload={() => void load()}
        onOpenBotSettings={() => setPrivateSettingsOpen(true)}
      />
    </PageShell>
  );
}

/** Provides the Telegram-themed shell and accessible page landmarks. */
function PageShell({
  children,
  messages,
  webApp,
}: {
  readonly children: ReactNode;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly webApp: TelegramWebAppBridge | null;
}): ReactElement {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-mark" aria-hidden="true">F</div>
        <div className="app-header-copy">
          <h1>{messages.appTitle}</h1>
          <p>{messages.appSubtitle}</p>
        </div>
        {webApp?.close && (
          <button
            aria-label={messages.close}
            className="close-button"
            type="button"
            onClick={() => webApp.close?.()}
          >
            <IconX aria-hidden="true" size={22} stroke={1.8} />
          </button>
        )}
      </header>
      {children}
    </main>
  );
}

/** Shows a bounded loading state while session and group access are resolved. */
function LoadingState({ text }: { readonly text: string }): ReactElement {
  return <p className="status-card" role="status"><span className="spinner" aria-hidden="true" />{text}</p>;
}

/** Shows a translated recoverable error without echoing server details. */
function ErrorState({
  message,
  messages,
  onRetry,
}: {
  readonly message: string;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly onRetry: () => void;
}): ReactElement {
  return (
    <section className="status-card error-card" role="alert">
      <p>{message}</p>
      <button className="primary-button" type="button" onClick={onRetry}>{messages.retry}</button>
    </section>
  );
}

/** Renders the safe, server-filtered list of groups for this administrator. */
function GroupsView({
  groups,
  messages,
  onReload,
  onOpenBotSettings,
  onSelect,
}: {
  readonly groups: readonly GroupSettings[];
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly onReload: () => void;
  readonly onOpenBotSettings: () => void;
  readonly onSelect: (chatId: string) => void;
}): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(() => {
    if (normalizedSearchQuery.length === 0) {
      return groups;
    }
    return groups.filter((group) => {
      const searchableText = [
        group.title,
        group.username ?? '',
        messages.groupType(group.chatType),
      ].join(' ').toLocaleLowerCase();
      return searchableText.includes(normalizedSearchQuery);
    });
  }, [groups, messages, normalizedSearchQuery]);

  return (
    <section className="content-section" aria-labelledby="groups-title">
      <div className="group-search">
        <IconSearch aria-hidden="true" size={18} stroke={1.8} />
        <label className="sr-only" htmlFor="group-search-input">{messages.searchGroups}</label>
        <input
          id="group-search-input"
          type="search"
          value={searchQuery}
          placeholder={messages.searchGroups}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searchQuery.length > 0 && (
          <button
            className="group-search-clear"
            type="button"
            aria-label={messages.clearSearch}
            onClick={() => setSearchQuery('')}
          >
            <IconX aria-hidden="true" size={18} stroke={1.8} />
          </button>
        )}
      </div>
      <div className="section-heading group-section-heading">
        <div>
          <h2 id="groups-title">{messages.groupsTitle}</h2>
          <p>{messages.groupsSubtitle}</p>
        </div>
        <button className="text-button" type="button" onClick={onReload}>{messages.reload}</button>
      </div>
      {groups.length === 0 ? (
        <p className="status-card">{messages.noGroups}</p>
      ) : visibleGroups.length === 0 ? (
        <p className="status-card">{messages.noGroupMatches}</p>
      ) : (
        <div className="settings-list group-list">
          {visibleGroups.map((group) => (
            <button
              className="settings-list-row group-list-row"
              key={group.chatId}
              type="button"
              onClick={() => onSelect(group.chatId)}
            >
              <div className="group-icon" aria-hidden="true">{group.title.slice(0, 1).toUpperCase()}</div>
              <span className="settings-list-row-copy">
                <strong>{group.title}</strong>
                <span>{group.username ? `@${group.username}` : messages.groupType(group.chatType)}</span>
              </span>
              <IconChevronRight className="settings-list-row-chevron" aria-hidden="true" size={22} stroke={1.7} />
            </button>
          ))}
        </div>
      )}
      <div className="settings-list-group bot-settings-group">
        <div className="list-section-heading">
          <h3>{messages.botSettingsTitle}</h3>
        </div>
        <nav className="settings-list" aria-label={messages.botSettingsTitle}>
          <SettingsListRow
            icon={<IconSettings aria-hidden="true" size={22} stroke={1.7} />}
            title={messages.botSettingsButton}
            summary={messages.botSettingsDescription}
            onClick={onOpenBotSettings}
          />
        </nav>
      </div>
    </section>
  );
}

/** Edits private-chat preferences for the authenticated Telegram user. */
function BotSettingsView({
  api,
  locale,
  messages,
  onBack,
  onSaved,
}: {
  readonly api: WebAppApiClient;
  readonly locale: UiLocale;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly onBack: () => void;
  readonly onSaved: (locale: UiLocale) => void;
}): ReactElement {
  const [selectedLocale, setSelectedLocale] = useState<UiLocale>(locale);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLocale(locale);
  }, [locale]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const updatedLocale = selectedLocale === locale
        ? locale
        : await api.updatePrivateLocale(selectedLocale);
      onSaved(updatedLocale);
      setFeedback(messages.saved);
    } catch (saveError: unknown) {
      setFeedback(errorMessage(saveError, null, locale, messages));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="content-section" aria-labelledby="bot-settings-title">
      <button className="text-button back-button" type="button" onClick={onBack}>
        <IconArrowLeft aria-hidden="true" size={18} stroke={2} />
        {messages.back}
      </button>
      <div className="settings-heading">
        <div className="group-icon large" aria-hidden="true">
          <IconSettings size={24} stroke={1.8} />
        </div>
        <div>
          <h2 id="bot-settings-title">{messages.botSettingsTitle}</h2>
          <p>{messages.botSettingsDescription}</p>
        </div>
      </div>
      <div className="settings-list-group">
        <div className="list-section-heading">
          <h3>{messages.privateSettingsSectionTitle}</h3>
        </div>
        <form className="settings-form" onSubmit={save}>
          <label>
            <span>{messages.privateLanguageLabel}</span>
            <select value={selectedLocale} onChange={(event) => setSelectedLocale(event.target.value as UiLocale)}>
              {(Object.keys(messages.localeNames) as UiLocale[]).map((option) => (
                <option key={option} value={option}>{messages.localeNames[option]}</option>
              ))}
            </select>
          </label>
          <p className="field-help">{messages.privateLanguageHelp}</p>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? messages.saving : messages.save}
          </button>
        </form>
      </div>
    </section>
  );
}

/** Edits one group through the same optimistic API contract as the fallback buttons. */
function SettingsView({
  api,
  group,
  messages,
  section,
  onBack,
  onSectionChange,
  onSaved,
}: {
  readonly api: WebAppApiClient;
  readonly group: GroupSettings;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly section: SettingsSection;
  readonly onBack: () => void;
  readonly onSectionChange: (section: SettingsSection) => void;
  readonly onSaved: (group: GroupSettings) => void;
}): ReactElement {
  const [locale, setLocale] = useState<UiLocale>(group.locale);
  const [timeZone, setTimeZone] = useState(group.timeZone);
  const [welcomeMessage, setWelcomeMessage] = useState(group.welcomeMessage ?? '');
  const [welcomeMode, setWelcomeMode] = useState<MessageDeliveryMode>(group.welcomeMode);
  const [deletePreviousWelcomeMessage, setDeletePreviousWelcomeMessage] = useState(group.deletePreviousWelcomeMessage);
  const [goodbyeMessage, setGoodbyeMessage] = useState(group.goodbyeMessage ?? '');
  const [goodbyeMode, setGoodbyeMode] = useState<MessageDeliveryMode>(group.goodbyeMode);
  const [deletePreviousGoodbyeMessage, setDeletePreviousGoodbyeMessage] = useState(group.deletePreviousGoodbyeMessage);
  const [rulesText, setRulesText] = useState(group.rulesText ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLocale(group.locale);
    setTimeZone(group.timeZone);
    setWelcomeMessage(group.welcomeMessage ?? '');
    setWelcomeMode(group.welcomeMode);
    setDeletePreviousWelcomeMessage(group.deletePreviousWelcomeMessage);
    setGoodbyeMessage(group.goodbyeMessage ?? '');
    setGoodbyeMode(group.goodbyeMode);
    setDeletePreviousGoodbyeMessage(group.deletePreviousGoodbyeMessage);
    setRulesText(group.rulesText ?? '');
  }, [group]);

  const saveChanges = async (draft: MessageFeatureDraft = {}): Promise<void> => {
    setSaving(true);
    setFeedback(null);
    try {
      const nextWelcomeMessage = optionalText('welcomeMessage' in draft ? draft.welcomeMessage ?? '' : welcomeMessage);
      const nextWelcomeMode = draft.welcomeMode ?? welcomeMode;
      const nextDeletePreviousWelcomeMessage = draft.deletePreviousWelcomeMessage ?? deletePreviousWelcomeMessage;
      const nextGoodbyeMessage = optionalText('goodbyeMessage' in draft ? draft.goodbyeMessage ?? '' : goodbyeMessage);
      const nextGoodbyeMode = draft.goodbyeMode ?? goodbyeMode;
      const nextDeletePreviousGoodbyeMessage = draft.deletePreviousGoodbyeMessage ?? deletePreviousGoodbyeMessage;
      const nextRulesText = optionalText(rulesText);
      const update: GroupSettingsUpdate = {
        ...(locale === group.locale ? {} : { locale }),
        ...(timeZone === group.timeZone ? {} : { timeZone }),
        ...(nextWelcomeMessage === group.welcomeMessage ? {} : { welcomeMessage: nextWelcomeMessage }),
        ...(nextWelcomeMode === group.welcomeMode ? {} : { welcomeMode: nextWelcomeMode }),
        ...(nextDeletePreviousWelcomeMessage === group.deletePreviousWelcomeMessage ? {} : { deletePreviousWelcomeMessage: nextDeletePreviousWelcomeMessage }),
        ...(nextGoodbyeMessage === group.goodbyeMessage ? {} : { goodbyeMessage: nextGoodbyeMessage }),
        ...(nextGoodbyeMode === group.goodbyeMode ? {} : { goodbyeMode: nextGoodbyeMode }),
        ...(nextDeletePreviousGoodbyeMessage === group.deletePreviousGoodbyeMessage ? {} : { deletePreviousGoodbyeMessage: nextDeletePreviousGoodbyeMessage }),
        ...(nextRulesText === group.rulesText ? {} : { rulesText: nextRulesText }),
      };
      if (Object.keys(update).length === 0) {
        setFeedback(messages.saved);
        return;
      }
      const updated = await api.updateSettings(group, update);
      onSaved(updated);
      setFeedback(messages.saved);
    } catch (saveError: unknown) {
      setFeedback(errorMessage(saveError, null, 'en-US', messages));
    } finally {
      setSaving(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveChanges();
  };

  if (section === 'home') {
    return (
      <SettingsHomeView
        group={group}
        messages={messages}
        onBack={onBack}
        onOpen={onSectionChange}
      />
    );
  }

  if (section === 'welcome' || section === 'goodbye') {
    const isWelcome = section === 'welcome';
    return (
      <MessageFeatureView
        kind={section}
        group={group}
        messages={messages}
        message={isWelcome ? welcomeMessage : goodbyeMessage}
        mode={isWelcome ? welcomeMode : goodbyeMode}
        deletePrevious={isWelcome ? deletePreviousWelcomeMessage : deletePreviousGoodbyeMessage}
        onMessageChange={isWelcome ? setWelcomeMessage : setGoodbyeMessage}
        onModeChange={isWelcome ? setWelcomeMode : setGoodbyeMode}
        onDeletePreviousChange={isWelcome ? setDeletePreviousWelcomeMessage : setDeletePreviousGoodbyeMessage}
        onBack={() => onSectionChange('home')}
        onSave={saveChanges}
        saving={saving}
        feedback={feedback}
      />
    );
  }

  return (
    <section className="content-section" aria-labelledby="settings-title">
      <button className="text-button back-button" type="button" onClick={() => onSectionChange('home')}>
        <IconArrowLeft aria-hidden="true" size={18} stroke={2} />
        {messages.backToSettings}
      </button>
      <div className="settings-heading">
        <div className="group-icon large" aria-hidden="true">{group.title.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2 id="settings-title">{sectionTitle(section, messages)}</h2>
          <p>{group.title}</p>
        </div>
      </div>
      <form className="settings-form" onSubmit={save}>
        {section === 'general' && (
          <>
            <label>
              <span>{messages.language}</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value as UiLocale)}>
                {(Object.keys(messages.localeNames) as UiLocale[]).map((option) => (
                  <option key={option} value={option}>{messages.localeNames[option]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>{messages.timeZone}</span>
              <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)}>
                {!TIME_ZONE_OPTIONS.includes(timeZone as typeof TIME_ZONE_OPTIONS[number]) && (
                  <option value={timeZone}>{timeZone}</option>
                )}
                {TIME_ZONE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <p className="field-help">{messages.timezoneHelp}</p>
          </>
        )}
        {section === 'rules' && (
          <>
            <label>
              <span>{messages.rulesText}</span>
              <textarea
                maxLength={3800}
                rows={7}
                value={rulesText}
                onChange={(event) => setRulesText(event.target.value)}
              />
            </label>
            <p className="field-help">{messages.rulesHelp}</p>
          </>
        )}
        {feedback && <p className="form-feedback" role="status">{feedback}</p>}
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? messages.saving : messages.save}
        </button>
      </form>
    </section>
  );
}

/** Presents the category menu before any group setting is edited. */
function SettingsHomeView({
  group,
  messages,
  onBack,
  onOpen,
}: {
  readonly group: GroupSettings;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly onBack: () => void;
  readonly onOpen: (section: SettingsSection) => void;
}): ReactElement {
  return (
    <section className="content-section" aria-labelledby="settings-home-title">
      <button className="text-button back-button" type="button" onClick={onBack}>{messages.back}</button>
      <div className="settings-heading">
        <div className="group-icon large" aria-hidden="true">{group.title.slice(0, 1).toUpperCase()}</div>
        <div>
          <h2 id="settings-home-title">{group.title}</h2>
          <p>{messages.settingsTitle}</p>
        </div>
      </div>
      <p className="settings-home-subtitle">{messages.settingsHomeSubtitle}</p>
      <div className="settings-list-group">
        <div className="list-section-heading">
          <h3>{messages.settingsListTitle}</h3>
        </div>
        <nav className="settings-list" aria-label={messages.settingsListTitle}>
          <SettingsListRow icon={<IconSettings aria-hidden="true" size={22} stroke={1.7} />} title={messages.generalTitle} summary={messages.generalHelp} onClick={() => onOpen('general')} />
        </nav>
      </div>
      <div className="settings-list-group">
        <div className="list-section-heading">
          <h3>{messages.messagesSectionTitle}</h3>
        </div>
        <nav className="settings-list" aria-label={messages.messagesSectionTitle}>
          <SettingsListRow icon={<IconMessage aria-hidden="true" size={22} stroke={1.7} />} title={messages.welcomeMessage} summary={messages.welcomeDescription} meta={<StatusChip configured={optionalText(group.welcomeMessage ?? '') !== null} messages={messages} />} onClick={() => onOpen('welcome')} />
          <SettingsListRow icon={<IconFileText aria-hidden="true" size={22} stroke={1.7} />} title={messages.rulesTitle} summary={messages.rulesCategoryHelp} onClick={() => onOpen('rules')} />
          <SettingsListRow icon={<IconDoorExit aria-hidden="true" size={22} stroke={1.7} />} title={messages.goodbyeMessage} summary={messages.goodbyeDescription} meta={<StatusChip configured={optionalText(group.goodbyeMessage ?? '') !== null} messages={messages} />} onClick={() => onOpen('goodbye')} />
        </nav>
      </div>
    </section>
  );
}

/** Renders one compact status chip for a configurable message feature. */
function StatusChip({
  configured,
  messages,
}: {
  readonly configured: boolean;
  readonly messages: ReturnType<typeof getUiMessages>;
}): ReactElement {
  return (
    <span className={`status-chip ${configured ? 'status-chip-active' : 'status-chip-inactive'}`}>
      {configured ? messages.enabled : messages.disabled}
    </span>
  );
}

/** Renders one BotFather-style navigation row with a single interactive target. */
function SettingsListRow({
  icon,
  title,
  summary,
  meta,
  onClick,
}: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly summary?: string;
  readonly meta?: ReactNode;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button className="settings-list-row" type="button" onClick={onClick}>
      <span className="settings-list-row-icon">{icon}</span>
      <span className="settings-list-row-copy">
        <strong>{title}</strong>
        {summary && <span>{summary}</span>}
      </span>
      {meta && <span className="settings-list-row-meta">{meta}</span>}
      <IconChevronRight className="settings-list-row-chevron" aria-hidden="true" size={22} stroke={1.7} />
    </button>
  );
}

/** Presents status and focused actions for one welcome or goodbye message. */
function MessageFeatureView({
  kind,
  group,
  messages,
  message,
  mode,
  deletePrevious,
  onMessageChange,
  onModeChange,
  onDeletePreviousChange,
  onBack,
  onSave,
  saving,
  feedback,
}: {
  readonly kind: 'welcome' | 'goodbye';
  readonly group: GroupSettings;
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly message: string;
  readonly mode: MessageDeliveryMode;
  readonly deletePrevious: boolean;
  readonly onMessageChange: (value: string) => void;
  readonly onModeChange: (value: MessageDeliveryMode) => void;
  readonly onDeletePreviousChange: (value: boolean) => void;
  readonly onBack: () => void;
  readonly onSave: (draft?: MessageFeatureDraft) => Promise<void>;
  readonly saving: boolean;
  readonly feedback: string | null;
}): ReactElement {
  const [editorOpen, setEditorOpen] = useState(false);
  const isWelcome = kind === 'welcome';
  const title = isWelcome ? messages.welcomeMessage : messages.goodbyeMessage;
  const description = isWelcome ? messages.welcomeDescription : messages.goodbyeDescription;
  const configured = optionalText(message) !== null;

  const messageField = isWelcome ? 'welcomeMessage' : 'goodbyeMessage';
  const modeField = isWelcome ? 'welcomeMode' : 'goodbyeMode';
  const deleteField = isWelcome ? 'deletePreviousWelcomeMessage' : 'deletePreviousGoodbyeMessage';
  const saveFeatureDraft = (draft: MessageFeatureDraft): void => {
    void onSave(draft);
  };

  return (
    <section className="content-section" aria-labelledby="message-feature-title">
      <button className="text-button back-button" type="button" onClick={onBack}>
        <IconArrowLeft aria-hidden="true" size={18} stroke={2} />
        {messages.backToSettings}
      </button>
      <div className="settings-heading">
        <div className="group-icon large" aria-hidden="true">
          <IconMessage size={24} stroke={1.8} />
        </div>
        <div>
          <h2 id="message-feature-title">{title}</h2>
          <p>{group.title}</p>
        </div>
      </div>
      <div className="feature-summary">
        <p>{description}</p>
        <div className="feature-detail-row">
          <strong>{messages.status}</strong>
          <span className={`status-chip ${configured ? 'status-chip-active' : 'status-chip-inactive'}`}>
            {configured ? messages.enabled : messages.disabled}
          </span>
        </div>
        <div className="feature-detail-row feature-mode-row">
          <strong>{messages.mode}</strong>
          <span>{mode === 'always' ? messages.messageModeAlways : messages.messageModeFirstEntry}</span>
        </div>
        <div className="feature-detail-row">
          <strong>{messages.deletePreviousMessage}</strong>
          <span>{deletePrevious ? messages.deletePreviousOn : messages.deletePreviousOff}</span>
        </div>
      </div>
      <div className="feature-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={!configured}
          onClick={() => {
            onMessageChange('');
            saveFeatureDraft({ [messageField]: null });
          }}
        >
          {messages.disable}
        </button>
        <button className="primary-button" type="button" onClick={() => setEditorOpen(true)}>
          {configured ? messages.customizeMessage : messages.enable}
        </button>
      </div>
      <div className="feature-options" aria-label={messages.mode}>
        <p className="feature-options-title">{messages.mode}</p>
        <div className="feature-option-grid">
          <button
            className={`feature-option ${mode === 'always' ? 'feature-option-active' : ''}`}
            type="button"
            onClick={() => {
              onModeChange('always');
              saveFeatureDraft({ [modeField]: 'always' });
            }}
          >
            {messages.messageModeAlways}
          </button>
          <button
            className={`feature-option ${mode === 'first' ? 'feature-option-active' : ''}`}
            type="button"
            onClick={() => {
              onModeChange('first');
              saveFeatureDraft({ [modeField]: 'first' });
            }}
          >
            {messages.messageModeFirstEntry}
          </button>
        </div>
        <button
          className={`feature-option feature-option-wide ${deletePrevious ? 'feature-option-active' : ''}`}
          type="button"
          onClick={() => {
            const nextValue = !deletePrevious;
            onDeletePreviousChange(nextValue);
            saveFeatureDraft({ [deleteField]: nextValue });
          }}
        >
          {messages.deletePreviousMessage}: {deletePrevious ? messages.deletePreviousOn : messages.deletePreviousOff}
        </button>
      </div>
      {editorOpen && (
        <form
          className="settings-form feature-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ [messageField]: message });
          }}
        >
          <label>
            <span>{title}</span>
            <textarea
              maxLength={4096}
              rows={5}
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
            />
          </label>
          <p className="field-help">{isWelcome ? messages.welcomeHelp : messages.goodbyeHelp}</p>
          <p className="field-help">{messages.messageEditorHelp}</p>
          {feedback && <p className="form-feedback" role="status">{feedback}</p>}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? messages.saving : messages.save}
          </button>
        </form>
      )}
      {!editorOpen && feedback && <p className="form-feedback" role="status">{feedback}</p>}
    </section>
  );
}

function sectionTitle(section: 'general' | 'rules', messages: ReturnType<typeof getUiMessages>): string {
  switch (section) {
    case 'general':
      return messages.generalTitle;
    case 'rules':
      return messages.rulesTitle;
  }
}

/** Treat whitespace-only content as a deliberate disabled configuration. */
function optionalText(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

/** Converts API error codes into localized UI copy and hides raw exception text. */
function errorMessage(
  error: unknown,
  webApp: TelegramWebAppBridge | null,
  fallbackLocale: UiLocale,
  settingsMessages = getUiMessages(fallbackLocale),
): string {
  if (error instanceof WebAppApiError) {
    switch (error.code) {
      case 'not_launched_from_telegram':
        return settingsMessages.openFromTelegram;
      case 'revision_conflict':
        return settingsMessages.revisionConflict;
      case 'forbidden':
        return settingsMessages.forbidden;
      case 'unauthorized':
      case 'invalid_telegram_session':
        return webApp ? settingsMessages.unauthorized : settingsMessages.sessionExpired;
      default:
        return settingsMessages.genericError;
    }
  }
  return settingsMessages.genericError;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><App /></StrictMode>,
);
