import {
  exactTime,
  HOUR_MS,
  feedRefusal,
  FILL_ITEM,
  fillPreview,
  feedPreview,
  hearName,
  heardLetterCount,
  itemDef,
  writData,
  writFromView,
  writView,
  type FeedResult,
  type InventoryResponse,
  type WritDerived,
  type WritLine,
  type WritState,
  type WritView,
} from '@iot/shared';
import type { LetterState } from '../render/letters.js';
import { displayable } from './drawable.js';

/**
 * The Writ on the client (docs/design/holding.md "The Writ", M2 Task 4a),
 * pure so it is tested in node: the Name screen's live tablet, the Writ
 * face's letter states per Writ state (the flicker beat, the relight after a
 * feed), the panel's lines, the feed choices and their previews, and the
 * HUD's chip. The scene (ui/writPanel.ts, ui/nameScreen.ts,
 * render/holdingHud.ts) draws these and sends the requests; the state only
 * ever comes from the server, re-derived between heartbeats with the shared
 * `writView` at the client's estimate of the server's clock.
 */

/** The Writ's top line, emet: alef, mem, tav. */
export const EMET = 'אמת';

// LORE §14.3, word for word (the book's lines; don't reword).
export const NAME_TITLE = 'Name your island.';
export const NAME_BODY =
  'Whatever you write here will be cut into your Writ in the Old Letters, and the Hollow will know this rock by it.';
export const TABLET_TIP = "Cut as it sounds, not as it's spelled. The Writ only has to hear it.";
export const NAME_CONFIRM = 'CONFIRM';

// GAME DESIGN's panel lines.
export const RIM_CERTIFIED = 'certified';
export const RIM_NOT_CERTIFIED = 'not certified: the Wet House in Malkhut';
export const NEXT_LINE_LINE = 'Line 2: certified, Writ clay, 20 gin';
export const FEED_ONE = 'FEED ONE';
export const FEED_COUNT = 'FEED';
export const FILL = 'FILL';
/** The gin count's sign (U+00D7, drawable). */
export const COUNT_SIGN = '×';

/** The letters of a text, spaces dropped (what per-letter states index). */
export function lettersOf(text: string): string[] {
  return Array.from(text).filter((c) => !/\s/.test(c));
}

/** The derived state of the Writ in an answer at the client's estimate of the server's clock. */
export function derive(view: WritView, serverMs: number): WritDerived {
  return writView(writFromView(view), serverMs);
}

// --- The Name screen -----------------------------------------------------------

/** What the live tablet shows for a typed Name: its letters so far (hearName), or nothing while empty. */
export function tabletLetters(typed: string): string {
  return hearName(typed);
}

/**
 * The tablet's letter states as the player types: the letters already there
 * stay lit, each new letter is ember. "New" is what differs from the last
 * hearing, from the first changed letter on (the doors can change an
 * earlier letter too).
 */
export function tabletStates(previous: string, current: string): LetterState[] {
  const before = lettersOf(previous);
  const now = lettersOf(current);
  let same = 0;
  while (same < before.length && same < now.length && before[same] === now[same]) same++;
  return now.map((_, i) => (i < same ? 'lit' : 'ember'));
}

/** The accepted Name's flare: each letter flares ember in turn and settles lit, whole frames. */
export const FLARE_STEP_MS = 70;
export const FLARE_HOLD_MS = 210;

export function flareStates(count: number, elapsedMs: number): LetterState[] {
  return Array.from({ length: count }, (_, i) => {
    const from = i * FLARE_STEP_MS;
    return elapsedMs >= from && elapsedMs < from + FLARE_HOLD_MS ? 'ember' : 'lit';
  });
}

export function flareDone(count: number, elapsedMs: number): boolean {
  return elapsedMs >= Math.max(0, count - 1) * FLARE_STEP_MS + FLARE_HOLD_MS;
}

// --- The Writ face -------------------------------------------------------------

/**
 * Whether the flicker is in a dim step at `ms` (true = the outer letters dim):
 * `writ.json`'s `flickerPatternMs`, ms lit, then dim, then lit…, repeating
 * (ART on #91: an uneven, guttering rhythm, never the steady blink of the
 * combat telegraphs).
 */
export function flickerBeat(ms: number, pattern: readonly number[] = writData.flickerPatternMs): boolean {
  const cycle = pattern.reduce((a, b) => a + b, 0);
  if (cycle <= 0) return false;
  let t = ((Math.floor(ms) % cycle) + cycle) % cycle;
  for (let i = 0; i < pattern.length; i++) {
    const step = pattern[i] ?? 0;
    if (t < step) return i % 2 === 1;
    t -= step;
  }
  return false;
}

/** The letter states of one line of the face (the emet line or the Name's), by the Writ's state. */
export interface FaceStates {
  emet: LetterState[];
  name: LetterState[];
}

/** The relight after a feed: the aleph returns first, then each faded line one after another, whole frames. */
export const RELIGHT_ALEPH_MS = 400;
export const RELIGHT_LINE_MS = 900;

