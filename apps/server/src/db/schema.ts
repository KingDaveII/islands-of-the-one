import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Retired: no code reads or writes this table any more (accounts and kindled
 * replace it). It stays in the schema so drizzle-kit does not generate a
 * DROP: migrations are expand-only, and staging rolls code back but not
 * migrations. A later contract migration drops it (docs/design/accounts.md).
 */
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  level: integer('level').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One account per player: a username and a password hash (argon2id, PHC string). */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lowercase; the unique index on lower() keeps it unique in any case. */
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('accounts_username_lower_unique').on(sql`lower(${t.username})`)],
);

/** Logged-in sessions. Only the SHA-256 of the cookie token is stored. */
export const sessions = pgTable(
  'sessions',
  {
    /** Hex SHA-256 of the 32-byte token in the cookie. */
    tokenHash: text('token_hash').primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_account_id_idx').on(t.accountId)],
);

/** The account's Kindled: one per account, created once. */
export const kindled = pgTable('kindled', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** clay | ash | tide | wing (data/creation.json). */
  remembrance: text('remembrance').notNull(),
  /** A palette.json clay tone id. */
  clayTone: text('clay_tone').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The holding's one active action per Kindled (docs/design/holding.md, M2
 * Task 3b): the station being worked, when this stretch of work started,
 * how many of its cycles have been credited, and the last heartbeat. The
 * server settles it on every holding request (nothing ticks in the
 * background) with the row locked FOR UPDATE; stopping deletes the row.
 */
export const holdingActivity = pgTable('holding_activity', {
  kindledId: uuid('kindled_id')
    .primaryKey()
    .references(() => kindled.id, { onDelete: 'cascade' }),
  /** A station id of data/stations.json. */
  stationId: text('station_id').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  /** Cycles of this stretch already paid into the basket and the skill. */
  creditedCycles: integer('credited_cycles').notNull().default(0),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
});

/**
 * Skill XP (docs/design/holding.md): one row per Kindled and skill, written
 * only in the settle transaction. XP is not an item, so it is not in the item
 * ledger. bigint: skills have no level cap.
 */
export const skillXp = pgTable(
  'skill_xp',
  {
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    /** A skill of packages/shared/src/skills.ts. */
    skill: text('skill').notNull(),
    xp: bigint('xp', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kindledId, t.skill] })],
);

/**
 * The Writ (docs/design/holding.md "The Writ", M2 Task 4a): one per Kindled,
 * created on its first holding request (so existing Kindled get one too),
 * touched only by the holding module. The island's Name as typed and its
 * letters (hearName, computed on the server), null until named; whether the
 * Writ is certified (nobody can be in M2); when its charge runs out (set at
 * the pressing, pressChargeHours ahead); how many lines it has (1 in M2).
 * Everything else is derived by writView at request time; nothing ticks in
 * the background.
 */
export const writs = pgTable('writs', {
  kindledId: uuid('kindled_id')
    .primaryKey()
    .references(() => kindled.id, { onDelete: 'cascade' }),
  name: text('name'),
  letters: text('letters'),
  certified: boolean('certified').notNull().default(false),
  emptyAt: timestamp('empty_at', { withTimezone: true }).notNull(),
  lines: integer('lines').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type KindledRow = typeof kindled.$inferSelect;
export type HoldingActivityRow = typeof holdingActivity.$inferSelect;
export type SkillXpRow = typeof skillXp.$inferSelect;
export type WritRow = typeof writs.$inferSelect;
