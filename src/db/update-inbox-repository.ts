import { and, eq, or, sql } from 'drizzle-orm';
import type { FoabDatabase } from './database.js';
import type { TelegramUpdateKind } from './schema.js';
import { telegramUpdateInbox } from './schema.js';

const INBOX_LEASE_MS = 60_000;

/** Durable update receipt and lease repository scoped to one installation. */
export class UpdateInboxRepository {
  public constructor(private readonly db: FoabDatabase) {}

  /**
   * Claims a new or expired update lease. A processed update is never claimed
   * again, while an interrupted lease becomes retryable after one minute.
   *
   * @param installationId - Server-derived installation identity.
   * @param updateId - Exact Telegram update identifier.
   * @param updateKind - Normalized supported update variant.
   * @returns `true` only for the worker that owns the current processing lease.
   */
  public async claim(
    installationId: string,
    updateId: number,
    updateKind: TelegramUpdateKind,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(updateId) || updateId < 0) {
      throw new RangeError('Telegram update ID must be a non-negative safe integer.');
    }

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + INBOX_LEASE_MS);
    const claimCondition = and(
      eq(telegramUpdateInbox.updateKind, updateKind),
      sql`${telegramUpdateInbox.status} <> 'processed'`,
      or(
        sql`${telegramUpdateInbox.leaseUntil} IS NULL`,
        sql`${telegramUpdateInbox.leaseUntil} <= ${now}`,
      ),
    );
    if (!claimCondition) {
      throw new Error('The update inbox claim condition could not be built.');
    }
    const rows = await this.db
      .insert(telegramUpdateInbox)
      .values({
        installationId,
        telegramUpdateId: BigInt(updateId),
        updateKind,
        status: 'processing',
        leaseUntil,
      })
      .onConflictDoUpdate({
        target: [telegramUpdateInbox.installationId, telegramUpdateInbox.telegramUpdateId],
        set: {
          status: 'processing',
          attemptCount: sql`${telegramUpdateInbox.attemptCount} + 1`,
          lastSeenAt: now,
          leaseUntil,
          processedAt: null,
          lastErrorType: null,
        },
        where: claimCondition,
      })
      .returning({ status: telegramUpdateInbox.status });

    return rows.length === 1;
  }

  /** Marks the current lease as processed without retaining update content. */
  public async markProcessed(installationId: string, updateId: number): Promise<boolean> {
    const rows = await this.db
      .update(telegramUpdateInbox)
      .set({
        status: 'processed',
        processedAt: new Date(),
        leaseUntil: null,
      })
      .where(
        and(
          eq(telegramUpdateInbox.installationId, installationId),
          eq(telegramUpdateInbox.telegramUpdateId, BigInt(updateId)),
          eq(telegramUpdateInbox.status, 'processing'),
        ),
      )
      .returning({ status: telegramUpdateInbox.status });

    return rows.length === 1;
  }

  /** Releases a failed lease while retaining only a sanitized error class. */
  public async markFailed(
    installationId: string,
    updateId: number,
    errorType: string,
  ): Promise<boolean> {
    const rows = await this.db
      .update(telegramUpdateInbox)
      .set({
        status: 'failed',
        leaseUntil: null,
        lastErrorType: sanitizeErrorType(errorType),
      })
      .where(
        and(
          eq(telegramUpdateInbox.installationId, installationId),
          eq(telegramUpdateInbox.telegramUpdateId, BigInt(updateId)),
          eq(telegramUpdateInbox.status, 'processing'),
        ),
      )
      .returning({ status: telegramUpdateInbox.status });

    return rows.length === 1;
  }
}

/** Keeps operational error metadata bounded and free of arbitrary exception text. */
function sanitizeErrorType(errorType: string): string {
  const normalized = errorType.trim().replace(/[^A-Za-z0-9_.:-]/gu, '_');
  return normalized.slice(0, 128) || 'UnknownError';
}
