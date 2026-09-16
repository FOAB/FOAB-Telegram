import { and, desc, eq } from 'drizzle-orm';
import type { FoabDatabase } from './database.js';
import type { BotGroupStatus, GroupChatType } from './schema.js';
import { telegramGroups } from './schema.js';

/** Data needed to register or refresh a Telegram group. */
export interface RegisterGroupInput {
  readonly telegramChatId: bigint;
  readonly chatType: GroupChatType;
  readonly title: string;
  readonly username: string | null;
  readonly botStatus: BotGroupStatus;
  readonly isActive: boolean;
}

/** Group metadata observed in an ordinary group update, without membership authority. */
export interface ObserveGroupInput {
  readonly telegramChatId: bigint;
  readonly chatType: GroupChatType;
  readonly title: string;
  readonly username: string | null;
}

/** Persisted group fields safe for internal application use. */
export interface GroupRecord {
  readonly installationId: string;
  readonly telegramChatId: bigint;
  readonly chatType: GroupChatType;
  readonly title: string;
  readonly username: string | null;
  readonly locale: string;
  readonly timeZone: string;
  readonly botStatus: BotGroupStatus;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A group query is always scoped by the installation UUID and Telegram chat ID. */
export class GroupRepository {
  public constructor(private readonly db: FoabDatabase) {}

  /**
   * Inserts a known group or refreshes only that group's current Telegram metadata.
   * The database key includes the installation, so identical chat IDs cannot cross scopes.
   *
   * @param installationId - Server-derived installation identity.
   * @param input - Current chat metadata and bot membership state from Telegram.
   * @returns The persisted scoped group record.
   */
  public async register(
    installationId: string,
    input: RegisterGroupInput,
  ): Promise<GroupRecord> {
    const title = input.title.trim();
    if (title.length === 0 || title.length > 255) {
      throw new RangeError('Group title must contain between 1 and 255 characters.');
    }
    if (!Number.isSafeInteger(Number(input.telegramChatId))) {
      throw new RangeError('Telegram chat ID cannot be represented safely by this runtime.');
    }

    const rows = await this.db
      .insert(telegramGroups)
      .values({
        installationId,
        telegramChatId: input.telegramChatId,
        chatType: input.chatType,
        title,
        username: input.username,
        botStatus: input.botStatus,
        isActive: input.isActive,
      })
      .onConflictDoUpdate({
        target: [telegramGroups.installationId, telegramGroups.telegramChatId],
        set: {
          chatType: input.chatType,
          title,
          username: input.username,
          botStatus: input.botStatus,
          isActive: input.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();

    const group = rows[0];
    if (!group) {
      throw new Error('The database did not return the registered group.');
    }

    return group;
  }

  /**
   * Records current chat metadata while preserving membership state from service updates.
   * An ordinary message must never reactivate a group after a bot-removal update.
   *
   * @param installationId - Server-derived installation identity.
   * @param input - Current group metadata from a Telegram update.
   * @returns The persisted scoped group record.
   */
  public async observe(
    installationId: string,
    input: ObserveGroupInput,
  ): Promise<GroupRecord> {
    const title = input.title.trim();
    if (title.length === 0 || title.length > 255) {
      throw new RangeError('Group title must contain between 1 and 255 characters.');
    }
    if (!Number.isSafeInteger(Number(input.telegramChatId))) {
      throw new RangeError('Telegram chat ID cannot be represented safely by this runtime.');
    }

    const rows = await this.db
      .insert(telegramGroups)
      .values({
        installationId,
        telegramChatId: input.telegramChatId,
        chatType: input.chatType,
        title,
        username: input.username,
      })
      .onConflictDoUpdate({
        target: [telegramGroups.installationId, telegramGroups.telegramChatId],
        set: {
          chatType: input.chatType,
          title,
          username: input.username,
          updatedAt: new Date(),
        },
      })
      .returning();

    const group = rows[0];
    if (!group) {
      throw new Error('The database did not return the observed group.');
    }

    return group;
  }

  /**
   * Finds a group only inside the supplied installation.
   *
   * @param installationId - Server-derived installation identity.
   * @param telegramChatId - Telegram chat ID received in the authenticated update.
   * @returns The scoped record, or `null` when it is not known in this installation.
   */
  public async findByChatId(
    installationId: string,
    telegramChatId: bigint,
  ): Promise<GroupRecord | null> {
    const rows = await this.db
      .select()
      .from(telegramGroups)
      .where(
        and(
          eq(telegramGroups.installationId, installationId),
          eq(telegramGroups.telegramChatId, telegramChatId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Lists active groups in this installation only.
   *
   * @param installationId - Server-derived installation identity.
   * @param limit - Page size, capped at 100 records.
   * @returns The most recently updated active groups.
   */
  public async listActive(
    installationId: string,
    limit = 50,
  ): Promise<readonly GroupRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('Group list limit must be an integer from 1 to 100.');
    }

    return this.db
      .select()
      .from(telegramGroups)
      .where(
        and(
          eq(telegramGroups.installationId, installationId),
          eq(telegramGroups.isActive, true),
        ),
      )
      .orderBy(desc(telegramGroups.updatedAt))
      .limit(limit);
  }
}
