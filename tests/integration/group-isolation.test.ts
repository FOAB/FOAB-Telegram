import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { createDatabase, type FoabDatabase } from '../../src/db/database.js';
import { GroupRepository } from '../../src/db/group-repository.js';
import { ensureCurrentInstallation } from '../../src/db/installation-repository.js';
import { UpdateInboxRepository } from '../../src/db/update-inbox-repository.js';
import { installations } from '../../src/db/schema.js';

const testDatabaseUrl = process.env['FOAB_TEST_DATABASE_URL'];
if (!testDatabaseUrl) {
  throw new Error('Set FOAB_TEST_DATABASE_URL to the dedicated local foab_test database.');
}

const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
if (
  parsedTestDatabaseUrl.pathname !== '/foab_test' ||
  parsedTestDatabaseUrl.username !== 'foab_app_test' ||
  !['127.0.0.1', 'localhost', '[::1]'].includes(parsedTestDatabaseUrl.hostname)
) {
  throw new Error('Integration tests only run as foab_app_test against local foab_test.');
}

const databaseHandle = createDatabase(testDatabaseUrl);
const groups = new GroupRepository(databaseHandle.db);
const inbox = new UpdateInboxRepository(databaseHandle.db);
let database: FoabDatabase;
let installationA: string;
let installationB: string;
let runtimeInstallationId: string | null = null;

beforeAll(async () => {
  const result = await databaseHandle.pool.query(
    'SELECT current_database() AS database_name, current_user AS role_name',
  );
  if (result.rows[0]?.database_name !== 'foab_test' || result.rows[0]?.role_name !== 'foab_app_test') {
    throw new Error('Integration database identity check failed.');
  }
  database = databaseHandle.db;
});

beforeEach(async () => {
  [installationA, installationB] = await Promise.all([
    createInstallation(database),
    createInstallation(database),
  ]);
});

afterEach(async () => {
  const installationIds = [installationA, installationB];
  if (runtimeInstallationId) {
    installationIds.push(runtimeInstallationId);
    runtimeInstallationId = null;
  }
  await database
    .delete(installations)
    .where(inArray(installations.id, installationIds));
});

afterAll(async () => {
  await databaseHandle.pool.end();
});

