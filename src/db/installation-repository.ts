import { eq, sql } from 'drizzle-orm';
import type { FoabDatabase } from './database.js';
import { installations, runtimeState } from './schema.js';

/**
 * Returns the installation identity selected by the database for this runtime.
 * A transaction-level advisory lock makes concurrent first starts converge on one row.
 *
 * @param db - Typed database handle.
 * @returns The persisted installation UUID used to scope every group query.
 */
export async function ensureCurrentInstallation(db: FoabDatabase): Promise<string> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(1701632981, 1)`);

    const existing = await transaction
      .select({ installationId: runtimeState.installationId })
      .from(runtimeState)
      .where(eq(runtimeState.singletonKey, 1))
      .limit(1);

    const current = existing[0];
    if (current) {
      return current.installationId;
    }

    const created = await transaction.insert(installations).values({}).returning({
      id: installations.id,
    });
    const installation = created[0];
    if (!installation) {
      throw new Error('The database did not return the new installation identity.');
    }

    await transaction.insert(runtimeState).values({
      singletonKey: 1,
      installationId: installation.id,
    });

    return installation.id;
  });
}
