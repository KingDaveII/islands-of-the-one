import {
  holdingLayout,
  isShoreGround,
  itemDef,
  PACK_SLOTS,
  PLOT_TEXT,
  plotKindDef,
  plotLevel,
  SKILL_NAMES,
  stationDef,
  TILE_SIZE_PX,
  type HoldingActivity,
  type HoldingLayout,
  type HoldingResponse,
  type HoldingTake,
  type InventoryResponse,
  type LayoutPlot,
  type LayoutStation,
  type SkillView,
  type SpriteSheet,
  type StationAction,
  type StationCycle,
  type StationPart,
  type TileRect,
  type TileTemplate,
} from '@iot/shared';
import { displayable } from './drawable.js';
import { packUsed } from './inventoryView.js';
import { bonusLine, cycleRateLine, nextInLine, plotOf, sentenceLetters } from './plotView.js';

/**
 * The holding scene's logic (docs/design/holding.md), pure so it is tested
 * in node: the server clock offset and the cycle ring drawn from it, the
 * cycles the client predicts for the "+1" floaters, the active-action chip's
 * state, the XP bar, the station panel's lines, the take-all float and its
 * one panel line, the nearest station part to prompt for and the pack
 * button's fill. The scene (scenes/HoldingScene.ts) draws these and sends
 * the requests; the counts only ever come from the server.
 */

/** The server's clock against the client's: `serverNow − clientNow` at the moment the answer arrived. */
export function clockOffset(serverNowIso: string, clientNowMs: number): number {
  const t = Date.parse(serverNowIso);
  return Number.isNaN(t) ? 0 : t - clientNowMs;
}

/** The server's time now, from the client clock and the offset. */
export function serverTime(offsetMs: number, clientNowMs: number): number {
  return clientNowMs + offsetMs;
}

/** Whole cycles the activity has completed by the server time `serverMs` (never negative). */
export function cyclesDone(activity: HoldingActivity, serverMs: number): number {
  const started = Date.parse(activity.startedAt);
  if (Number.isNaN(started) || activity.cycleMs <= 0) return 0;
  return Math.max(0, Math.floor((serverMs - started) / activity.cycleMs));
}

/** How far the current cycle has run at the server time, 0 (just started) to under 1 (about to complete). */
export function cycleProgress(activity: HoldingActivity, serverMs: number): number {
  const started = Date.parse(activity.startedAt);
  if (Number.isNaN(started) || activity.cycleMs <= 0) return 0;
  const into = (((serverMs - started) % activity.cycleMs) + activity.cycleMs) % activity.cycleMs;
  return into / activity.cycleMs;
}

/** The share of the level done: XP into it over the level's whole span. */
export function xpFraction(view: SkillView): number {
  const span = view.into + view.toNext;
  return span > 0 ? view.into / span : 0;
}

/** The icon placeholder for a station until ART draws icons: its name's initials ("Twisted trees" → "TT"; a field "F"). */
export function stationInitials(stationId: string, r: Pick<HoldingResponse, 'plots'> | null = null): string {
  const name = workplaceDef(stationId, r)?.name ?? stationId.replaceAll('-', ' ');
  return displayable(
    name
      .split(/[\s-]+/)
      .filter((w) => w !== '')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2),
  );
}

/** What the active-action chip shows: nothing while idle. */
export interface ChipState {
  stationId: string;
  /** The station's placeholder icon. */
  initials: string;
  /** "WOODCUTTING 2". */
  skill: string;
  /** The cycle ring, 0..1. */
  ring: number;
  /** The thin XP bar to the next level, 0..1. */
  xp: number;
}

/** What a station id names in an answer: a station's definition, or a named plot's kind (null for an unnamed plot or an unknown id). */
export function workplaceDef(
  stationId: string,
  r: Pick<HoldingResponse, 'plots'> | null,
): { name: string; action: StationAction | null; cycle: StationCycle | null; plot: ReturnType<typeof plotOf> } | null {
  const station = stationDef(stationId);
  if (station) return { name: station.name, action: station.action, cycle: station.cycle, plot: undefined };
  const plot = plotOf(r, stationId);
  const kind = plot?.kind === null || plot?.kind === undefined ? undefined : plotKindDef(plot.kind);
  if (!plot || !kind) return null;
  return { name: kind.name, action: kind.action, cycle: kind.cycle, plot };
}

