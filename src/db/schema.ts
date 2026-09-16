import {
  boolean,
  bigint,
  check,
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
    index('telegram_groups_installation_active_idx').on(
      table.installationId,
      table.isActive,
      table.updatedAt,
    ),
  ],
);
