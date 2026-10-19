import {
  durationWords,
  fieldGroundSheet,
  exactTime,
  holdingLayout,
  itemCount,
  nextCycleInMs,
  PLOT_TEXT,
  plotKindDef,
  plotLevel,
  plotSentence,
  sigilPath,
  sigilStyle,
  TILE_SIZE_PX,
  wordDef,
  wordsInSlot,
  type FieldGroundCell,
  type FieldGroundSheet,
  type HoldingLayout,
  type HoldingResponse,
  type LayoutPlot,
  type PlotsTuning,
  type PlotView,
  type SigilPath,
  type SigilStyle,
  type StationCycle,
  type StationCycleView,
  type WordDef,
  type WordElement,
  type WordSlot,
} from '@iot/shared';
import { piecesLine } from './buildView.js';
import { displayable } from './drawable.js';

/**
 * Plots on the client (docs/design/holding.md "Plots", M2 Task 5), pure so it
 * is tested in node: the plot sentence panel's choices, lines and greyed
 * states; the sentence shown with its divider and its sigil; "Next in …" from
 * a cycle's clock and the server's; the cycle floats' prediction; the seal
 * scene's phases from the tuning; and the plots' world geometry (the ring,
 * the letters' band, the sigil's grid, the signpost) in world px. The scene
 * (ui/plotPanel.ts, render/holdingWorld.ts) draws these and sends the
 * requests; the server's answer decides everything.
 */

// --- The sentence ------------------------------------------------------------

/** The sentence a plot shows: the Ground's letters, the divider, the Virtue's; '' while unnamed or for a word this build lacks. */
export function sentenceLetters(ground: string | null, virtue: string | null): string {
  const g = ground === null ? undefined : wordDef(ground);
  if (!g) return '';
  const v = virtue === null ? undefined : wordDef(virtue);
  return plotSentence(g, v ?? null);
}

/** The sentence's sigil: one line through the Ground's letters then the Virtue's. */
export function sentenceSigil(ground: string | null, virtue: string | null): SigilPath {
  return sigilPath(sentenceLetters(ground, virtue));
}

/** The Ground's element (the seal's colour and the sigil's line style), earth when unknown. */
export function groundElement(ground: string | null): WordElement {
  return (ground === null ? undefined : wordDef(ground)?.element) ?? 'earth';
}

export function sentenceStyle(ground: string | null): SigilStyle {
  return sigilStyle(groundElement(ground));
}

// --- The plot sentence panel ---------------------------------------------------

/** One tile the panel offers for a slot, or "None" for an empty Virtue. */
export interface PlotChoice {
  /** The word id, or null for None. */
  wordId: string | null;
  letters: string;
  /** "adamah · tilled ground", or "None". */
  label: string;
  /** The word's effect in words ("Builds: Field"; "+1% yield…"), or null. */
  effect: string | null;
}

/** A word's effect in the panel's words: a Ground builds its kind; ישן's yield per day. */
export function effectLine(word: WordDef): string | null {
  if (word.slot === 'ground') return word.builds ? `${PLOT_TEXT.BUILDS}${displayable(plotKindDef(word.builds)?.name ?? word.builds)}` : null;
  return word.effect?.kind === 'yield-per-day' ? PLOT_TEXT.YIELD_PER_DAY_EFFECT : null;
}

/** The choices for a slot: the known tiles that fit it, in words.json order; the Virtue's start with None. */
export function slotChoices(slot: WordSlot, known: readonly string[]): PlotChoice[] {
  const tiles = wordsInSlot(slot)
    .filter((w) => known.includes(w.id))
    .map((w) => ({ wordId: w.id, letters: w.letters, label: displayable(`${w.say} · ${w.meaning}`), effect: effectLine(w) }));
  return slot === 'virtue' ? [{ wordId: null, letters: '', label: PLOT_TEXT.NONE, effect: null }, ...tiles] : tiles;
}

/** The line shown when a slot has no known tile. */
export function noWordsLine(slot: WordSlot): string {
  return slot === 'ground' ? PLOT_TEXT.NO_GROUND_WORDS : PLOT_TEXT.NO_VIRTUE_WORDS;
}

/** The sentence the panel has picked. */
export interface Picked {
  ground: string | null;
  virtue: string | null;
}