export function chipState(r: HoldingResponse | null, serverMs: number): ChipState | null {
  const activity = r?.activity;
  if (!r || !activity) return null;
  const action = workplaceDef(activity.stationId, r)?.action;
  if (!action) return null;
  const view = r.skills[action.skill];
  return {
    stationId: activity.stationId,
    initials: stationInitials(activity.stationId, r),
    skill: `${SKILL_NAMES[action.skill].toUpperCase()} ${view.level}`,
    ring: cycleProgress(activity, serverMs),
    xp: xpFraction(view),
  };
}

/** An item's name in a count: "1 twisted log", "3 twisted logs". */
export function countOf(itemId: string, quantity: number): string {
  const name = displayable((itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase());
  return `${quantity} ${name}${quantity === 1 ? '' : 's'}`;
}

/** The station panel's buttons, in order. */
export type StationButton = 'work' | 'take' | 'rename' | 'sow';

/**
 * The lines of the station panel (GAME DESIGN's screen, M2 Task 5 for the
 * plots). The post has none: Use opens the inventory with the store. A field
 * not sown yet shows only "Not sown yet." and SOW; a faded plot its faded
 * line and no buttons.
 */
export interface StationLines {
  title: string;
  /** A plot's sentence under its title (the letter sheet draws it), else null. */
  letters: string | null;
  /** "Level 1" for a plot, else null. */
  level: string | null;
  /**
   * "By hand: 1 twisted log every 4 s", what working it gives; null while working here (the line becomes `you`, so
   * there are never three rate lines) and while a field isn't sown (GAME DESIGN 2026-10-18).
   */
  rate: string | null;
  /** "By itself: 1 twisted log every 20 min", the basket cycle; null for a station without one (the outcrop) or not sown. */
  cycle: string | null;
  /** ישן's "+3% for keeping its name" under the cycle's rate, or null. */
  bonus: string | null;
  /** "Basket: 3 twisted logs", or "Basket: empty"; null while a field isn't sown. */
  basket: string | null;
  /** "Next in 12 min", or "Resting while your Writ is dark."; null without a cycle, faded or not sown. */
  next: string | null;
  /** "You: 1 twisted log every 4 s" while working here, in place of the By hand line, highlighted (the item's full name, GAME DESIGN 2026-10-18), else null. */
  you: string | null;
  /** "Woodcutting 2 · 1099 XP to next"; null while a field isn't sown. */
  skill: string | null;
  /** "Not sown yet.", or the faded line; null otherwise. */
  note: string | null;
  /** The first button: WORK HERE, or STOP WORKING while working here. */
  work: 'WORK HERE' | 'STOP WORKING';
  take: 'TAKE ALL';
  /** Whether the Kindled works here now. */
  working: boolean;
  /** The buttons shown, in order: work, take (and rename for a plot); sow alone for a field not sown; none when faded. */
  buttons: StationButton[];
}

/** The station panel's two rate labels (GAME DESIGN 2026-10-18): the cycle, and what working it gives. */
export const BY_ITSELF = 'By itself: ';
export const BY_HAND = 'By hand: ';

export function stationLines(stationId: string, r: HoldingResponse | null, serverMs: number = r ? Date.parse(r.now) : 0): StationLines | null {
  const place = workplaceDef(stationId, r);
  const action = place?.action;
  if (!place || !action) return null;
  const plot = place.plot;
  const basket = r?.baskets[stationId] ?? [];
  const working = r?.activity?.stationId === stationId;
  const view = r?.skills[action.skill];
  const rate = `${countOf(action.itemId, action.quantity)} every ${action.cycleMs / 1000} s`;
  const title = displayable(place.name.toUpperCase());
  const letters = plot ? sentenceLetters(plot.ground, plot.virtue) : null;
  const level = plot ? `${PLOT_TEXT.LEVEL}${plotLevel()}` : null;
  const basketLine = basket.length ? `Basket: ${basket.map((e) => countOf(e.itemId, e.quantity)).join(', ')}` : 'Basket: empty';
  const skill = view ? `${SKILL_NAMES[action.skill]} ${view.level} · ${view.toNext} XP to next` : SKILL_NAMES[action.skill];
  const base = { title, letters, level, work: working ? 'STOP WORKING' : 'WORK HERE', take: 'TAKE ALL', working } as const;
  const empty = { rate: null, cycle: null, bonus: null, basket: null, next: null, you: null, skill: null };
  // A faded plot: frozen with its basket, the one line, no buttons.
  if (plot?.state === 'faded') return { ...base, ...empty, basket: basketLine, note: PLOT_TEXT.FADED_PANEL, buttons: [] };
  // A field not sown yet: only the note and SOW (GAME DESIGN).
  const kind = plot?.kind === null || plot?.kind === undefined ? undefined : plotKindDef(plot.kind);
  if (plot && kind?.sow && plot.sownAt === null) return { ...base, ...empty, note: PLOT_TEXT.NOT_SOWN, buttons: ['sow'] };
  const clock = r?.cycles[stationId];
  const dark = r !== null && r.writ.chargeMs === 0;
  const next = place.cycle && clock ? (dark ? PLOT_TEXT.RESTING : nextInLine(clock, serverMs)) : null;
  return {
    ...base,
    rate: working ? null : `${BY_HAND}${rate}`,
    cycle: place.cycle ? `${BY_ITSELF}${cycleRateLine(place.cycle)}` : null,
    bonus: plot && clock ? bonusLine(clock.bonusPermille) : null,
    basket: basketLine,
    next,
    you: working ? `You: ${rate}` : null,
    skill,
    note: null,
    buttons: plot ? ['work', 'take', 'rename'] : ['work', 'take'],
  };
}

/** The plural display name of an item, lowercase: "twisted logs". */
export function pluralName(itemId: string): string {
  return `${displayable((itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase())}s`;
}

/**
 * The one panel line after a take-all (GAME DESIGN 2026-10-17, 2026-10-18):
 * "Store: twisted logs full." when something stayed because the store's
 * stack is full (the one line until toasts arrive in Task 7); otherwise
 * none: what was taken floats over the station (`takeFloat`), and an empty
 * basket's panel already reads "Basket: empty".
 */
export function takeResultLine(take: HoldingTake): string | null {
  const stuck = take.left[0];
  return stuck ? `Store: ${pluralName(stuck.itemId)} full.` : null;
}

/** What floats over the station after a take-all, the same float the cycles use: "+3" for what moved, null when nothing did. */
export function takeFloat(take: HoldingTake): string | null {
  const moved = take.moved.reduce((s, e) => s + e.quantity, 0);
  return moved > 0 ? `+${moved}` : null;
}

/** A station part's interact point as sim px (the tile's centre). */
export function interactPoint(part: StationPart): { x: number; y: number } {
  return {
    x: (part.interact.col + 0.5) * TILE_SIZE_PX,
    y: (part.interact.row + 0.5) * TILE_SIZE_PX,
  };
}

/**
 * A station and the part of it nearest the Kindled: any part's interact point
 * works the station (the trees); or a plot (M2 Task 5) and its station, once
 * the island has a Name. `id` is what a request names.
 */
export interface NearStation {
  id: string;
  station: LayoutStation | null;
  plot: LayoutPlot | null;
  part: StationPart;
}

/**
 * The station part to prompt for: the one whose interact point is nearest
 * the Kindled (sim px) within `rangePx`, or null. The prompt's existing
 * rules: the nearest in reach, nothing when none is. A reserved spot (the
 * weapon rack until Task 8) offers no Use; the plots offer theirs only once
 * the island has a Name (`plots`).
 */
export function nearestStationPart(
  x: number,
  y: number,
  rangePx: number,
  layout: HoldingLayout = holdingLayout(),
  plots = false,
): NearStation | null {
  const found: { best: { near: NearStation; d: number } | null } = { best: null };
  const consider = (near: NearStation): void => {
    const p = interactPoint(near.part);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= rangePx && (!found.best || d < found.best.d)) found.best = { near, d };
  };
  for (const station of layout.stations) {
    if (station.reserved) continue;
    for (const part of station.parts) consider({ id: station.id, station, plot: null, part });
  }
  if (plots) for (const plot of layout.plots) consider({ id: plot.id, station: null, plot, part: plot.station });
  return found.best ? found.best.near : null;
}

