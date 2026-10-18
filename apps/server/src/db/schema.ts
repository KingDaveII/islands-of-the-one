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
 * the background. `fed_at` (M2 Task 4b, migration 0006, expand-only) is
 * when the Writ was first fed, null until then: the client plays Kesh's
 * after-first-feeding line once, when it goes from null to set.
 * `last_seen_at` (M2 Task 5, migration 0007, expand-only) is the
 * holding-wide last heartbeat the basket cycles settle by: every holding
 * request refreshes it, and unlike the activity row's it survives a stop.
 * Null for a Kindled that hasn't been seen since this shipped.
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
  fedAt: timestamp('fed_at', { withTimezone: true }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
});

/**
 * Kesh's gifts (docs/design/holding.md "Kesh", M2 Task 4b): one row per
 * Kindled, touched only by the holding module. When his first sliver was
 * given (null until then) and the tide index (shared `tideIndex`) of the
 * last tide whose sliver was given (null until one was; the once-per-tide
 * sliver is M2's scaffolding, `m2Scaffold`). The row is created under the
 * Kindled's lock on the first request that needs it. Migration 0006,
 * expand-only. `word_given_at` and `seeds_given_at` (M2 Task 5, migration
 * 0007): when his word tile (after the Name) and his seeds (after the first
 * plot is named) were given, null until then.
 */
export const keshGifts = pgTable('kesh_gifts', {
  kindledId: uuid('kindled_id')
    .primaryKey()
    .references(() => kindled.id, { onDelete: 'cascade' }),
  firstSliverAt: timestamp('first_sliver_at', { withTimezone: true }),
  lastTide: integer('last_tide'),
  wordGivenAt: timestamp('word_given_at', { withTimezone: true }),
  seedsGivenAt: timestamp('seeds_given_at', { withTimezone: true }),
});

/**
 * The word tiles a Kindled knows (docs/design/holding.md "Plots", M2 Task
 * 5): knowledge, not items (no slot, no ledger). One row per Kindled and
 * word id of words.json, written only by the holding module (Kesh's gift,
 * the words:grant and words:forget CLIs). Migration 0007, expand-only.
 */
export const knownWords = pgTable(
  'known_words',
  {
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    wordId: text('word_id').notNull(),
    learnedAt: timestamp('learned_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.kindledId, t.wordId] })],
);

/**
 * A plot's sentence (docs/design/holding.md "Plots", M2 Task 5): one row per
 * named plot (an unnamed plot has none), by the layout's plot id. The
 * Ground's and the Virtue's word ids (the Virtue null without one), when the
 * plot was first named, when its Virtue was last set (any change to either
 * tile restarts the count), how long the plot spent faded while it had its
 * Virtue (`virtue_paused_ms`, added at a relight: the count pauses while
 * faded) and when it was sown (null until then). Written only by the
 * holding module under the Kindled's lock. Migration 0007, expand-only.
 */
export const plots = pgTable(
  'plots',
  {
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    plotId: text('plot_id').notNull(),
    ground: text('ground').notNull(),
    virtue: text('virtue'),
    namedAt: timestamp('named_at', { withTimezone: true }).notNull(),
    virtueSetAt: timestamp('virtue_set_at', { withTimezone: true }),
    virtuePausedMs: bigint('virtue_paused_ms', { mode: 'number' }).notNull().default(0),
    sownAt: timestamp('sown_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.kindledId, t.plotId] })],
);

/**
 * A station's basket cycle clock (docs/design/holding.md "Plots", M2 Task
 * 5): one row per Kindled and station with a cycle (a sown field by its plot
 * id, the twisted trees), created when the station comes into being with
 * `cycled_until` = then. `cycled_until` is how far the cycles have been paid
 * (moved on by whole cycles at every settle, or to now when the Writ went
 * dark or the cap bit, the lost time never paid); `carry_permille` the
 * Virtue's remainder under one item. Written only by the holding module in
 * the settle's transaction. Migration 0007, expand-only.
 */
export const basketCycles = pgTable(
  'basket_cycles',
  {
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    stationId: text('station_id').notNull(),
    cycledUntil: timestamp('cycled_until', { withTimezone: true }).notNull(),
    carryPermille: integer('carry_permille').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kindledId, t.stationId] })],
);

/**
 * The upgrade pieces standing in a Kindled's plots (docs/design/holding.md
 * "Build mode", M2 Task 6): one row per Kindled, plot and piece kind (each
 * kind stands once per plot), by the layout's plot id and the piece id of
 * pieces.json, with the footprint's top-left tile and its rotation (0, 90,
 * 180 or 270) and when it was built. Written only by the holding module
 * under the Kindled's lock: built, moved and taken down by the build routes,
 * taken down by a Ground-changing rename and by the `plots:pieces --clear`
 * CLI. Migration 0008, expand-only.
 */
export const plotPieces = pgTable(
  'plot_pieces',
  {
    kindledId: uuid('kindled_id')
      .notNull()
      .references(() => kindled.id, { onDelete: 'cascade' }),
    plotId: text('plot_id').notNull(),
    pieceId: text('piece_id').notNull(),
    col: integer('col').notNull(),
    row: integer('row').notNull(),
    rotation: integer('rotation').notNull().default(0),
    builtAt: timestamp('built_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.kindledId, t.plotId, t.pieceId] })],
);

export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type KindledRow = typeof kindled.$inferSelect;
export type HoldingActivityRow = typeof holdingActivity.$inferSelect;
export type SkillXpRow = typeof skillXp.$inferSelect;
export type WritRow = typeof writs.$inferSelect;
export type KeshGiftRow = typeof keshGifts.$inferSelect;
export type KnownWordRow = typeof knownWords.$inferSelect;
export type PlotRow = typeof plots.$inferSelect;
export type BasketCycleRow = typeof basketCycles.$inferSelect;
export type PlotPieceRow = typeof plotPieces.$inferSelect;