/** How far a relight has come: whether the aleph is back, and how many lines have returned. */
export function relightProgress(elapsedMs: number, lineCount: number): { aleph: boolean; lines: number } {
  const aleph = elapsedMs >= RELIGHT_ALEPH_MS;
  const lines = aleph ? Math.min(lineCount, Math.floor((elapsedMs - RELIGHT_ALEPH_MS) / RELIGHT_LINE_MS)) : 0;
  return { aleph, lines };
}

export function relightDone(elapsedMs: number, lineCount: number): boolean {
  return relightProgress(elapsedMs, lineCount).lines >= lineCount;
}

/**
 * The face's letter states (GAME DESIGN's screen): lit, lit; flickering,
 * ember while low, with the outer letters (the first and last of each line)
 * switching between ember and dim on the beat; dark and fading, the aleph
 * dark so the Writ reads מת, the Name line dim while dark and dark once line
 * 1 has faded. A relight in progress (`relight`, from a feed's answer) keeps
 * the aleph dark until it returns and the lines dim until each returns.
 */
export function faceStates(
  writ: Pick<WritDerived, 'state' | 'lines'>,
  letters: string,
  beat: boolean,
  relight: { aleph: boolean; lines: number } | null = null,
): FaceStates {
  const emetCount = lettersOf(EMET).length;
  const nameCount = lettersOf(letters).length;
  const fill = (n: number, s: LetterState): LetterState[] => Array.from({ length: n }, () => s);
  const outer = (n: number, inner: LetterState, edge: LetterState): LetterState[] =>
    Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? edge : inner));
  if (relight) {
    return {
      emet: relight.aleph ? fill(emetCount, 'lit') : ['dark', ...fill(emetCount - 1, 'lit')],
      name: fill(nameCount, relight.lines >= 1 ? 'lit' : 'dim'),
    };
  }
  switch (writ.state) {
    case 'lit':
      return { emet: fill(emetCount, 'lit'), name: fill(nameCount, 'lit') };
    case 'flickering':
      return { emet: outer(emetCount, 'ember', beat ? 'dim' : 'ember'), name: outer(nameCount, 'ember', beat ? 'dim' : 'ember') };
    case 'dark':
    case 'fading': {
      const line1 = writ.lines[0]?.state ?? 'dark';
      return { emet: ['dark', ...fill(emetCount - 1, 'lit')], name: fill(nameCount, line1 === 'faded' ? 'dark' : 'dim') };
    }
  }
}

// --- The panel's lines ---------------------------------------------------------

export function rimLine(certified: boolean): string {
  return certified ? RIM_CERTIFIED : RIM_NOT_CERTIFIED;
}

/** The state line: "Lit", "Flickering", "Dark since 3 h 12 min, grace ends in 44 h 48 min", "Line 1 fading". */
export function stateLine(writ: Pick<WritDerived, 'state' | 'darkSince' | 'graceEndsAt'>, serverMs: number): string {
  switch (writ.state) {
    case 'lit':
      return 'Lit';
    case 'flickering':
      return 'Flickering';
    case 'dark':
      return `Dark since ${exactTime(serverMs - (writ.darkSince ?? serverMs))}, grace ends in ${exactTime(writ.graceEndsAt - serverMs)}`;
    case 'fading':
      return 'Line 1 fading';
  }
}

/** "Line 1, the Name: tethers 4 plots · lit"; from line 2 on, "Line 2: …". */
export function lineLine(line: WritLine): string {
  const which = line.line === 1 ? 'Line 1, the Name' : `Line ${line.line}`;
  return `${which}: tethers ${line.plots} plot${line.plots === 1 ? '' : 's'} · ${line.state}`;
}

/** The greyed feed button's tooltip while the Writ is full: "A sliver fits in about 4 h" (the hours until charge + 48 ≤ 144, rounded up). */
export function fullTip(writ: Pick<WritDerived, 'sliverFitsInMs'>): string {
  return `A sliver fits in about ${Math.ceil(writ.sliverFitsInMs / HOUR_MS)} h`;
}

/**
 * The charge in words, and the exact time for its tooltip, while the Writ is
 * lit or flickering; null when it is dark or fading (the charge is 0 and
 * the state line already says so: MAIN's review of #91).
 */
export function chargeLines(writ: Pick<WritDerived, 'state' | 'words' | 'chargeMs' | 'full'>): { words: string; exact: string } | null {
  if (writ.state === 'dark' || writ.state === 'fading') return null;
  // While full the words say so: "about five days, full" (GAME DESIGN).
  return { words: writ.full ? `${writ.words}, full` : writ.words, exact: exactTime(writ.chargeMs) };
}

/** The kinds the panel offers, in writ.json's order: the Sparkglass grades and gin. */
export const FEED_KINDS: readonly string[] = Object.keys(writData.feeds);

