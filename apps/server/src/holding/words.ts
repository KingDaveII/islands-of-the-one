import { validateUsername, wordDef, WORDS } from '@iot/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { accounts, kindled, knownWords } from '../db/schema.js';

/**
 * The word tiles a Kindled knows (docs/design/holding.md "Plots", M2 Task
 * 5): knowledge, not items, so no slot and no ledger. The `known_words` table
 * is read and written only here: by Kesh's gift (kesh.ts, under the Kindled's
 * lock) and by the playtest CLIs `words:grant` and `words:forget`, so a
 * playtest can learn ישן, which nothing gives in M2 (Tabita trades it in M4).
 */

/** The ids of the words a Kindled knows, in words.json order. Inside a caller's transaction when given one. */
export async function knownWordIds(db: Database | Transaction, kindledId: string): Promise<string[]> {
  const rows = await db.select({ wordId: knownWords.wordId }).from(knownWords).where(eq(knownWords.kindledId, kindledId));
  const known = new Set(rows.map((r) => r.wordId));
  return WORDS.filter((w) => known.has(w.id)).map((w) => w.id);
}

/** Whether a Kindled knows a word. */
export async function knowsWord(db: Database | Transaction, kindledId: string, wordId: string): Promise<boolean> {
  const [row] = await db
    .select({ wordId: knownWords.wordId })
    .from(knownWords)
    .where(and(eq(knownWords.kindledId, kindledId), eq(knownWords.wordId, wordId)))
    .limit(1);
  return row !== undefined;
}

/** Teaches a Kindled a word (nothing changes when it knows it already). Returns whether it was new. */
export async function learnWord(db: Database | Transaction, kindledId: string, wordId: string, now: Date): Promise<boolean> {
  const inserted = await db.insert(knownWords).values({ kindledId, wordId, learnedAt: now }).onConflictDoNothing().returning({ wordId: knownWords.wordId });
  return inserted.length > 0;
}

/** The playtest CLIs: `words:grant <username> <wordId>` teaches a word, `words:forget <username> <wordId>` takes it back. */
export const WORDS_USAGE = 'usage: words:grant <username> <wordId> | words:forget <username> <wordId>   (a word id of words.json: adamah, yashan)';

export interface WordsArgs {
  username: string;
  wordId: string;
}

export function parseWordsArgs(argv: readonly string[]): { ok: true; args: WordsArgs } | { ok: false; message: string } {
  const rest = argv.filter((a) => a !== '--');
  if (rest.length !== 2) return { ok: false, message: WORDS_USAGE };
  const [rawUsername = '', wordId = ''] = rest;
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  if (!wordDef(wordId)) return { ok: false, message: `unknown word ${wordId}; words.json has ${WORDS.map((w) => w.id).join(', ')}` };
  return { ok: true, args: { username: username.value, wordId } };
}

export type WordsResult = { ok: true; kindledId: string; known: string[]; changed: boolean } | { ok: false; message: string };

async function kindledOf(db: Database, username: string): Promise<string | null> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  return row?.kindledId ?? null;
}

/** `words:grant`: the Kindled learns the word (a word it knows already changes nothing). */
export async function grantWord(db: Database, { username, wordId }: WordsArgs, now: Date = new Date()): Promise<WordsResult> {
  const kindledId = await kindledOf(db, username);
  if (!kindledId) return { ok: false, message: `no Kindled for username ${username}` };
  if (!wordDef(wordId)) return { ok: false, message: `unknown word ${wordId}` };
  const changed = await learnWord(db, kindledId, wordId, now);
  return { ok: true, kindledId, known: await knownWordIds(db, kindledId), changed };
}

/** `words:forget`: the Kindled forgets the word. A plot named with it keeps its sentence; only the panel's choices change. */
export async function forgetWord(db: Database, { username, wordId }: WordsArgs): Promise<WordsResult> {
  const kindledId = await kindledOf(db, username);
  if (!kindledId) return { ok: false, message: `no Kindled for username ${username}` };
  const removed = await db
    .delete(knownWords)
    .where(and(eq(knownWords.kindledId, kindledId), eq(knownWords.wordId, wordId)))
    .returning({ wordId: knownWords.wordId });
  return { ok: true, kindledId, known: await knownWordIds(db, kindledId), changed: removed.length > 0 };
}