/** What the plot sentence panel shows for a plot and the picked sentence. */
export interface PlotPanelLines {
  title: string;
  /** Whether the plot has a name already (a rename). */
  renaming: boolean;
  /** "First naming: free" / "Renaming: 1 sealed gin". */
  cost: string;
  /** The tooltip on the renaming cost, or null for a first naming. */
  costTip: string | null;
  /** "Builds: Field", or null without a Ground. */
  builds: string | null;
  /** The Virtue's effect, or null. */
  effect: string | null;
  level: string;
  pieces: string;
  /** The picked sentence's letters, with the divider. */
  letters: string;
  /** CONFIRM is greyed while the sentence is unchanged or has no Ground. */
  confirmEnabled: boolean;
  /** The preview's tooltip: the Field's (LORE §14.3), once a Ground is picked; its two-word line with a Virtue. */
  previewTip: string | null;
}

export function plotPanelLines(plot: Pick<PlotView, 'ground' | 'virtue' | 'pieces'>, picked: Picked): PlotPanelLines {
  const renaming = plot.ground !== null;
  const ground = picked.ground === null ? undefined : wordDef(picked.ground);
  const virtue = picked.virtue === null ? undefined : wordDef(picked.virtue);
  const changed = picked.ground !== plot.ground || picked.virtue !== plot.virtue;
  return {
    title: renaming ? PLOT_TEXT.TITLE_RENAME : PLOT_TEXT.TITLE_NAME,
    renaming,
    cost: renaming ? PLOT_TEXT.COST_RENAME : PLOT_TEXT.COST_FIRST,
    costTip: renaming ? PLOT_TEXT.COST_RENAME_TIP : null,
    builds: ground ? effectLine(ground) : null,
    effect: virtue ? effectLine(virtue) : null,
    level: `${PLOT_TEXT.LEVEL}${plotLevel(plot.pieces)}`,
    pieces: piecesLine(plot.pieces),
    letters: sentenceLetters(picked.ground, picked.virtue),
    confirmEnabled: changed && ground !== undefined,
    previewTip: ground ? (virtue ? PLOT_TEXT.FIELD_TIP_VIRTUE : PLOT_TEXT.FIELD_TIP) : null,
  };
}

// --- Cycles: "Next in …" and the floats -----------------------------------------

/** "12 min", "1 h 59 min": the time to the next cycle, rounded up to the minute (never "0 min"). */
export function nextInWords(ms: number): string {
  const minutes = Math.max(1, Math.ceil(Math.max(0, ms) / 60_000));
  return exactTime(minutes * 60_000);
}

/** "Next in 12 min" from a cycle's clock and the server's time. */
export function nextInLine(cycle: Pick<StationCycleView, 'cycleMs' | 'cycledUntil'>, serverMs: number): string {
  return PLOT_TEXT.NEXT_IN(nextInWords(nextCycleInMs(Date.parse(cycle.cycledUntil), cycle.cycleMs, serverMs)));
}

/** The whole cycles a clock has completed by the server time (never negative): the "+1" floats are predicted from its changes. */
export function cyclesLanded(cycle: Pick<StationCycleView, 'cycleMs' | 'cycledUntil'>, serverMs: number): number {
  const from = Date.parse(cycle.cycledUntil);
  if (Number.isNaN(from) || cycle.cycleMs <= 0) return 0;
  return Math.max(0, Math.floor((serverMs - from) / cycle.cycleMs));
}

/** The cycle's rate: "1 pale grain every 15 min", "1 twisted log every 20 min" (a basket fills one item at a time; GAME DESIGN 2026-10-18). */
export function cycleRateLine(cycle: StationCycle): string {
  return `${displayable(itemCount(cycle.itemId, cycle.quantity))} every ${durationWords(cycle.cycleMs)}`;
}

/** "+3% for keeping its name": the bonus so far, whole percent; null at 0 (no Virtue, or no day kept yet). */
export function bonusLine(bonusPermille: number): string | null {
  const percent = Math.floor(bonusPermille / 10);
  return percent > 0 ? PLOT_TEXT.BONUS_LINE(percent) : null;
}

/** The plot of a holding answer by id, or undefined for a station. */
export function plotOf(r: Pick<HoldingResponse, 'plots'> | null, plotId: string): PlotView | undefined {
  return r?.plots.find((p) => p.id === plotId);
}

/** The named plots' ids: their signposts are pillars for the roam, their seals drawn. */
export function namedPlotIds(r: Pick<HoldingResponse, 'plots'> | null): string[] {
  return r?.plots.filter((p) => p.ground !== null).map((p) => p.id) ?? [];
}