/** The station to prompt for (`nearestStationPart`'s station), or null (a plot counts as none here). */
export function nearestStation(x: number, y: number, rangePx: number, layout: HoldingLayout = holdingLayout()): LayoutStation | null {
  return nearestStationPart(x, y, rangePx, layout)?.station ?? null;
}

/** The part of a station whose prop stands nearest a point (sim px): where its floats rise from; the first part when it has one. */
export function nearestPart(station: LayoutStation, x: number, y: number): StationPart | null {
  let best: { part: StationPart; d: number } | null = null;
  for (const part of station.parts) {
    const b = propBase(part);
    const d = Math.hypot(b.x - x, b.y - y);
    if (!best || d < best.d) best = { part, d };
  }
  return best ? best.part : null;
}

/** Where a prop stands: the bottom centre of its tile rectangle, sim px (the sprite's origin, the line under its base). */
export function propBase(part: Pick<StationPart, 'rect'>): { x: number; y: number } {
  return {
    x: (part.rect.col + part.rect.cols / 2) * TILE_SIZE_PX,
    y: (part.rect.row + part.rect.rows) * TILE_SIZE_PX,
  };
}

/**
 * Whether a prop stands on the island: some cell of its bottom row is shore
 * ground. A prop in the void (Kesh's rock) has nothing under it to shade, so
 * it draws no grounding shadow.
 */
