import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Rewrites local runtime, migration, and test environment files without printing values. */
export function updateLocalEnvironmentFiles(
  directory: string,
  passwords: {
    readonly migrator: string;
    readonly application: string;
    readonly testApplication: string;
  },
): void {
  writeEnvironmentFile(
    join(directory, '.env'),
    new Map([
      [
        'FOAB_DATABASE_URL',
        `postgresql://foab_app:${passwords.application}@127.0.0.1:5432/foab_dev`,
      ],
    ]),
    [
      'FOAB_PG_ADMIN_PASSWORD',
      'FOAB_MIGRATION_DATABASE_URL',
      'FOAB_TEST_DATABASE_URL',
      'FOAB_TEST_MIGRATION_DATABASE_URL',
    ],
  );
  writeEnvironmentFile(
    join(directory, '.env.database'),
    new Map([
      [
        'FOAB_MIGRATION_DATABASE_URL',
        `postgresql://foab_migrator:${passwords.migrator}@127.0.0.1:5432/foab_dev`,
      ],
      [
        'FOAB_TEST_MIGRATION_DATABASE_URL',
        `postgresql://foab_migrator:${passwords.migrator}@127.0.0.1:5432/foab_test`,
      ],
    ]),
  );
  writeEnvironmentFile(
    join(directory, '.env.test'),
    new Map([
      [
        'FOAB_TEST_DATABASE_URL',
        `postgresql://foab_app_test:${passwords.testApplication}@127.0.0.1:5432/foab_test`,
      ],
    ]),
  );
}

/** Updates known keys without printing file contents or retaining stale credentials. */
function writeEnvironmentFile(
  envPath: string,
  updates: ReadonlyMap<string, string>,
  removeKeys: readonly string[] = [],
): void {
  const current = existsSync(envPath)
    ? readFileSync(envPath, 'utf8').replace(/\r\n/g, '\n')
    : '';
  const keysToReplace = new Set([...updates.keys(), ...removeKeys]);
  const retainedLines = current
    .split('\n')
    .filter((line) => ![...keysToReplace].some((key) => line.startsWith(`${key}=`)));
  while (retainedLines.at(-1) === '') retainedLines.pop();

  const updated = [
    ...retainedLines,
    ...[...updates].map(([key, value]) => `${key}=${value}`),
    '',
  ].join('\n');
  writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
}