// --- The seal scene ---------------------------------------------------------------

/** How far the seal scene has come at `elapsedMs`: the ring's share, the letters shown, the sigil's steps traced, the ground's share. */
export interface SealPhase {
  ring: number;
  letters: number;
  /** Segments of the sigil traced, 0..steps (fractional while tracing one). */
  sigil: number;
  ground: number;
  done: boolean;
}

/** The scene's length for a sentence: the ring, then each letter, then the sigil, then the ground (tuning.json `plots`). */
export function sealDurationMs(t: PlotsTuning, letterCount: number): number {
  return t.sealRingMs + letterCount * t.sealLetterMs + t.sealSigilMs + t.sealGroundMs;
}

export function sealPhase(t: PlotsTuning, elapsedMs: number, letterCount: number, sigilSteps: number): SealPhase {
  const e = Math.max(0, elapsedMs);
  const ring = Math.min(1, e / Math.max(1, t.sealRingMs));
  const afterRing = Math.max(0, e - t.sealRingMs);
  const letters = Math.min(letterCount, Math.floor(afterRing / Math.max(1, t.sealLetterMs)));
  const afterLetters = Math.max(0, afterRing - letterCount * t.sealLetterMs);
  const segments = Math.max(0, sigilSteps - 1);
  const sigil = Math.min(segments, (afterLetters / Math.max(1, t.sealSigilMs)) * segments);
  const afterSigil = Math.max(0, afterLetters - t.sealSigilMs);
  const ground = Math.min(1, afterSigil / Math.max(1, t.sealGroundMs));
  return { ring, letters, sigil, ground, done: e >= sealDurationMs(t, letterCount) };
}

// --- The plots in the world -----------------------------------------------------------

/** A rectangle in world px. */
export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The world px of one sim px (readability.md: the world draws at 2×). */
export const WORLD_SCALE = 2;
/** The seal ring's band: inset from the plot's edge and its thickness, world px. */
export const RING_INSET = 4;
export const RING_WIDTH = 2;
/**
 * The signpost (LORE 2026-10-18): no words; its board carries the plot's sigil, the seal's centre. Sizes in world px,
 * ART's `prop-signpost` (#125) drawn to them: the post this wide and tall over its tile's base, a square board on
 * top of it, the sigil's 3 × 3 grid of `SIGIL_CELL` cells inset `BOARD_PAD` inside the board.
 */
export const SIGNPOST_W = 6;
export const SIGNPOST_H = 18;
export const SIGIL_CELL = 8;
export const BOARD_PAD = 3;
export const BOARD_SIZE = 3 * SIGIL_CELL + 2 * BOARD_PAD;

/** A plot's rectangle in world px. */
export function plotWorldRect(plot: LayoutPlot): WorldRect {
  const px = TILE_SIZE_PX * WORLD_SCALE;
  return { x: plot.rect.col * px, y: plot.rect.row * px, w: plot.rect.cols * px, h: plot.rect.rows * px };
}

/** The field ground's cell for a named plot (ART, #123): faded once its line has faded (sown or not), else sown or unsown by `sownAt`. */
export function fieldGroundCell(view: Pick<PlotView, 'state' | 'sownAt'>): FieldGroundCell {
  if (view.state === 'faded') return 'faded';
  return view.sownAt === null ? 'unsown' : 'sown';
}

/**
 * Where the field ground tiles (world px): the plot's rect less the sheet's
 * `inset`, the headland of plain holding ground under the ring, its letters
 * and the divider. The tiling starts at this rect's top-left corner.
 */
export function fieldGroundRect(plot: LayoutPlot, sheet: Pick<FieldGroundSheet, 'inset'> = fieldGroundSheet): WorldRect {
  const r = plotWorldRect(plot);
  const { top, right, bottom, left } = sheet.inset;
  return { x: r.x + left, y: r.y + top, w: Math.max(0, r.w - left - right), h: Math.max(0, r.h - top - bottom) };
}

/** The seal ring's outer rectangle. */
export function ringRect(plot: LayoutPlot): WorldRect {
  const r = plotWorldRect(plot);
  return { x: r.x + RING_INSET, y: r.y + RING_INSET, w: r.w - 2 * RING_INSET, h: r.h - 2 * RING_INSET };
}

