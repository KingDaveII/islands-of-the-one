import { PLOT_DIVIDER } from './letters.js';
import { isSafe, type SafeResult } from './safe-letters.js';
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
 * The sentence as it is shown: the Ground's letters, the divider, the
 * Virtue's (the Ground alone without a Virtue). `shapeLetters` places the
 * divider; the filter drops it.
 */
export function plotSentence(ground: Pick<WordDef, 'letters'>, virtue: Pick<WordDef, 'letters'> | null): string {
  return virtue ? `${ground.letters} ${PLOT_DIVIDER} ${virtue.letters}` : ground.letters;
}

/**
 * The plot-sentence filter (LORE, decided 2026-10-18: "A plot sentence is
 * not a Name, and it isn't cut as one"). A Name is one run of letters heard
 * from speech, so it takes the strict rule (no yod-he anywhere). A plot
 * sentence is two tiles with a divider point between them, and "the divider
 * closes the door": yod and he may meet across it, so אדמה · ישן is sealed
 * as it stands. Each tile passes the strict filter on its own (checked when
 * words.json loads); here the whole sentence, read across the divider in
 * both orders (Ground then Virtue, and Virtue then Ground), passes the
 * ordinary filter, so the banned name and title can never be put together
 * from tiles. A Ground alone passes as its tile does.
 */
export function plotSentenceSafe(ground: Pick<WordDef, 'letters'>, virtue: Pick<WordDef, 'letters'> | null): SafeResult {
  if (!virtue) return isSafe(ground.letters);
  const forward = isSafe(`${ground.letters} ${virtue.letters}`);
  if (!forward.ok) return forward;
  return isSafe(`${virtue.letters} ${ground.letters}`);
}

/** The Writ line a plot belongs to, by its index in the layout's plots: `linePlots` per line, line 1 first. */
export function plotLine(index: number, linePlots: number = writData.linePlots): number {
  return Math.floor(index / linePlots) + 1;
}

/**
 * The whole days a plot has kept its name by `atMs`: from when the Virtue
 * was set, less the time the plot spent faded (`pausedMs`; GAME DESIGN: "the
 * count runs on through the grace period and pauses while the plot is
 * faded"). Never negative; 0 without a Virtue.
 */
export function daysKept(virtueSetAt: number | null, pausedMs: number, atMs: number): number {
  if (virtueSetAt === null) return 0;
  return Math.max(0, Math.floor((atMs - virtueSetAt - pausedMs) / DAY_MS));
}

/**
 * A Virtue's yield bonus in permille at a moment: for `yield-per-day`,
 * `permillePerDay` for every whole day the name has been kept by then
 * (`daysKept`), up to `maxPermille`; 0 without a Virtue or before it was
 * set.
 */
