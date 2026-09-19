import {
  boolean,
  bigint,
  check,
  integer,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { SupportedLocale } from '../i18n/messages.js';

/** Telegram group chat kinds supported by the current bot integration. */
export type GroupChatType = 'group' | 'supergroup';

/** Telegram membership status of this bot in a group. */
export type BotGroupStatus =
  | 'creator'
  | 'administrator'
  | 'member'
  | 'restricted'
  | 'left'
  | 'kicked';

/** Delivery modes shared by welcome and goodbye automation. */
export type MessageDeliveryMode = 'always' | 'first';

/** Supported update kinds entering the durable inbox. */
export type TelegramUpdateKind = 'message' | 'my_chat_member' | 'callback_query';

/** Durable inbox processing states. Failed leases can be claimed again. */
export type TelegramInboxStatus = 'processing' | 'processed' | 'failed';

/** A self-hosted FOAB installation. Each database initially represents one installation. */
export const installations = pgTable('installations', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Singleton pointer that lets the runtime find its installation without a client-supplied ID. */
export const runtimeState = pgTable(
  'runtime_state',
  {
    singletonKey: smallint('singleton_key').default(1).primaryKey(),
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('runtime_state_singleton_key_check', sql`${table.singletonKey} = 1`),
  ],
);

/** A known Telegram group, always keyed and queried together with its installation. */
export const telegramGroups = pgTable(
  'telegram_groups',
  {
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    telegramChatId: bigint('telegram_chat_id', { mode: 'bigint' }).notNull(),
    chatType: text('chat_type').$type<GroupChatType>().notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    username: varchar('username', { length: 32 }),
    locale: varchar('locale', { length: 16 }).default('en-US').notNull(),
    timeZone: varchar('time_zone', { length: 64 }).default('UTC').notNull(),
    settingsRevision: integer('settings_revision').default(0).notNull(),
    welcomeMessage: text('welcome_message'),
    welcomeMode: text('welcome_mode').$type<MessageDeliveryMode>().default('always').notNull(),
    deletePreviousWelcomeMessage: boolean('delete_previous_welcome_message').default(false).notNull(),
    welcomeSentOnce: boolean('welcome_sent_once').default(false).notNull(),
    welcomeLastMessageId: integer('welcome_last_message_id'),
    goodbyeMessage: text('goodbye_message'),
    goodbyeMode: text('goodbye_mode').$type<MessageDeliveryMode>().default('always').notNull(),
    deletePreviousGoodbyeMessage: boolean('delete_previous_goodbye_message').default(false).notNull(),
    goodbyeSentOnce: boolean('goodbye_sent_once').default(false).notNull(),
    goodbyeLastMessageId: integer('goodbye_last_message_id'),
    rulesText: text('rules_text'),
    botStatus: text('bot_status').$type<BotGroupStatus>().default('member').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: 'telegram_groups_installation_chat_pk',
      columns: [table.installationId, table.telegramChatId],
    }),
    check(
      'telegram_groups_chat_type_check',
      sql`${table.chatType} IN ('group', 'supergroup')`,
    ),
    check(
      'telegram_groups_bot_status_check',
      sql`${table.botStatus} IN ('creator', 'administrator', 'member', 'restricted', 'left', 'kicked')`,
    ),
    check(
      'telegram_groups_message_mode_check',
      sql`${table.welcomeMode} IN ('always', 'first') AND ${table.goodbyeMode} IN ('always', 'first')`,
    ),
    index('telegram_groups_installation_active_idx').on(
      table.installationId,
      table.isActive,
      table.updatedAt,
    ),
  ],
);

/** Per-user private FOAB preferences, scoped to one self-hosted installation. */
export const telegramUserPreferences = pgTable(
  'telegram_user_preferences',
  {
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    telegramUserId: bigint('telegram_user_id', { mode: 'bigint' }).notNull(),
    privateLocale: varchar('private_locale', { length: 16 }).$type<SupportedLocale>().default('en-US').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: 'telegram_user_preferences_installation_user_pk',
      columns: [table.installationId, table.telegramUserId],
    }),
    check(
      'telegram_user_preferences_locale_check',
      sql`${table.privateLocale} IN ('en-US', 'pt-BR', 'es-ES')`,
    ),
    index('telegram_user_preferences_installation_idx').on(table.installationId),
  ],
);

/**
 * Deduplication record for one Telegram update in one installation.
 * It deliberately stores no raw update body or user-generated message text.
 */
export const telegramUpdateInbox = pgTable(
  'telegram_update_inbox',
  {
    installationId: uuid('installation_id')
      .notNull()
      .references(() => installations.id, { onDelete: 'cascade' }),
    telegramUpdateId: bigint('telegram_update_id', { mode: 'bigint' }).notNull(),
    updateKind: text('update_kind').$type<TelegramUpdateKind>().notNull(),
    status: text('status').$type<TelegramInboxStatus>().default('processing').notNull(),
    attemptCount: integer('attempt_count').default(1).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastErrorType: varchar('last_error_type', { length: 128 }),
  },
  (table) => [
    primaryKey({
      name: 'telegram_update_inbox_installation_update_pk',
      columns: [table.installationId, table.telegramUpdateId],
    }),
    check(
      'telegram_update_inbox_kind_check',
      sql`${table.updateKind} IN ('message', 'my_chat_member', 'callback_query')`,
    ),
    check(
      'telegram_update_inbox_status_check',
      sql`${table.status} IN ('processing', 'processed', 'failed')`,
    ),
    check(
      'telegram_update_inbox_attempt_count_check',
      sql`${table.attemptCount} > 0`,
    ),
    index('telegram_update_inbox_claim_idx').on(
      table.installationId,
      table.status,
      table.leaseUntil,
    ),
  ],
);