export function standsOnGround(template: TileTemplate, rect: TileRect): boolean {
  const row = rect.row + rect.rows - 1;
  for (let c = rect.col; c < rect.col + rect.cols; c++) if (isShoreGround(template, c, row)) return true;
  return false;
}

/** Whether a prop's sheet plays its `idle` (more than one frame, like the Writ post's pulse) rather than holding `idle_0`. */
export function propIdlePlays(sheet: Pick<SpriteSheet, 'anims'>): boolean {
  return (sheet.anims.idle?.frames.length ?? 0) > 1;
}

/** The pack button's fill: "12/20". */
export function packFill(inventory: InventoryResponse | null): string {
  return `${inventory ? packUsed(inventory) : 0}/${PACK_SLOTS}`;
}

/** The purse's gin. */
export function purseGin(inventory: InventoryResponse | null): number {
  return inventory?.purse.find((e) => e.itemId === 'sealed-gin')?.quantity ?? 0;
}

/** The word next to the interact glyph over a station. */
export const USE_LABEL = 'USE';

/** The Talk spot's centre (sim px): where Talk across the water stands. */
export function talkSpot(layout: HoldingLayout = holdingLayout()): { x: number; y: number } {
  return { x: (layout.kesh.talk.col + 0.5) * TILE_SIZE_PX, y: (layout.kesh.talk.row + 0.5) * TILE_SIZE_PX };
}

/**
 * Whether the Kindled (sim px) is within reach of Kesh's Talk spot, the same
 * reach the stations use (M2 Task 4b): the prompt shows TALK and Use opens
 * the talk box. A station part nearer than the spot keeps its prompt.
 */
export function nearKesh(x: number, y: number, rangePx: number, layout: HoldingLayout = holdingLayout()): boolean {
  const spot = talkSpot(layout);
  const d = Math.hypot(spot.x - x, spot.y - y);
  if (d > rangePx) return false;
  const station = nearestStationPart(x, y, rangePx, layout);
  if (!station) return true;
  const p = interactPoint(station.part);
  return d <= Math.hypot(p.x - x, p.y - y);
}

/** A rectangle in UI px. */
export interface UiRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The holding HUD's spacing (render/holdingHud.ts draws by these): the inset from the view's edge, the panels' padding, the action chip. */
export const HUD_INSET = 8;
export const HUD_PAD = 4;
export const HUD_CHIP_W = 122;
export const HUD_CHIP_H = 26;

/** The measured widths (UI px) of the HUD's texts: the purse's number, the pack's label, and the Writ block's Name, letters and chip words. */
export interface HudWidths {
  gin: number;
  pack: number;
  /** Null before the island is named. */
  name: number | null;
  letters: number;
  chip: number;
}

