import {
  holdingLayout,
  isShoreGround,
  itemDef,
  PACK_SLOTS,
  SKILL_NAMES,
  stationDef,
  TILE_SIZE_PX,
  type HoldingActivity,
  type HoldingLayout,
  type HoldingResponse,
  type HoldingTake,
  type InventoryResponse,
  type LayoutStation,
  type SkillView,
  type SpriteSheet,
  type StationPart,
  type TileRect,
  type TileTemplate,
} from '@iot/shared';
import { displayable } from './drawable.js';
import { packUsed } from './inventoryView.js';

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

/** The icon placeholder for a station until ART draws icons: its name's initials ("Twisted trees" → "TT"). */
export function stationInitials(stationId: string): string {
  const name = stationDef(stationId)?.name ?? stationId.replaceAll('-', ' ');
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

export function chipState(r: HoldingResponse | null, serverMs: number): ChipState | null {
  const activity = r?.activity;
  if (!r || !activity) return null;
  const action = stationDef(activity.stationId)?.action;
  if (!action) return null;
  const view = r.skills[action.skill];
  return {
    stationId: activity.stationId,
    initials: stationInitials(activity.stationId),
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

/** The lines of the station panel. The post has none: Use opens the inventory with the store. */
export interface StationLines {
  title: string;
  /** "1 twisted log every 4 s". */
  rate: string;
  /** "Basket: 3 twisted logs", or "Basket: empty". */
  basket: string;
  /** "You: 1 twisted log every 4 s" while working here (the item's full name, GAME DESIGN 2026-10-18), else null. */
  you: string | null;
  /** "Woodcutting 2 · 1099 XP to next". */
  skill: string;
  /** The first button: WORK HERE, or STOP WORKING while working here. */
  work: 'WORK HERE' | 'STOP WORKING';
  take: 'TAKE ALL';
  /** Whether the Kindled works here now. */
  working: boolean;
}

export function stationLines(stationId: string, r: HoldingResponse | null): StationLines | null {
  const station = stationDef(stationId);
  const action = station?.action;
  if (!station || !action) return null;
  const seconds = action.cycleMs / 1000;
  const basket = r?.baskets[stationId] ?? [];
  const working = r?.activity?.stationId === stationId;
  const view = r?.skills[action.skill];
  const rate = `${countOf(action.itemId, action.quantity)} every ${seconds} s`;
  return {
    title: displayable(station.name.toUpperCase()),
    rate,
    basket: basket.length ? `Basket: ${basket.map((e) => countOf(e.itemId, e.quantity)).join(', ')}` : 'Basket: empty',
    you: working ? `You: ${rate}` : null,
    skill: view ? `${SKILL_NAMES[action.skill]} ${view.level} · ${view.toNext} XP to next` : SKILL_NAMES[action.skill],
    work: working ? 'STOP WORKING' : 'WORK HERE',
    take: 'TAKE ALL',
    working,
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

/** A station and the part of it nearest the Kindled: any part's interact point works the station (the trees). */
export interface NearStation {
  station: LayoutStation;
  part: StationPart;
}

/**
 * The station part to prompt for: the one whose interact point is nearest
 * the Kindled (sim px) within `rangePx`, or null. The prompt's existing
 * rules: the nearest in reach, nothing when none is. A reserved spot (the
 * weapon rack until Task 8) offers no Use.
 */
export function nearestStationPart(
  x: number,
  y: number,
  rangePx: number,
  layout: HoldingLayout = holdingLayout(),
): NearStation | null {
  let best: { near: NearStation; d: number } | null = null;
  for (const station of layout.stations) {
    if (station.reserved) continue;
    for (const part of station.parts) {
      const p = interactPoint(part);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= rangePx && (!best || d < best.d)) best = { near: { station, part }, d };
    }
  }
  return best ? best.near : null;
}

/** The station to prompt for (`nearestStationPart`'s station), or null. */
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
