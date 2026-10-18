import stationsJson from '../data/stations.json' with { type: 'json' };
import wordsJson from '../data/words.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import { positionsFromText } from './letters.js';
import { isSafe } from './safe-letters.js';

/**
 * The lexicon of word tiles (data/words.json; docs/design/holding.md
 * "Plots", M2 Task 5; LORE §4.5): the words a plot sentence is made of. A
 * word is knowledge, not an item: the server keeps which words a Kindled
 * knows (`known_words`), and a plot sentence names two of them, a Ground
 * (what the plot is for; it builds a plot kind of stations.json) and a
 * Virtue (what more is asked of it; it has an effect). Validated on load
 * like items.json: a bad file throws, and test/words.test.ts fails. M2 knows
 * two words; the rest of LORE's 30 come with the tasks that give them
 * effects.
 */

export const WORD_SLOTS = ['ground', 'virtue'] as const;
export type WordSlot = (typeof WORD_SLOTS)[number];

/** A word's element: the seal ring's colour and the sigil's line style (LORE: earth heavy and straight, water a long wave, fire jagged, air thin and broken). */
export const WORD_ELEMENTS = ['earth', 'water', 'fire', 'air'] as const;
export type WordElement = (typeof WORD_ELEMENTS)[number];

/**
 * A Virtue's effect. `yield-per-day` (ישן, GAME DESIGN): the basket cycle's
 * yield grows by `permillePerDay` for every whole day the plot has kept its
 * Virtue, up to `maxPermille`; the active action is untouched.
 */
export interface YieldPerDayEffect {
  kind: 'yield-per-day';
  permillePerDay: number;
  maxPermille: number;
}
export type WordEffect = YieldPerDayEffect;
export const WORD_EFFECT_KINDS = ['yield-per-day'] as const;

export interface WordDef {
  /** The transliteration in kebab-case; stored in the database, so never renamed. */
  id: string;
  /** The base Old Letters, as the Writ stores them (shapeLetters adds the final forms). */
  letters: string;
  /** How it is said ("adamah"). */
  say: string;
  /** Its gloss ("tilled ground"). */
  meaning: string;
  slot: WordSlot;
  element: WordElement;
  /** LORE's card text, word for word. */
  card: string;
  /** For a Ground: the plot kind it builds (stations.json `plotKinds`). */
  builds: string | null;
  /** For a Virtue: what it asks of the plot. */
  effect: WordEffect | null;
}