/** The HUD's four panels' rectangles for a view frame (UI px): the Writ block, the purse, the action chip and the pack button. Pure. */
export function hudRects(frame: UiRect, widths: HudWidths): { writ: UiRect; purse: UiRect; chip: UiRect; pack: UiRect } {
  const L = frame.x;
  const T = frame.y;
  const R = frame.x + frame.w;
  const B = frame.y + frame.h;
  const purseW = HUD_PAD + 10 + 3 + Math.max(widths.gin, 8) + HUD_PAD;
  const purseH = HUD_PAD + 10 + HUD_PAD;
  const writW = HUD_PAD + Math.max(widths.name ?? 0, widths.letters, widths.chip, 24) + HUD_PAD;
  const writH = HUD_PAD + (widths.name !== null ? 10 + 8 + 3 : 0) + 8 + HUD_PAD;
  const packW = HUD_PAD + widths.pack + HUD_PAD;
  const packH = HUD_PAD + 8 + HUD_PAD;
  const cx = Math.round(L + frame.w / 2);
  return {
    writ: { x: L + HUD_INSET, y: T + HUD_INSET, w: writW, h: writH },
    purse: { x: R - HUD_INSET - purseW, y: T + HUD_INSET, w: purseW, h: purseH },
    chip: { x: cx - HUD_CHIP_W / 2, y: B - HUD_INSET - HUD_CHIP_H, w: HUD_CHIP_W, h: HUD_CHIP_H },
    pack: { x: R - HUD_INSET - packW, y: B - HUD_INSET - packH, w: packW, h: packH },
  };
}

/** Whether two rectangles overlap (touching edges don't count). */
export function rectsOverlap(a: UiRect, b: UiRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The HUD panels by name (`hudRects`'s keys). */
export type HudPanel = 'writ' | 'purse' | 'chip' | 'pack';

/**
 * The HUD panels a body is behind (readability.md "The HUD never hides the
 * room", ART on #95): the Kindled's and Kesh's rectangles on the UI grid
 * against the panels drawn last frame. Props alone never count, Kesh's rock
 * included. An empty rectangle (a panel not drawn) never does.
 */
export function panelsBehind(rects: Readonly<Record<HudPanel, UiRect>>, bodies: readonly UiRect[]): HudPanel[] {
  return (Object.keys(rects) as HudPanel[]).filter((k) => {
    const r = rects[k];
    return r.w > 0 && r.h > 0 && bodies.some((b) => rectsOverlap(b, r));
  });
}

/** The opaque bounds of one frame of a sheet's pixels (RGBA, row-major), relative to the frame's top left; null when it has none. */
export function opaqueBoundsIn(
  img: { width: number; data: ArrayLike<number> },
  frame: { x: number; y: number; w: number; h: number },
): UiRect | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < frame.h; y++)
    for (let x = 0; x < frame.w; x++) {
      if ((img.data[((frame.y + y) * img.width + frame.x + x) * 4 + 3] ?? 0) === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The glyph indices of a line's stage directions as a wrapped BitmapText draws
 * them: Phaser numbers drawn glyphs, and a wrap turns a space into a line
 * break that isn't drawn, so every wrap before a character shifts its glyph
 * index down by one. `wrapped` is the text as wrapped (the same length as
 * `text`, `getTextBounds().wrappedText`).
 */
export function directionGlyphs(text: string, wrapped: string): number[] {
  const out: number[] = [];
  let breaks = 0;
  let at = 0;
  const inDirection = new Array<boolean>(text.length).fill(false);
  for (const part of lineParts(text)) {
    if (part.direction) for (let k = at; k < at + part.text.length; k++) inDirection[k] = true;
    at += part.text.length;
  }
  for (let k = 0; k < wrapped.length; k++) {
    if (wrapped[k] === '\n') {
      breaks++;
      continue;
    }
    if (inDirection[k]) out.push(k - breaks);
  }
  return out;
}

/**
 * A talk line's parts (ART on #95): stage directions in brackets, "(flicks the
 * sliver across the water)", drawn muted, and what is said, drawn in the
 * speaker's ink. Brackets stay with their direction.
 */
export function lineParts(text: string): { text: string; direction: boolean }[] {
  const parts: { text: string; direction: boolean }[] = [];
  const re = /\([^()]*\)/g;
  let at = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), direction: false });
    parts.push({ text: m[0], direction: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), direction: false });
  return parts;
}