/** One kind in the panel: what the Kindled holds of it (pack, store; the purse for gin), and why it can't be fed now. */
export interface FeedChoice {
  itemId: string;
  /** The display name as a heading: "Wild slivers", "Humming glass". */
  name: string;
  pack: number;
  store: number;
  purse: number;
  /** What the feed can take: the pack and the store (the purse for currency). */
  have: number;
  /** GAME DESIGN's line when the kind doesn't fit now ("Too much for your Writ now", "Too much for one Writ", "Full."), else null. */
  refusal: string | null;
  /** Whether the kind can be fed at all now (it fits and the Kindled holds some). */
  enabled: boolean;
}

/** The kind's display name as a heading: slivers are counted ("Wild slivers"), glass and gin are mass nouns. */
const plural = (itemId: string): string => {
  const name = itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ');
  return displayable(name.endsWith('sliver') ? `${name}s` : name);
};

const count = (list: { itemId: string; quantity: number }[] | undefined, itemId: string): number =>
  list?.find((e) => e.itemId === itemId)?.quantity ?? 0;

/** The feed choices: every kind in `feeds`, with the Kindled's counts and the refusal that greys it. */
export function feedChoices(view: WritView, inventory: InventoryResponse | null, serverMs: number): FeedChoice[] {
  const stored = writFromView(view);
  return FEED_KINDS.map((itemId) => {
    const currency = itemDef(itemId)?.kind === 'currency';
    const pack = count(inventory?.pack, itemId);
    const store = count(inventory?.store, itemId);
    const purse = count(inventory?.purse, itemId);
    const have = currency ? purse : pack + store;
    const refusal = feedRefusal(stored, itemId, serverMs)?.message ?? null;
    return { itemId, name: plural(itemId), pack, store, purse, have, refusal, enabled: refusal === null && have > 0 };
  });
}

/** "2 in the pack, 1 in the store" (or "5 in the purse" for gin); "none" when nothing is held. */
export function heldLine(choice: FeedChoice): string {
  if (itemDef(choice.itemId)?.kind === 'currency') return choice.purse > 0 ? `${choice.purse} in the purse` : 'none';
  const parts: string[] = [];
  if (choice.pack > 0) parts.push(`${choice.pack} in the pack`);
  if (choice.store > 0) parts.push(`${choice.store} in the store`);
  return parts.length ? parts.join(', ') : 'none';
}

/** The preview of feeding `count` of a kind now: "+1/3 charge, about two days", or the refusal's line. */
export function feedLine(result: FeedResult): string {
  return result.ok ? `+${result.share} charge, ${result.words}` : result.message;
}

/** The preview of a feed from the panel's choice (and the gin count), before confirming. */
export function previewFeed(view: WritView, itemId: string, countOf: number, serverMs: number): FeedResult {
  return feedPreview(writFromView(view), itemId, countOf, serverMs);
}

/** Fill's preview: wild slivers only. */
export function previewFill(view: WritView, serverMs: number): FeedResult {
  return fillPreview(writFromView(view), serverMs);
}

/** Whether Fill can do anything now: a sliver fits and the Kindled holds one. */
export function fillEnabled(view: WritView, choices: readonly FeedChoice[], serverMs: number): boolean {
  const slivers = choices.find((c) => c.itemId === FILL_ITEM);
  return previewFill(view, serverMs).ok && (slivers?.have ?? 0) > 0;
}

/** Whether a kind takes a count (gin: "feed one (a count for gin)"); the glass feeds one at a time. */
export function takesCount(itemId: string): boolean {
  return itemDef(itemId)?.kind === 'currency';
}

/** The panel's feed button for a kind: FEED ONE for glass, "FEED 3" for gin (the number following the count). */
export function feedButtonLabel(itemId: string, count = 1): string {
  return takesCount(itemId) ? `${FEED_COUNT} ${count}` : FEED_ONE;
}

// --- The HUD -------------------------------------------------------------------

/** The Writ reads מת when dark or fading: mem, tav. */
export const MET = 'מת';

/** The HUD's Writ chip: the charge in words (מת when dark or fading, drawn from the letter sheet), ember under a day, the exact time as its tooltip. */
export interface WritChip {
  /** The words, or null when the chip shows מת instead. */
  text: string | null;
  /** The letters the chip shows instead of words (מת), or null. */
  letters: string | null;
  ember: boolean;
  tooltip: string;
  state: WritState;
}

export function writChip(writ: Pick<WritDerived, 'state' | 'words' | 'chargeMs'>): WritChip {
  const dark = writ.state === 'dark' || writ.state === 'fading';
  return {
    text: dark ? null : writ.words,
    letters: dark ? MET : null,
    ember: writ.state === 'flickering',
    tooltip: exactTime(writ.chargeMs),
    state: writ.state,
  };
}

/** The HUD's Name: as typed, and its letters; null before the island is named (the chip shows alone). */
export function hudName(view: WritView): { typed: string; letters: string } | null {
  return view.name !== null && view.letters !== null ? { typed: displayable(view.name), letters: view.letters } : null;
}

/** Whether a Name is wider than the face after the lean hand (the face widens, LORE: "the layout's problem"). */
export function overLine(letters: string): boolean {
  return heardLetterCount(letters) > writData.lineLetters;
}
