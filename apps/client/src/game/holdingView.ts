import {
  holdingLayout,
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
} from '@iot/shared';
import { displayable } from './drawable.js';
import { packUsed } from './inventoryView.js';

/**
 * The holding scene's logic (docs/design/holding.md), pure so it is tested
 * in node: the server clock offset and the cycle ring drawn from it, the
 * cycles the client predicts for the "+1" floaters, the active-action chip's
 * state, the XP bar, the station panel's lines, the take-all result line,
 * the nearest station to prompt for and the pack button's fill. The scene
 * (scenes/HoldingScene.ts) draws these and sends the requests; the counts
 * only ever come from the server.
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
  /** "You: 1 log every 4 s" while working here, else null. */
  you: string | null;
  /** "Woodcutting 2 · 1099 XP to next". */
  skill: string;
  /** The first button: WORK HERE, or STOP while working here. */
  work: 'WORK HERE' | 'STOP';
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
  const short = action.itemId.split('-').pop() ?? action.itemId;
  return {
    title: displayable(station.name.toUpperCase()),
    rate: `${countOf(action.itemId, action.quantity)} every ${seconds} s`,
    basket: basket.length ? `Basket: ${basket.map((e) => countOf(e.itemId, e.quantity)).join(', ')}` : 'Basket: empty',
    you: working ? `You: ${action.quantity} ${short}${action.quantity === 1 ? '' : 's'} every ${seconds} s` : null,
    skill: view ? `${SKILL_NAMES[action.skill]} ${view.level} · ${view.toNext} XP to next` : SKILL_NAMES[action.skill],
    work: working ? 'STOP' : 'WORK HERE',
    take: 'TAKE ALL',
    working,
  };
}

/** The plural display name of an item, lowercase: "twisted logs". */
export function pluralName(itemId: string): string {
  return `${displayable((itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase())}s`;
}

/**
 * The one-line result after a take-all (GAME DESIGN 2026-10-17): "Store:
 * twisted logs full." when something stayed because the store's stack is
 * full; otherwise what was taken, or "Nothing to take." for an empty basket.
 */
export function takeResultLine(take: HoldingTake): string {
  const stuck = take.left[0];
  if (stuck) return `Store: ${pluralName(stuck.itemId)} full.`;
  if (take.moved.length === 0) return 'Nothing to take.';
  return `Took ${take.moved.map((e) => countOf(e.itemId, e.quantity)).join(', ')}.`;
}

/** A station's interact point as sim px (the tile's centre). */
export function interactPoint(station: LayoutStation): { x: number; y: number } {
  return {
    x: (station.interact.col + 0.5) * TILE_SIZE_PX,
    y: (station.interact.row + 0.5) * TILE_SIZE_PX,
  };
}

/**
 * The station to prompt for: the one whose interact point is nearest the
 * Kindled (sim px) within `rangePx`, or null. The prompt's existing rules:
 * the nearest in reach, nothing when none is.
 */
export function nearestStation(
  x: number,
  y: number,
  rangePx: number,
  layout: HoldingLayout = holdingLayout(),
): LayoutStation | null {
  let best: { station: LayoutStation; d: number } | null = null;
  for (const station of layout.stations) {
    const p = interactPoint(station);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= rangePx && (!best || d < best.d)) best = { station, d };
  }
  return best ? best.station : null;
}

/** Where a station's prop stands: the bottom centre of its tile rectangle, sim px (the sprite's origin, the line under its base). */
export function propBase(station: LayoutStation): { x: number; y: number } {
  return {
    x: (station.rect.col + station.rect.cols / 2) * TILE_SIZE_PX,
    y: (station.rect.row + station.rect.rows) * TILE_SIZE_PX,
  };
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
