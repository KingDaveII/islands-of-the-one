import { isSafe, type SafeResult } from './safe-letters.js';
import type { StationCycle } from './holding.js';
import { writData } from './writ-data.js';
import type { WordDef, WordEffect } from './words.js';

/**
 * Plots and plot sentences (docs/design/holding.md "Plots", M2 Task 5): the
 * pure rules the server and the client share, and every player-facing line
 * of the plots in one place, so LORE's answers are a text edit. A plot is
 * named with a plot sentence, two word tiles right to left: the Ground
 * (what the plot is for; it builds its station) and the Virtue (what more
 * is asked of it). The sentence goes through the safe-letters filter before
 * it is stored. A named plot with a kind that has a basket cycle makes its
 * yield on its own while the Writ has charge; the Virtue ישן grows that
 * yield by the day. Everything here is integers and pure: same input, same
 * result.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The filter mode for plot sentences. Strict is the conservative reading of
 * CLAUDE.md (every generated or chosen run of letters refuses the yod-he
 * pair), and it has a consequence: אדמה then ישן puts he against yod across
 * the space, so Field (אדמה · ישן) is refused today. LORE has been asked
 * whether plot sentences take the strict rule or only the non-strict one;
 * the answer is this one constant (and the pinned pairs in
 * test/plots.test.ts).
 */
export const PLOT_SENTENCE_STRICT = true;

/** The sentence as the letters are written: the Ground's, a space, the Virtue's (none without a Virtue). */
export function plotSentence(ground: Pick<WordDef, 'letters'>, virtue: Pick<WordDef, 'letters'> | null): string {
  return virtue ? `${ground.letters} ${virtue.letters}` : ground.letters;
}

/** The plot-sentence filter: `isSafe` in the plots' mode. */
export function plotSentenceSafe(sentence: string): SafeResult {
  return isSafe(sentence, { strict: PLOT_SENTENCE_STRICT });
}

/** The Writ line a plot belongs to, by its index in the layout's plots: `linePlots` per line, line 1 first. */
export function plotLine(index: number, linePlots: number = writData.linePlots): number {
  return Math.floor(index / linePlots) + 1;
}

/**
 * A Virtue's yield bonus in permille at a moment: for `yield-per-day`,
 * `permillePerDay` for every whole day from when the Virtue was set to that
 * moment, up to `maxPermille`; 0 without a Virtue, before it was set, or
 * for an effect of another kind.
 */
export function yieldBonusPermille(effect: WordEffect | null, virtueSetAt: number | null, atMs: number): number {
  if (!effect || virtueSetAt === null || atMs < virtueSetAt) return 0;
  const days = Math.floor((atMs - virtueSetAt) / DAY_MS);
  return Math.min(effect.maxPermille, effect.permillePerDay * days);
}

/**
 * What `n` cycles of a basket cycle credit, each with its own bonus, with the
 * remainder carried in permille: credit `floor((carry + Σ quantity × (1000 +
 * bonus)) / 1000)` and keep what is left as the new carry. All integers.
 */
export function creditCycles(quantity: number, carryPermille: number, bonuses: readonly number[]): { credited: number; carry: number } {
  let total = carryPermille;
  for (const bonus of bonuses) total += quantity * (1000 + bonus);
  return { credited: Math.floor(total / 1000), carry: total % 1000 };
}

/**
 * The bonus of each of `n` cycles ending from `from` every `cycleMs`: the
 * Virtue's days are counted to each cycle's end. The count restarts
 * whenever the Virtue is set or changed (`virtueSetAt`).
 */
export function cycleBonuses(n: number, from: number, cycleMs: number, effect: WordEffect | null, virtueSetAt: number | null): number[] {
  return Array.from({ length: n }, (_, i) => yieldBonusPermille(effect, virtueSetAt, from + (i + 1) * cycleMs));
}

/**
 * Task 6's seam: a station's speed in permille of the base, 1000 today
 * (each piece standing in the plot adds +25% in Task 6).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Task 6 reads the pieces
export function cycleSpeedPermille(_pieces = 0): number {
  return 1000;
}

/** A basket cycle's length: `cycleMs` over the station's speed factor (1 today). */
export function cycleLengthMs(cycle: Pick<StationCycle, 'cycleMs'>, pieces = 0): number {
  return Math.round((cycle.cycleMs * 1000) / cycleSpeedPermille(pieces));
}

/** A plot's level: 1 plus the pieces standing in it (none until Task 6). */
export function plotLevel(pieces = 0): number {
  return 1 + pieces;
}

