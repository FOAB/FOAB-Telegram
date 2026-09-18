import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './database.js';

/** Runs pending Drizzle migrations when the deployment supplies a migration URL. */
async function runMigrations(): Promise<void> {
  const migrationUrl = process.env['FOAB_MIGRATION_DATABASE_URL'];
  if (!migrationUrl) {
    writeLog('info', 'database_migration_skipped');
    return;
  }

  const database = createDatabase(migrationUrl);
  try {
    await migrate(database.db, {
      migrationsFolder: fileURLToPath(new URL('../../drizzle/', import.meta.url)),
    });
    writeLog('info', 'database_migration_succeeded');
  } catch (error: unknown) {
    writeLog('error', 'database_migration_failed', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    });
    throw error;
  } finally {
    await database.pool.end();
  }
}

/** Emits only fixed operational fields and never includes the connection string. */
function writeLog(
  level: 'info' | 'error',
  event: string,
  fields: Readonly<Record<string, string>> = {},
): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  }));
}

await runMigrations();
