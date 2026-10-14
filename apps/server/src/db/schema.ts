import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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

export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type KindledRow = typeof kindled.$inferSelect;