/** How long until the next cycle lands, from when the clock stood (`cycledUntil`) and the server's clock; never negative. */
export function nextCycleInMs(cycledUntil: number, cycleMs: number, nowMs: number): number {
  const elapsed = nowMs - cycledUntil;
  if (elapsed < 0) return cycleMs;
  return cycleMs - (elapsed % cycleMs);
}

/** The gin a change of an already named plot costs; the first naming is free. */
export const RENAME_COST_GIN = 1;
export const RENAME_COST_ITEM = 'sealed-gin';

/**
 * Every player-facing line of the plots, in one place. LORE's, word for
 * word, where marked; the rest are MAIN's placeholders (proposed, sent to
 * LORE on 2026-10-18) and stay as written until LORE answers.
 */
export const PLOT_TEXT = {
  // The server's refusals.
  /** `unknown-plot` (proposed). */
  UNKNOWN_PLOT: 'No such plot on this holding.',
  /** `unnamed`: plots appear only once the island has a Name (LORE §14.3). */
  UNNAMED: 'Name the island first.',
  /** `faded`: the plot's line has faded (proposed). */
  FADED: 'Faded into the haze with its line. Feed your Writ to bring it back.',
  /** `unknown-word` (proposed). */
  UNKNOWN_WORD: "You don't know that word.",
  /** `wrong-slot` (proposed). */
  WRONG_SLOT: 'That word goes in the other slot.',
  /** `no-ground` (GAME DESIGN). */
  NO_GROUND: 'A Ground tile decides the building; without a Ground the plot cannot be built on',
  /** `unchanged` (proposed). */
  UNCHANGED: 'The plot already has that name.',
  /** `sentence-refused` (proposed). */
  SENTENCE_REFUSED: "Those words won't hold together. Try another.",
  /** `insufficient`: a rename without the gin (the Writ's line). */
  INSUFFICIENT: "You don't have that many.",
  /** `unnamed-plot`: work or take at a plot with no name (proposed). */
  UNNAMED_PLOT: 'Give the plot a word first.',
  // The plot sentence panel (proposed unless marked LORE).
  TITLE_NAME: 'Name this plot',
  TITLE_RENAME: 'Rename this plot',
  SLOT_GROUND: 'Ground',
  SLOT_VIRTUE: 'Virtue',
  NONE: 'None',
  NO_GROUND_WORDS: "You don't know any Ground words yet.",
  /** LORE's. */
  NO_VIRTUE_WORDS: "You don't know any Virtue words yet.",
  BUILDS: 'Builds: ',
  /** ישן's effect in the preview. */
  YIELD_PER_DAY_EFFECT: '+1% yield for each day it keeps its name, up to +20%',
  COST_FIRST: 'First naming: free',
  COST_RENAME: 'Renaming: 1 gin',
  LEVEL: 'Level ',
  PIECES_NONE: 'Pieces: none',
  CONFIRM: 'CONFIRM',
  RENAME: 'RENAME',
  // Tooltips. The unnamed plot's is LORE's (§14.3, word for word); the brief names LORE's Field and Plot seal
  // tooltips (§14.3) without quoting them, so these two are MAIN's placeholders (proposed) until LORE's text lands.
  UNNAMED_PLOT_TIP: 'Ground, but not yet ground for anything. Give it a word.',
  FIELD_TIP: 'Tilled ground with a word on it. Grain comes up on its own while your Writ is lit.',
  SEAL_TIP: 'The sentence the plot answers to, and its sigil.',
  // The field's station panel (proposed).
  /** "+3% for keeping its name" with the bonus percent. */
  BONUS_LINE: (percent: number): string => `+${percent}% for keeping its name`,
  NEXT_IN: (time: string): string => `Next in ${time}`,
  RESTING: 'Resting while your Writ is dark.',
  FADED_PANEL: (line: number): string => `Faded into the haze with line ${line}. Feed your Writ to bring it back.`,
} as const;

/** The (proposed) lines and LORE's that the PR lists: every string of PLOT_TEXT, for the drawable-characters test. */
export function plotTextLines(): string[] {
  const out: string[] = [];
  for (const v of Object.values(PLOT_TEXT)) if (typeof v === 'string') out.push(v);
  out.push(PLOT_TEXT.BONUS_LINE(3), PLOT_TEXT.NEXT_IN('12 min'), PLOT_TEXT.FADED_PANEL(1));
  return out;
}
