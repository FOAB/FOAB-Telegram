import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

/** Typed database handle shared by the repositories in this application. */
export type FoabDatabase = NodePgDatabase<typeof schema>;

/** A PostgreSQL pool and its schema-aware Drizzle query interface. */
export interface DatabaseHandle {
  readonly pool: Pool;
  readonly db: FoabDatabase;
}

/**
 * Creates the application database pool with bounded connections and timeouts.
 * Connection strings are never logged; callers must report only sanitized error classes.
 *
 * @param connectionString - Validated local or private-network PostgreSQL URL.
 * @returns A pool and typed Drizzle database handle.
 */
export function createDatabase(connectionString: string): DatabaseHandle {
  const pool = new Pool({
    connectionString,
    application_name: 'foab-telegram',
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    query_timeout: 7_000,
    statement_timeout: 5_000,
    keepAlive: true,
  });

  return { pool, db: drizzle({ client: pool, schema }) };
}