describe('installation and group persistence boundaries', () => {
  it('converges concurrent startup calls on one database-owned installation', async () => {
    const installationIds = await Promise.all(
      Array.from({ length: 6 }, () => ensureCurrentInstallation(database)),
    );
    runtimeInstallationId = installationIds[0] ?? null;

    expect(new Set(installationIds).size).toBe(1);
  });

  it('keeps the runtime role read/write-only without schema creation privileges', async () => {
    const result = await databaseHandle.pool.query(
      `SELECT
        has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_objects,
        has_table_privilege(current_user, 'telegram_groups', 'SELECT') AS can_read_groups`,
    );
    const privileges = result.rows[0] as {
      can_create_database: boolean;
      can_create_schema_objects: boolean;
      can_read_groups: boolean;
    } | undefined;

    expect(privileges).toEqual({
      can_create_database: false,
      can_create_schema_objects: false,
      can_read_groups: true,
    });
  });

  it('keeps identical Telegram chat IDs isolated between installations', async () => {
    const sharedSyntheticChatId = -9_007_199_254_000_001n;
    await Promise.all([
      groups.register(installationA, {
        telegramChatId: sharedSyntheticChatId,
        chatType: 'supergroup',
        title: 'Synthetic Group A',
        username: null,
        botStatus: 'administrator',
        isActive: true,
      }),
      groups.register(installationB, {
        telegramChatId: sharedSyntheticChatId,
        chatType: 'supergroup',
        title: 'Synthetic Group B',
        username: null,
        botStatus: 'member',
        isActive: true,
      }),
    ]);

    const [groupA, groupB, listA, listB] = await Promise.all([
      groups.findByChatId(installationA, sharedSyntheticChatId),
      groups.findByChatId(installationB, sharedSyntheticChatId),
      groups.listActive(installationA),
      groups.listActive(installationB),
    ]);

    expect(groupA?.title).toBe('Synthetic Group A');
    expect(groupB?.title).toBe('Synthetic Group B');
    expect(listA.map((group) => group.title)).toEqual(['Synthetic Group A']);
    expect(listB.map((group) => group.title)).toEqual(['Synthetic Group B']);
  });

  it('does not reactivate a removed bot from a delayed ordinary group update', async () => {
    const chatId = -9_007_199_253_999_999n;
    await groups.register(installationA, {
      telegramChatId: chatId,
      chatType: 'group',
      title: 'Synthetic Former Group',
      username: null,
      botStatus: 'left',
      isActive: false,
    });

    const observed = await groups.observe(installationA, {
      telegramChatId: chatId,
      chatType: 'supergroup',
      title: 'Synthetic Renamed Group',
      username: 'synthetic_group',
    });

    expect(observed.title).toBe('Synthetic Renamed Group');
    expect(observed.botStatus).toBe('left');
    expect(observed.isActive).toBe(false);
  });

  it('updates only the expected group settings revision', async () => {
    const chatId = -9_007_199_253_999_998n;
    await groups.register(installationA, {
      telegramChatId: chatId,
      chatType: 'supergroup',
      title: 'Synthetic Settings Group',
      username: null,
      botStatus: 'administrator',
      isActive: true,
    });

    const initial = await groups.findByChatId(installationA, chatId);
    if (!initial) {
      throw new Error('The synthetic settings group was not persisted.');
    }

    const updated = await groups.updateSettings(
      installationA,
      chatId,
      initial.settingsRevision,
      { locale: 'pt-BR', timeZone: 'America/Sao_Paulo' },
    );
    const stale = await groups.updateSettings(
      installationA,
      chatId,
      initial.settingsRevision,
      { locale: 'es-ES' },
    );

    expect(updated?.locale).toBe('pt-BR');
    expect(updated?.timeZone).toBe('America/Sao_Paulo');
    expect(updated?.settingsRevision).toBe(initial.settingsRevision + 1);
    expect(stale).toBeNull();
  });

  it('does not update a group from another installation', async () => {
    const chatId = -9_007_199_253_999_997n;
    await groups.register(installationA, {
      telegramChatId: chatId,
      chatType: 'group',
      title: 'Synthetic Scoped Settings Group',
      username: null,
      botStatus: 'member',
      isActive: true,
    });
    const group = await groups.findByChatId(installationA, chatId);
    if (!group) {
      throw new Error('The synthetic scoped settings group was not persisted.');
    }

    const crossInstallationUpdate = await groups.updateSettings(
      installationB,
      chatId,
      group.settingsRevision,
      { locale: 'pt-BR' },
    );

    expect(crossInstallationUpdate).toBeNull();
    expect((await groups.findByChatId(installationA, chatId))?.locale).toBe('en-US');
  });

  it('claims one update once and suppresses concurrent duplicate delivery', async () => {
    const updateId = 9_000_000_100;
    const claims = await Promise.all([
      inbox.claim(installationA, updateId, 'message'),
      inbox.claim(installationA, updateId, 'message'),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await inbox.markProcessed(installationA, updateId)).toBe(true);
    expect(await inbox.claim(installationA, updateId, 'message')).toBe(false);
  });

  it('releases failed updates for a bounded retry without changing installation scope', async () => {
    const updateId = 9_000_000_101;
    expect(await inbox.claim(installationA, updateId, 'my_chat_member')).toBe(true);
    expect(await inbox.markFailed(installationA, updateId, 'Synthetic Handler Failure!')).toBe(true);
    expect(await inbox.claim(installationA, updateId, 'my_chat_member')).toBe(true);
    expect(await inbox.markProcessed(installationA, updateId)).toBe(true);
    expect(await inbox.claim(installationB, updateId, 'my_chat_member')).toBe(true);
  });
});

async function createInstallation(db: FoabDatabase): Promise<string> {
  const created = await db.insert(installations).values({}).returning({ id: installations.id });
  const installation = created[0];
  if (!installation) {
    throw new Error('The synthetic installation could not be created.');
  }
  return installation.id;
}
