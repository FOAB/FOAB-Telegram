import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { updateLocalEnvironmentFiles } from '../../scripts/db/local-environment.js';

let temporaryDirectory: string;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'foab-env-test-'));
  await writeFile(
    join(temporaryDirectory, '.env'),
    [
      'FOAB_TELEGRAM_BOT_TOKEN=synthetic-token',
      'FOAB_PG_ADMIN_PASSWORD=synthetic-admin-value',
      'FOAB_MIGRATION_DATABASE_URL=stale-migration-url',
      'FOAB_TEST_DATABASE_URL=stale-test-url',
      '',
    ].join('\n'),
  );
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe('local database environment separation', () => {
  it('keeps runtime, migration, and test credentials in their own files', async () => {
    updateLocalEnvironmentFiles(temporaryDirectory, {
      application: 'synthetic-app-value',
      migrator: 'synthetic-migrator-value',
      testApplication: 'synthetic-test-value',
    });

    const [runtimeEnvironment, migrationEnvironment, testEnvironment] = await Promise.all([
      readFile(join(temporaryDirectory, '.env'), 'utf8'),
      readFile(join(temporaryDirectory, '.env.database'), 'utf8'),
      readFile(join(temporaryDirectory, '.env.test'), 'utf8'),
    ]);

    expect(runtimeEnvironment).toContain('FOAB_TELEGRAM_BOT_TOKEN=synthetic-token');
    expect(runtimeEnvironment).toContain('FOAB_DATABASE_URL=');
    expect(runtimeEnvironment).not.toContain('FOAB_PG_ADMIN_PASSWORD');
    expect(runtimeEnvironment).not.toContain('FOAB_MIGRATION_DATABASE_URL');
    expect(runtimeEnvironment).not.toContain('FOAB_TEST_DATABASE_URL');
    expect(migrationEnvironment).toContain('FOAB_MIGRATION_DATABASE_URL=');
    expect(migrationEnvironment).toContain('FOAB_TEST_MIGRATION_DATABASE_URL=');
    expect(migrationEnvironment).not.toContain('FOAB_DATABASE_URL=');
    expect(testEnvironment).toContain('FOAB_TEST_DATABASE_URL=');
    expect(testEnvironment).not.toContain('FOAB_MIGRATION_DATABASE_URL=');
  });
});
