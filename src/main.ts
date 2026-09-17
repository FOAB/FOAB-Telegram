import {
  ConfigurationError,
  loadRuntimeConfig,
  type ConfigurationDiagnostics,
  type ConfigurationIssueReason,
} from './config/environment.js';
import { createDatabase } from './db/database.js';
import { ensureCurrentInstallation } from './db/installation-repository.js';
import { GroupRepository } from './db/group-repository.js';
import { UpdateInboxRepository } from './db/update-inbox-repository.js';
import { createWebAppServer } from './webapp/api.js';
import {
  groupAdministratorCommandMenu,
  groupCommandMenu,
  localizedCommandMenus,
  privateMenuButton,
  privateCommandMenu,
} from './telegram/commands.js';
import { createBot } from './telegram/create-bot.js';

interface SafeLogFields {
  readonly botId?: number;
  readonly configurationVariables?: readonly string[];
  readonly configurationIssues?: readonly ConfigurationIssueLog[];
  readonly webAppEnabled?: boolean;
  readonly phase?: StartupPhase;
  readonly updateId?: number;
  readonly errorType?: string;
}

interface ConfigurationIssueLog {
  readonly variableName: string;
  readonly reason: ConfigurationIssueReason;
  readonly diagnostics?: ConfigurationDiagnostics;
}

type StartupPhase =
  | 'configuration_validation'
  | 'database_connection'
  | 'installation_initialization'
  | 'telegram_command_registration'
  | 'private_menu_registration'
  | 'web_app_start'
  | 'telegram_polling_start';

let activeStartupPhase: StartupPhase = 'configuration_validation';

/** Writes a single structured event using an explicit, non-sensitive field allowlist. */
function writeLog(
  level: 'info' | 'error',
  event: string,
  fields: SafeLogFields = {},
): void {
  const record = { timestamp: new Date().toISOString(), level, event, ...fields };
  const output = `${JSON.stringify(record)}\n`;

  if (level === 'error') {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
}

/** Validates configuration, initializes PostgreSQL state, and starts the Telegram poller. */
async function main(): Promise<void> {
  activeStartupPhase = 'configuration_validation';
  const config = loadRuntimeConfig();
  writeLog('info', 'runtime_configuration_loaded', {
    phase: 'configuration_validation',
    configurationVariables: [
      'FOAB_TELEGRAM_BOT_TOKEN',
      'FOAB_DATABASE_URL',
      'FOAB_WEB_APP_HOST',
      'FOAB_WEB_APP_PORT',
      ...(config.webAppUrl === null ? [] : ['FOAB_WEB_APP_URL']),
    ],
  });
  const database = createDatabase(config.databaseUrl);
  database.pool.on('error', (error: Error) => {
    writeLog('error', 'database_idle_connection_failed', {
      errorType: error.name,
    });
  });

  try {
    activeStartupPhase = 'database_connection';
    writeLog('info', 'database_connection_started', { phase: 'database_connection' });
    await database.pool.query('SELECT 1');
    writeLog('info', 'database_connection_succeeded', { phase: 'database_connection' });
    activeStartupPhase = 'installation_initialization';
    writeLog('info', 'installation_initialization_started', {
      phase: 'installation_initialization',
    });
    const installationId = await ensureCurrentInstallation(database.db);
    writeLog('info', 'installation_initialization_succeeded', {
      phase: 'installation_initialization',
    });
    const groups = new GroupRepository(database.db);
    const bot = createBot(config.telegramBotToken, {
      installationId,
      groups,
      inbox: new UpdateInboxRepository(database.db),
      ...(config.webAppUrl === null ? {} : { webAppUrl: config.webAppUrl }),
    });

    activeStartupPhase = 'telegram_command_registration';
    bot.catch(({ ctx, error }) => {
      writeLog('error', 'telegram_update_failed', {
        updateId: ctx.update.update_id,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
    });

    writeLog('info', 'telegram_command_registration_started', { phase: activeStartupPhase });
    await bot.api.setMyCommands(privateCommandMenu, {
      scope: { type: 'all_private_chats' },
    });
    await bot.api.setMyCommands(groupCommandMenu, {
      scope: { type: 'all_group_chats' },
    });
    await bot.api.setMyCommands(groupAdministratorCommandMenu, {
      scope: { type: 'all_chat_administrators' },
    });
    for (const menu of localizedCommandMenus) {
      await bot.api.setMyCommands(menu.privateCommands, {
        scope: { type: 'all_private_chats' },
        language_code: menu.languageCode,
      });
      await bot.api.setMyCommands(menu.groupCommands, {
        scope: { type: 'all_group_chats' },
        language_code: menu.languageCode,
      });
      await bot.api.setMyCommands(menu.groupAdministratorCommands, {
        scope: { type: 'all_chat_administrators' },
        language_code: menu.languageCode,
      });
    }
    writeLog('info', 'telegram_command_registration_succeeded', {
      phase: activeStartupPhase,
    });
    activeStartupPhase = 'private_menu_registration';
    writeLog('info', 'private_menu_registration_started', {
      phase: activeStartupPhase,
    });
    await bot.api.setChatMenuButton({
      menu_button: privateMenuButton(config.webAppUrl),
    });
    writeLog('info', 'private_menu_registration_succeeded', {
      phase: activeStartupPhase,
      ...(config.webAppUrl === null ? {} : { webAppEnabled: true }),
    });

    const webAppServer = config.webAppUrl === null
      ? null
      : createWebAppServer({
        botToken: config.telegramBotToken,
        groups,
        installationId,
        telegram: bot.api,
        webAppUrl: config.webAppUrl,
      });
    if (webAppServer) {
      activeStartupPhase = 'web_app_start';
      writeLog('info', 'web_app_start_started', { phase: activeStartupPhase });
      await webAppServer.listen({ host: config.webAppHost, port: config.webAppPort });
      writeLog('info', 'web_app_start_succeeded', { phase: activeStartupPhase });
    }

    try {
      activeStartupPhase = 'telegram_polling_start';
      writeLog('info', 'telegram_polling_start_started', { phase: activeStartupPhase });
      await bot.start({
        allowed_updates: ['message', 'my_chat_member', 'callback_query'],
        onStart: (botInfo) => {
          writeLog('info', 'telegram_bot_started', { botId: botInfo.id });
        },
      });
    } finally {
      if (webAppServer) {
        await webAppServer.close();
      }
    }
  } finally {
    await database.pool.end();
  }
}

void main().catch((error: unknown) => {
  const configurationVariables = error instanceof ConfigurationError
    ? error.variableNames
    : undefined;
  const configurationIssues = error instanceof ConfigurationError
    ? error.issues.map((issue) => ({
      variableName: issue.variableName,
      reason: issue.reason,
      ...(issue.diagnostics === undefined ? {} : { diagnostics: issue.diagnostics }),
    }))
    : undefined;
  writeLog('error', 'telegram_bot_start_failed', {
    errorType: error instanceof Error ? error.name : 'UnknownError',
    phase: activeStartupPhase,
    ...(configurationVariables === undefined ? {} : { configurationVariables }),
    ...(configurationIssues === undefined ? {} : { configurationIssues }),
  });
  process.exitCode = 1;
});