/** The pixels of a rectangular ring band, in order clockwise from the top-left corner (so it can draw itself round the plot). */
export function ringPixels(rect: WorldRect, width: number = RING_WIDTH): [number, number][] {
  const out: [number, number][] = [];
  const x1 = rect.x + rect.w - 1;
  const y1 = rect.y + rect.h - 1;
  for (let i = 0; i < width; i++) {
    const top = rect.y + i;
    const bottom = y1 - i;
    const left = rect.x + i;
    const right = x1 - i;
    // Each band one pixel inside the last, walked clockwise: top edge, right edge, bottom edge, left edge.
    const ring: [number, number][] = [];
    for (let x = left; x <= right; x++) ring.push([x, top]);
    for (let y = top + 1; y <= bottom; y++) ring.push([right, y]);
    for (let x = right - 1; x >= left; x--) ring.push([x, bottom]);
    for (let y = bottom - 1; y > top; y--) ring.push([left, y]);
    out.push(...ring);
  }
  return out;
}

/** A corner knot's size (ART's seal kit, #125): a square of the ring's colour centred on the band's corner. */
export const KNOT_SIZE = 6;

/**
 * The ring's four corner knots (ART's seal kit, #125, `ring()` in art/clean/seal-kit/kit.py): a `KNOT_SIZE` square
 * centred on each corner of the band, its middle `width` × `width` (the band's own corner) left to the band. In
 * ring order: top left, top right, bottom right, bottom left, each with the index of the band's outer corner pixel
 * in `ringPixels`, so a ring drawing itself adds a knot as it reaches that corner.
 */
export function ringKnots(rect: WorldRect, width: number = RING_WIDTH): { at: number; pixels: [number, number][] }[] {
  const x1 = rect.x + rect.w - width;
  const y1 = rect.y + rect.h - width;
  const corners: [number, number][] = [
    [rect.x, rect.y],
    [x1, rect.y],
    [x1, y1],
    [rect.x, y1],
  ];
  const outer = ringPixels(rect, width);
  const lo = -Math.floor((KNOT_SIZE - width) / 2);
  return corners.map(([cx, cy]) => {
    const pixels: [number, number][] = [];
    for (let dy = lo; dy < lo + KNOT_SIZE; dy++)
      for (let dx = lo; dx < lo + KNOT_SIZE; dx++) {
        if (dx >= 0 && dx < width && dy >= 0 && dy < width) continue;
        pixels.push([cx + dx, cy + dy]);
      }
    // The band's outermost pixel at this corner.
    const ox = cx === rect.x ? rect.x : rect.x + rect.w - 1;
    const oy = cy === rect.y ? rect.y : rect.y + rect.h - 1;
    const at = outer.findIndex(([x, y]) => x === ox && y === oy);
    return { at: Math.max(0, at), pixels };
  });
}

// --- The sigil's line by element (ART's seal kit, #125) -----------------------------------------------------------

/** The wave's sideways offsets along the line, a step a pixel: 1 px either side over 8 px. */
export const SIGIL_WAVE: readonly number[] = [0, 0, 1, 1, 0, 0, -1, -1];
/** The jag's offsets: out and back every 3 px. */
export const SIGIL_JAG: readonly number[] = [0, 1, -1];

