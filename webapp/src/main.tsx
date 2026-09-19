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
  type SessionState,
} from './api.js';
import {
  IconArrowLeft,
  IconChevronRight,
  IconListCheck,
  IconMessage,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { getUiMessages, localeFromLanguageCode, type UiLocale } from './messages.js';
import { initializeTelegramWebApp, type TelegramWebAppBridge } from './telegram-webapp.js';
import './styles.css';

const TIME_ZONE_OPTIONS = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/Lisbon'] as const;
type SettingsSection = 'home' | 'general' | 'messages' | 'rules';

/** Root application for the private FOAB administration Mini App. */
function App(): ReactElement {
  const webApp = useMemo(() => initializeTelegramWebApp(), []);
  const api = useMemo(() => new WebAppApiClient(), []);
  const [session, setSession] = useState<SessionState | null>(null);
  const [groups, setGroups] = useState<readonly GroupSettings[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
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
      if (settingsSection !== 'home') {
        setSettingsSection('home');
      } else {
        setSelectedChatId(null);
      }
    };
    if (selectedChatId) {
      backButton.show();
      backButton.onClick(handleBack);
    } else {
      backButton.hide();
    }
    return () => backButton.offClick(handleBack);
  }, [selectedChatId, settingsSection, webApp]);

  const locale = localeFromLanguageCode(session?.user.languageCode ?? null);
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
  if (selectedGroup) {
    return (
      <PageShell messages={messages} webApp={webApp}>
        <SettingsView
          api={api}
          group={selectedGroup}
          messages={messages}
          section={settingsSection}
          onBack={() => {
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
  onSelect,
}: {
  readonly groups: readonly GroupSettings[];
  readonly messages: ReturnType<typeof getUiMessages>;
  readonly onReload: () => void;
  readonly onSelect: (chatId: string) => void;
}): ReactElement {
  return (
    <section className="content-section" aria-labelledby="groups-title">
      <div className="section-heading">
        <div>
          <h2 id="groups-title">{messages.groupsTitle}</h2>
          <p>{messages.groupsSubtitle}</p>
        </div>
        <button className="text-button" type="button" onClick={onReload}>{messages.reload}</button>
      </div>
      {groups.length === 0 ? (
        <p className="status-card">{messages.noGroups}</p>
      ) : (
        <div className="group-list">
          {groups.map((group) => (
            <article className="group-card" key={group.chatId}>
              <div className="group-icon" aria-hidden="true">{group.title.slice(0, 1).toUpperCase()}</div>
              <div className="group-card-content">
                <h3>{group.title}</h3>
                <p>{messages.groupType(group.chatType)}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => onSelect(group.chatId)}>
                {messages.configure}
              </button>
            </article>
          ))}
        </div>
      )}
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
  const [goodbyeMessage, setGoodbyeMessage] = useState(group.goodbyeMessage ?? '');
  const [rulesText, setRulesText] = useState(group.rulesText ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLocale(group.locale);
    setTimeZone(group.timeZone);
    setWelcomeMessage(group.welcomeMessage ?? '');
    setGoodbyeMessage(group.goodbyeMessage ?? '');
    setRulesText(group.rulesText ?? '');
  }, [group]);

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

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const nextWelcomeMessage = optionalText(welcomeMessage);
      const nextGoodbyeMessage = optionalText(goodbyeMessage);
      const nextRulesText = optionalText(rulesText);
      const update: GroupSettingsUpdate = {
        ...(locale === group.locale ? {} : { locale }),
        ...(timeZone === group.timeZone ? {} : { timeZone }),
        ...(nextWelcomeMessage === group.welcomeMessage ? {} : { welcomeMessage: nextWelcomeMessage }),
        ...(nextGoodbyeMessage === group.goodbyeMessage ? {} : { goodbyeMessage: nextGoodbyeMessage }),
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
        {section === 'messages' && (
          <>
            <label>
              <span>{messages.welcomeMessage}</span>
              <textarea
                maxLength={4096}
                rows={4}
                value={welcomeMessage}
                onChange={(event) => setWelcomeMessage(event.target.value)}
              />
            </label>
            <p className="field-help">{messages.welcomeHelp}</p>
            <label>
              <span>{messages.goodbyeMessage}</span>
              <textarea
                maxLength={4096}
                rows={4}
                value={goodbyeMessage}
                onChange={(event) => setGoodbyeMessage(event.target.value)}
              />
            </label>
            <p className="field-help">{messages.goodbyeHelp}</p>
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
      <nav className="settings-category-list" aria-label={messages.settingsTitle}>
        <CategoryButton icon={<IconSettings aria-hidden="true" size={22} stroke={1.8} />} title={messages.generalTitle} summary={messages.generalHelp} openLabel={messages.open} onClick={() => onOpen('general')} />
        <CategoryButton icon={<IconMessage aria-hidden="true" size={22} stroke={1.8} />} title={messages.messagesTitle} summary={messages.messagesHelp} openLabel={messages.open} onClick={() => onOpen('messages')} />
        <CategoryButton icon={<IconListCheck aria-hidden="true" size={22} stroke={1.8} />} title={messages.rulesTitle} summary={messages.rulesCategoryHelp} openLabel={messages.open} onClick={() => onOpen('rules')} />
      </nav>
    </section>
  );
}

/** Renders one large, touch-friendly category action in the group menu. */
function CategoryButton({
  icon,
  title,
  summary,
  openLabel,
  onClick,
}: {
  readonly icon: ReactElement;
  readonly title: string;
  readonly summary: string;
  readonly openLabel: string;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <button className="settings-category" type="button" onClick={onClick}>
      <span className="settings-category-icon">{icon}</span>
      <span className="settings-category-copy">
        <strong>{title}</strong>
        <span>{summary}</span>
      </span>
      <span className="settings-category-action">
        <span>{openLabel}</span>
        <IconChevronRight aria-hidden="true" size={18} stroke={1.8} />
      </span>
    </button>
  );
}

function sectionTitle(section: Exclude<SettingsSection, 'home'>, messages: ReturnType<typeof getUiMessages>): string {
  switch (section) {
    case 'general':
      return messages.generalTitle;
    case 'messages':
      return messages.messagesTitle;
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