export function yieldBonusPermille(effect: WordEffect | null, virtueSetAt: number | null, pausedMs: number, atMs: number): number {
  if (!effect) return 0;
  return Math.min(effect.maxPermille, effect.permillePerDay * daysKept(virtueSetAt, pausedMs, atMs));
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
export function cycleBonuses(
  n: number,
  from: number,
  cycleMs: number,
  effect: WordEffect | null,
  virtueSetAt: number | null,
  pausedMs = 0,
): number[] {
  return Array.from({ length: n }, (_, i) => yieldBonusPermille(effect, virtueSetAt, pausedMs, from + (i + 1) * cycleMs));
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
 * Every player-facing line of the plots, in one place: LORE's and GAME
 * DESIGN's, word for word (the brief's lines, with their answers of
 * 2026-10-18). The refusal lines the brief gives only a code for (unknown
 * plot, unknown word, wrong slot, unchanged, not sown, already sown) are
 * MAIN's short placeholders; the Field and Plot seal tooltips are too, the
 * brief naming LORE's (§14.3) without quoting them.
 */
export const PLOT_TEXT = {
  // The server's refusals.
  /** `unknown-plot` (placeholder). */
  UNKNOWN_PLOT: 'No such plot on this holding.',
  /** `unnamed`: plots appear only once the island has a Name (LORE §14.3); the Writ's line. */
  UNNAMED: 'Name the island first.',
  /** `faded`: the plot's line has faded (LORE's panel line). */
  FADED: "Faded into the haze with your Writ's first line. Feed your Writ and it will remember.",
  /** `unknown-word` (placeholder). */
  UNKNOWN_WORD: "You don't know that word.",
  /** `wrong-slot` (placeholder). */
  WRONG_SLOT: 'That word goes in the other slot.',
  /** `no-ground` (GAME DESIGN). */
  NO_GROUND: 'A Ground tile decides the building; without a Ground the plot cannot be built on',
  /** `unchanged` (placeholder). */
  UNCHANGED: 'The plot already has that name.',
  /** `sentence-refused` (LORE). */
  SENTENCE_REFUSED: "Those words won't hold together. Try another pair.",
  /** `insufficient`: a rename or a sowing without the gin or the seed (the Writ's line). */
  INSUFFICIENT: "You don't have that many.",
  /** `unnamed-plot`: work, take or sow at a plot with no name (placeholder). */
  UNNAMED_PLOT: 'Give the plot a word first.',
  /** `not-sown`: work at a field not sown yet (GAME DESIGN's panel line). */
  NOT_SOWN: 'Not sown yet.',
  /** `already-sown` (placeholder). */
  ALREADY_SOWN: 'The field is sown.',
  // The plot sentence panel (GAME DESIGN's screen, LORE's lines).
  TITLE_NAME: 'Name this plot',
  TITLE_RENAME: 'Rename this plot',
  SLOT_GROUND: 'Ground',
  SLOT_VIRTUE: 'Virtue',
  NONE: 'None',
  NO_GROUND_WORDS: "You don't know any Ground words yet.",
  NO_VIRTUE_WORDS: "You don't know any Virtue words yet.",
  BUILDS: 'Builds: ',
  /** ישן's effect in the preview. */
  YIELD_PER_DAY_EFFECT: '+1% yield for each day it keeps its name, up to +20%',
  COST_FIRST: 'First naming: free',
  COST_RENAME: 'Renaming: 1 sealed gin',
  /** The tooltip on the renaming cost (LORE). */
  COST_RENAME_TIP: 'A name is paid for.',
  LEVEL: 'Level ',
  /** "Pieces: none yet" and the pieces' names are BUILD_TEXT's (M2 Task 6). */
  CONFIRM: 'CONFIRM',
  RENAME: 'RENAME',
  SOW: 'SOW',
  // Tooltips. The unnamed plot's is LORE's (§14.3, word for word); the brief names LORE's Field and Plot seal
  // tooltips (§14.3) without quoting them, so these two are MAIN's placeholders until LORE's text lands.
  UNNAMED_PLOT_TIP: 'Ground, but not yet ground for anything. Give it a word.',
  FIELD_TIP: 'Tilled ground with a word on it. Grain comes up on its own while your Writ is lit.',
  SEAL_TIP: 'The sentence the plot answers to, and its sigil.',
  // The field's station panel (GAME DESIGN's screen, LORE's lines).
  /** "+3% for keeping its name", the figure being the bonus so far. */
  BONUS_LINE: (percent: number): string => `+${percent}% for keeping its name`,
  NEXT_IN: (time: string): string => `Next in ${time}`,
  RESTING: 'Resting while your Writ is dark.',
  FADED_PANEL: "Faded into the haze with your Writ's first line. Feed your Writ and it will remember.",
} as const;

/** A cycle's length in words for a rate line: "20 s", "15 min", "2 h". */
export function durationWords(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  return `${ms / 1000} s`;
}

/** The (proposed) lines and LORE's that the PR lists: every string of PLOT_TEXT, for the drawable-characters test. */
export function plotTextLines(): string[] {
  const out: string[] = [];
  for (const v of Object.values(PLOT_TEXT)) if (typeof v === 'string') out.push(v);
  out.push(PLOT_TEXT.BONUS_LINE(3), PLOT_TEXT.NEXT_IN('12 min'));
  return out;
}
