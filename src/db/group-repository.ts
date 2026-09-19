import { and, desc, eq, sql } from 'drizzle-orm';
import type { FoabDatabase } from './database.js';
import type { BotGroupStatus, GroupChatType, MessageDeliveryMode } from './schema.js';
import { telegramGroups } from './schema.js';

/** Maximum Telegram message size accepted for automated group messages. */
export const GROUP_MESSAGE_MAX_LENGTH = 4_096;

/** Maximum rules size, leaving room for the generated heading. */
export const GROUP_RULES_MAX_LENGTH = 3_800;

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

/** Allowlisted group settings that can be changed by an authorized administrator. */
export interface GroupSettingsUpdate {
  readonly locale?: string;
  readonly timeZone?: string;
  readonly welcomeMessage?: string | null;
  readonly welcomeMode?: MessageDeliveryMode;
  readonly deletePreviousWelcomeMessage?: boolean;
  readonly goodbyeMessage?: string | null;
  readonly goodbyeMode?: MessageDeliveryMode;
  readonly deletePreviousGoodbyeMessage?: boolean;
  readonly rulesText?: string | null;
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
  readonly settingsRevision: number;
  readonly welcomeMessage: string | null;
  readonly welcomeMode: MessageDeliveryMode;
  readonly deletePreviousWelcomeMessage: boolean;
  readonly welcomeSentOnce: boolean;
  readonly welcomeLastMessageId: number | null;
  readonly goodbyeMessage: string | null;
  readonly goodbyeMode: MessageDeliveryMode;
  readonly deletePreviousGoodbyeMessage: boolean;
  readonly goodbyeSentOnce: boolean;
  readonly goodbyeLastMessageId: number | null;
  readonly rulesText: string | null;
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
   * Applies an allowlisted settings patch only when the caller still holds the
   * revision that was shown to them. The group and installation are both part
   * of the update predicate, so a stale or cross-group write cannot succeed.
   *
   * @param installationId - Server-derived installation identity.
   * @param telegramChatId - Chat ID received from the authenticated update.
   * @param expectedRevision - Revision displayed by the settings command.
   * @param update - Validated settings fields; unknown fields cannot enter this repository.
   * @returns The new scoped record, or `null` when the group is inactive or stale.
   */
  public async updateSettings(
    installationId: string,
    telegramChatId: bigint,
    expectedRevision: number,
    update: GroupSettingsUpdate,
  ): Promise<GroupRecord | null> {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new RangeError('Settings revision must be a non-negative integer.');
    }
    if (
      update.locale === undefined &&
      update.timeZone === undefined &&
      update.welcomeMessage === undefined &&
      update.welcomeMode === undefined &&
      update.deletePreviousWelcomeMessage === undefined &&
      update.goodbyeMessage === undefined &&
      update.goodbyeMode === undefined &&
      update.deletePreviousGoodbyeMessage === undefined &&
      update.rulesText === undefined
    ) {
      throw new RangeError('At least one group setting must be provided.');
    }
    if (update.locale !== undefined && update.locale.length > 16) {
      throw new RangeError('Group locale exceeds the maximum supported length.');
    }
    if (update.timeZone !== undefined && update.timeZone.length > 64) {
      throw new RangeError('Group time zone exceeds the maximum supported length.');
    }
    if (update.welcomeMode !== undefined && !isMessageDeliveryMode(update.welcomeMode)) {
      throw new RangeError('Welcome delivery mode is not supported.');
    }
    if (update.goodbyeMode !== undefined && !isMessageDeliveryMode(update.goodbyeMode)) {
      throw new RangeError('Goodbye delivery mode is not supported.');
    }
    if (
      (update.deletePreviousWelcomeMessage !== undefined && typeof update.deletePreviousWelcomeMessage !== 'boolean') ||
      (update.deletePreviousGoodbyeMessage !== undefined && typeof update.deletePreviousGoodbyeMessage !== 'boolean')
    ) {
      throw new RangeError('Previous-message deletion settings must be boolean.');
    }
    validateOptionalGroupMessage(update.welcomeMessage, GROUP_MESSAGE_MAX_LENGTH, 'Welcome message');
    validateOptionalGroupMessage(update.goodbyeMessage, GROUP_MESSAGE_MAX_LENGTH, 'Goodbye message');
    validateOptionalGroupMessage(update.rulesText, GROUP_RULES_MAX_LENGTH, 'Rules text');

    const rows = await this.db
      .update(telegramGroups)
      .set({
        ...(update.locale === undefined ? {} : { locale: update.locale }),
        ...(update.timeZone === undefined ? {} : { timeZone: update.timeZone }),
        ...(update.welcomeMessage === undefined ? {} : { welcomeMessage: update.welcomeMessage }),
        ...(update.welcomeMode === undefined ? {} : { welcomeMode: update.welcomeMode }),
        ...(update.deletePreviousWelcomeMessage === undefined ? {} : { deletePreviousWelcomeMessage: update.deletePreviousWelcomeMessage }),
        ...((update.welcomeMessage !== undefined || update.welcomeMode !== undefined)
          ? { welcomeSentOnce: false }
          : {}),
        ...(update.goodbyeMessage === undefined ? {} : { goodbyeMessage: update.goodbyeMessage }),
        ...(update.goodbyeMode === undefined ? {} : { goodbyeMode: update.goodbyeMode }),
        ...(update.deletePreviousGoodbyeMessage === undefined ? {} : { deletePreviousGoodbyeMessage: update.deletePreviousGoodbyeMessage }),
        ...((update.goodbyeMessage !== undefined || update.goodbyeMode !== undefined)
          ? { goodbyeSentOnce: false }
          : {}),
        ...(update.rulesText === undefined ? {} : { rulesText: update.rulesText }),
        settingsRevision: sql`${telegramGroups.settingsRevision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(telegramGroups.installationId, installationId),
          eq(telegramGroups.telegramChatId, telegramChatId),
          eq(telegramGroups.isActive, true),
          eq(telegramGroups.settingsRevision, expectedRevision),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  /** Records the Telegram message produced by one welcome or goodbye delivery. */
  public async recordAutomatedMessage(
    installationId: string,
    telegramChatId: bigint,
    feature: 'welcome' | 'goodbye',
    messageId: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(messageId) || messageId < 1) {
      throw new RangeError('Automated message ID must be a positive safe integer.');
    }
    await this.db
      .update(telegramGroups)
      .set(feature === 'welcome'
        ? { welcomeLastMessageId: messageId, welcomeSentOnce: true, updatedAt: new Date() }
        : { goodbyeLastMessageId: messageId, goodbyeSentOnce: true, updatedAt: new Date() })
      .where(
        and(
          eq(telegramGroups.installationId, installationId),
          eq(telegramGroups.telegramChatId, telegramChatId),
          eq(telegramGroups.isActive, true),
        ),
      );
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

/** Validates nullable administrator-authored text before it reaches PostgreSQL. */
function validateOptionalGroupMessage(
  value: string | null | undefined,
  maximumLength: number,
  fieldName: string,
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (value.length > maximumLength || value.includes('\u0000')) {
    throw new RangeError(`${fieldName} exceeds its maximum size or contains an invalid character.`);
  }
}

/** Narrows runtime updates to the two persisted delivery modes. */
function isMessageDeliveryMode(value: string): value is MessageDeliveryMode {
  return value === 'always' || value === 'first';
}