/** The pixels of a straight line from a to b, both ends included (Bresenham, the order walked). */
export function linePixels(a: { x: number; y: number }, b: { x: number; y: number }): [number, number][] {
  let x = Math.round(a.x);
  let y = Math.round(a.y);
  const xe = Math.round(b.x);
  const ye = Math.round(b.y);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  const out: [number, number][] = [];
  for (;;) {
    out.push([x, y]);
    if (x === xe && y === ye) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * One segment of the sigil's line in its element's style (ART's seal kit, `stroke()` in kit.py): earth
 * `heavy-straight` 2 px; water `wave`, fire `jagged` (1 px, pushed across the segment by `SIGIL_WAVE` / `SIGIL_JAG`:
 * sideways on a mostly vertical segment, up and down otherwise); air `thin-broken` (1 px, dashes of 2 with gaps of 1).
 * `t` is the counter along the whole line, so the pattern runs on from one segment to the next; it returns the
 * pixels and the counter after the segment. `full`, the segment's whole end, decides its direction while a partial
 * stroke (the seal scene tracing it) stops at `b`.
 */
export function sigilStroke(
  a: { x: number; y: number },
  b: { x: number; y: number },
  style: SigilStyle,
  t: number,
  full: { x: number; y: number } = b,
): { pixels: [number, number][]; t: number } {
  const pts = linePixels(a, b);
  const vertical = Math.abs(full.y - a.y) > Math.abs(full.x - a.x);
  const pixels: [number, number][] = [];
  pts.forEach(([x, y], i) => {
    const step = t + i;
    if (style === 'thin-broken' && step % 3 === 2) return;
    const off =
      style === 'wave' ? (SIGIL_WAVE[step % SIGIL_WAVE.length] ?? 0) : style === 'jagged' ? (SIGIL_JAG[step % SIGIL_JAG.length] ?? 0) : 0;
    const p: [number, number] = vertical ? [x + off, y] : [x, y + off];
    pixels.push(p);
    if (style === 'heavy-straight') pixels.push(vertical ? [p[0] + 1, p[1]] : [p[0], p[1] + 1]);
  });
  return { pixels, t: t + pts.length };
}

/** Where the sentence's letters sit: centred on the ring's top edge, the band's thickness below the ring's top. */
export function lettersBand(plot: LayoutPlot, lettersWidthPx: number, scale: number = WORLD_SCALE): { x: number; y: number } {
  const ring = ringRect(plot);
  return { x: Math.round(ring.x + ring.w / 2 - (lettersWidthPx * scale) / 2), y: ring.y + RING_WIDTH + 2 };
}

/** The sigil grid's top-left corner (world px): inside the signpost's board, the seal's centre (LORE 2026-10-18). */
export function sigilOrigin(plot: LayoutPlot): { x: number; y: number } {
  const board = signpostBoard(plot);
  return { x: board.x + BOARD_PAD, y: board.y + BOARD_PAD };
}

/** The world px at the centre of a sigil step's chamber. */
export function sigilPoint(origin: { x: number; y: number }, step: { row: number; col: number }, cell: number = SIGIL_CELL): { x: number; y: number } {
  return { x: origin.x + step.col * cell + Math.floor(cell / 2), y: origin.y + step.row * cell + Math.floor(cell / 2) };
}

/** The signpost's base (the line it stands on, world px): the bottom centre of its tile. */
export function signpostBase(plot: LayoutPlot): { x: number; y: number } {
  const px = TILE_SIZE_PX * WORLD_SCALE;
  return { x: (plot.station.rect.col + 0.5) * px, y: (plot.station.rect.row + 1) * px };
}

/** The signpost's board in world px: centred over the post, its bottom on the post's top. */
export function signpostBoard(plot: LayoutPlot): WorldRect {
  const base = signpostBase(plot);
  return { x: Math.round(base.x - BOARD_SIZE / 2), y: Math.round(base.y - SIGNPOST_H - BOARD_SIZE), w: BOARD_SIZE, h: BOARD_SIZE };
}

/** The top of the signpost (world px): where the floats and the prompt rise from. */
export function signpostTopY(plot: LayoutPlot): number {
  return signpostBoard(plot).y;
}

/** Whether a world px point is on the signpost (its board or its post): the signpost's tooltip. */
export function onSignpost(plot: LayoutPlot, x: number, y: number): boolean {
  const board = signpostBoard(plot);
  const base = signpostBase(plot);
  const inBoard = x >= board.x && x < board.x + board.w && y >= board.y && y < board.y + board.h;
  const inPost = Math.abs(x - base.x) <= SIGNPOST_W / 2 + 1 && y >= base.y - SIGNPOST_H && y < base.y;
  return inBoard || inPost;
}

/**
 * How many of a sigil's segments the signpost still shows (LORE 2026-10-18: it "loses the line segment by segment
 * as the plot fades"): all while the plot's line is lit; while it is dark, the share of the dark stretch still to
 * run, from the moment the Writ went dark to the line's fade, rounded up to whole segments; none once faded.
 */
export function sigilSegmentsLeft(
  segments: number,
  line: { state: 'lit' | 'dark' | 'faded'; fadesAt: number } | undefined,
  darkSince: number | null,
  serverMs: number,
): number {
  if (!line || line.state === 'lit') return segments;
  if (line.state === 'faded') return 0;
  const from = darkSince ?? serverMs;
  const span = line.fadesAt - from;
  if (span <= 0) return 0;
  const left = Math.max(0, Math.min(1, (line.fadesAt - serverMs) / span));
  return Math.ceil(segments * left);
}

/** The plot whose rectangle holds a world px point, if any (the seal's hover tooltip). */
export function plotAtWorld(x: number, y: number, layout: HoldingLayout = holdingLayout()): LayoutPlot | undefined {
  return layout.plots.find((p) => {
    const r = plotWorldRect(p);
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  });
}
