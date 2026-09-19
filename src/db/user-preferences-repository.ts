import { and, eq } from 'drizzle-orm';
import type { FoabDatabase } from './database.js';
import { telegramUserPreferences } from './schema.js';
import type { SupportedLocale } from '../i18n/messages.js';

/** Persisted private-chat preferences for one Telegram user in one FOAB installation. */
export class UserPreferencesRepository {
  public constructor(private readonly db: FoabDatabase) {}

  /** Returns the user's private locale, or null before the first explicit choice. */
  public async getLocale(
    installationId: string,
    telegramUserId: number,
  ): Promise<SupportedLocale | null> {
    validateTelegramUserId(telegramUserId);
    const rows = await this.db
      .select({ locale: telegramUserPreferences.privateLocale })
      .from(telegramUserPreferences)
      .where(and(
        eq(telegramUserPreferences.installationId, installationId),
        eq(telegramUserPreferences.telegramUserId, BigInt(telegramUserId)),
      ))
      .limit(1);
    return rows[0]?.locale ?? null;
  }

  /** Stores the selected private locale inside the installation and user scope. */
  public async setLocale(
    installationId: string,
    telegramUserId: number,
    locale: SupportedLocale,
  ): Promise<SupportedLocale> {
    validateTelegramUserId(telegramUserId);
    const rows = await this.db
      .insert(telegramUserPreferences)
      .values({
        installationId,
        telegramUserId: BigInt(telegramUserId),
        privateLocale: locale,
      })
      .onConflictDoUpdate({
        target: [telegramUserPreferences.installationId, telegramUserPreferences.telegramUserId],
        set: { privateLocale: locale, updatedAt: new Date() },
      })
      .returning({ locale: telegramUserPreferences.privateLocale });
    const updated = rows[0]?.locale;
    if (!updated) {
      throw new Error('The database did not return the updated private preference.');
    }
    return updated;
  }
}

function validateTelegramUserId(telegramUserId: number): void {
  if (!Number.isSafeInteger(telegramUserId) || telegramUserId < 1) {
    throw new RangeError('Telegram user ID must be a positive safe integer.');
  }
}
