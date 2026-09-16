import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { updateLocalEnvironmentFiles } from './local-environment.js';

interface DatabaseTarget {
  readonly name: 'foab_dev' | 'foab_test';
  readonly applicationRole: 'foab_app' | 'foab_app_test';
}

const databaseTargets: readonly DatabaseTarget[] = [
  { name: 'foab_dev', applicationRole: 'foab_app' },
  { name: 'foab_test', applicationRole: 'foab_app_test' },
];

/** Creates isolated local databases and least-privilege roles using a temporary admin secret. */
async function provisionLocalDatabases(): Promise<void> {
  const administratorPassword = process.env['FOAB_PG_ADMIN_PASSWORD'];
  if (!administratorPassword) {
    throw new Error('FOAB_PG_ADMIN_PASSWORD is required in the ignored .env file.');
  }

  const passwords = {
    migrator: randomBytes(32).toString('hex'),
    application: randomBytes(32).toString('hex'),
    testApplication: randomBytes(32).toString('hex'),
  };
  const admin = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: administratorPassword,
    database: 'postgres',
    application_name: 'foab-local-provisioning',
  });

  try {
    await admin.connect();
    await ensureRole(admin, 'foab_migrator', passwords.migrator);
    await ensureRole(admin, 'foab_app', passwords.application);
    await ensureRole(admin, 'foab_app_test', passwords.testApplication);

    for (const target of databaseTargets) {
      await ensureDatabase(admin, target.name);
      await grantApplicationPrivileges(admin, administratorPassword, target);
    }

    updateLocalEnvironmentFiles('.', passwords);
    process.stdout.write(
      'Local FOAB development and test databases are provisioned. The temporary PostgreSQL administrator value was removed from .env.\n',
    );
  } catch {
    process.stderr.write(
      'Local PostgreSQL provisioning failed. Details were suppressed to protect credentials.\n',
    );
    process.exitCode = 1;
  } finally {
    await admin.end().catch(() => undefined);
  }
}

/** Creates or rotates a fixed local role with no cluster-wide administrative privileges. */
async function ensureRole(
  admin: Client,
  role: 'foab_migrator' | 'foab_app' | 'foab_app_test',
  password: string,
): Promise<void> {
  const existing = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const roleOptions =
    `WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT 20 PASSWORD '${password}'`;
  await admin.query(
    existing.rowCount
      ? `ALTER ROLE ${role} ${roleOptions}`
      : `CREATE ROLE ${role} ${roleOptions}`,
  );
}

/** Creates a database only when absent and refuses to take over an unexpected existing owner. */
async function ensureDatabase(
  admin: Client,
  databaseName: DatabaseTarget['name'],
): Promise<void> {
  const existing = await admin.query(
    'SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
    [databaseName],
  );
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${databaseName} OWNER foab_migrator`);
    return;
  }

  if (existing.rows[0]?.owner !== 'foab_migrator') {
    throw new Error('An existing database has an unexpected owner.');
  }
}

/** Grants data access to the runtime role without giving it schema or migration privileges. */
async function grantApplicationPrivileges(
  admin: Client,
  administratorPassword: string,
  target: DatabaseTarget,
): Promise<void> {
  await admin.query(`GRANT CONNECT ON DATABASE ${target.name} TO ${target.applicationRole}`);
  const databaseAdmin = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: administratorPassword,
    database: target.name,
    application_name: 'foab-local-provisioning',
  });

  await databaseAdmin.connect();
  try {
    await databaseAdmin.query(
      `GRANT USAGE ON SCHEMA public TO ${target.applicationRole}`,
    );
    await databaseAdmin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${target.applicationRole}`,
    );
    await databaseAdmin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE foab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${target.applicationRole}`,
    );
  } finally {
    await databaseAdmin.end();
  }
}

await provisionLocalDatabases();