const WORD_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const KEYS = ['id', 'letters', 'say', 'meaning', 'slot', 'element', 'card', 'builds', 'effect'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isSlot = (value: unknown): value is WordSlot => typeof value === 'string' && (WORD_SLOTS as readonly string[]).includes(value);
const isElement = (value: unknown): value is WordElement =>
  typeof value === 'string' && (WORD_ELEMENTS as readonly string[]).includes(value);

/** Whether a word's letters are nothing but Old Letters (base forms), at least one. */
export function isBaseLetters(letters: unknown): letters is string {
  if (typeof letters !== 'string' || letters === '') return false;
  const positions = positionsFromText(letters);
  return positions.length === Array.from(letters).length && positions.length > 0;
}

function parseEffect(value: unknown, at: string, problems: string[]): WordEffect | null {
  if (!isObject(value)) {
    problems.push(`${at}: effect must be an object`);
    return null;
  }
  if (value.kind !== 'yield-per-day') {
    problems.push(`${at}: effect.kind must be one of ${WORD_EFFECT_KINDS.join(', ')}`);
    return null;
  }
  const extra = Object.keys(value).filter((k) => !['kind', 'permillePerDay', 'maxPermille'].includes(k));
  if (extra.length > 0) problems.push(`${at}: effect has unknown field(s) ${extra.join(', ')}`);
  if (!isCount(value.permillePerDay)) problems.push(`${at}: effect.permillePerDay must be a positive integer`);
  if (!isCount(value.maxPermille)) problems.push(`${at}: effect.maxPermille must be a positive integer`);
  if (isCount(value.permillePerDay) && isCount(value.maxPermille) && value.maxPermille < value.permillePerDay)
    problems.push(`${at}: effect.maxPermille must be at least one day's permillePerDay`);
  if (!isCount(value.permillePerDay) || !isCount(value.maxPermille)) return null;
  return { kind: 'yield-per-day', permillePerDay: value.permillePerDay, maxPermille: value.maxPermille };
}

/**
 * Check words.json-shaped data against the plot kinds of stations.json
 * (`plotKindIds`); every problem is listed, not just the first. A word's
 * letters are base Old Letters that pass the safe-letters filter (strict:
 * a tile is a generated Name's kin); a Ground builds a plot kind and has no
 * effect, a Virtue has an effect and builds nothing.
 */
export function validateWordsData(
  data: unknown,
  plotKindIds: readonly string[],
): { ok: true; words: WordDef[] } | { ok: false; problems: string[] } {
  if (!isObject(data) || !Array.isArray(data.words)) return { ok: false, problems: ['expected { words: [...] }'] };
  const problems: string[] = [];
  const words: WordDef[] = [];
  const seen = new Set<string>();
  const extraTop = Object.keys(data).filter((k) => !['$comment', 'words'].includes(k));
  if (extraTop.length > 0) problems.push(`unknown field(s) ${extraTop.join(', ')}`);
  data.words.forEach((entry: unknown, i) => {
    const at = `words[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !KEYS.includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    const { id, letters, say, meaning, slot, element, card, builds, effect } = entry;
    if (typeof id !== 'string' || !WORD_ID.test(id)) {
      problems.push(`${at}: id must be kebab-case (it is stored)`);
      return;
    }
    const where = `${at} (${id})`;
    if (seen.has(id)) problems.push(`${where}: duplicate id`);
    seen.add(id);
    const before = problems.length;
    if (!isBaseLetters(letters)) problems.push(`${where}: letters must be base Old Letters, at least one`);
    else {
      const safe = isSafe(letters, { strict: true });
      if (!safe.ok) problems.push(`${where}: letters fail the safe-letters filter (${safe.reason ?? 'refused'})`);
    }
    for (const [key, text] of [
      ['say', say],
      ['meaning', meaning],
      ['card', card],
    ] as const)
      if (typeof text !== 'string' || text.trim() === '' || !isDrawable(text))
        problems.push(`${where}: ${key} must be non-empty text the game can draw`);
    if (!isSlot(slot)) problems.push(`${where}: slot must be one of ${WORD_SLOTS.join(', ')}`);
    if (!isElement(element)) problems.push(`${where}: element must be one of ${WORD_ELEMENTS.join(', ')}`);
    let parsedEffect: WordEffect | null = null;
    if (slot === 'ground') {
      if (typeof builds !== 'string' || !plotKindIds.includes(builds))
        problems.push(`${where}: a Ground builds a plot kind of stations.json (${plotKindIds.join(', ') || 'none'})`);
      if (effect !== undefined) problems.push(`${where}: a Ground has no effect`);
    } else if (slot === 'virtue') {
      if (builds !== undefined) problems.push(`${where}: a Virtue builds nothing`);
      if (effect === undefined) problems.push(`${where}: a Virtue needs an effect`);
      else parsedEffect = parseEffect(effect, where, problems);
    }
    if (problems.length > before) return;
    words.push({
      id,
      letters: letters as string,
      say: say as string,
      meaning: meaning as string,
      slot: slot as WordSlot,
      element: element as WordElement,
      card: card as string,
      builds: typeof builds === 'string' ? builds : null,
      effect: parsedEffect,
    });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, words };
}

/** The plot kind ids a Ground may build (stations.json's `plotKinds`, which holding.ts validates in full). */
const PLOT_KIND_IDS: readonly string[] = stationsJson.plotKinds.map((p) => p.id);

function loadWords(): readonly WordDef[] {
  const result = validateWordsData(wordsJson, PLOT_KIND_IDS);
  if (!result.ok) throw new Error(`data/words.json:\n${result.problems.join('\n')}`);
  return result.words;
}

/** Every word, in words.json order. */
export const WORDS: readonly WordDef[] = loadWords();
const WORD_BY_ID: ReadonlyMap<string, WordDef> = new Map(WORDS.map((w) => [w.id, w]));

export function wordDef(id: string): WordDef | undefined {
  return WORD_BY_ID.get(id);
}

export function isWordId(value: unknown): value is string {
  return typeof value === 'string' && WORD_BY_ID.has(value);
}

/** The words of one slot, in words.json order. */
export function wordsInSlot(slot: WordSlot, words: readonly WordDef[] = WORDS): WordDef[] {
  return words.filter((w) => w.slot === slot);
}
