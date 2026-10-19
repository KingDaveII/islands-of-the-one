import inventoryJson from '../data/inventory.json' with { type: 'json' };
import { itemDef, ITEM_KINDS, MAX_QUANTITY, type ItemKind } from './items.js';

/**
 * Where a Kindled's items are (docs/design/inventory.md): the purse (gin,
 * never lost), the pack (what goes abroad, 20 slots), the holding store (one
 * stack per item, up to the store limit) and a basket per station (what it
 * makes, until the Kindled takes it to the store). The numbers come from
 * data/inventory.json, validated on load like items.json. Pack slots are
 * derived from the counts, never stored, so both sides draw the same grid.
 */

/** The four fixed places (the rack holds weapons and nothing else, M2 Task 8); baskets are `basket:<stationId>`. */
export const FIXED_PLACES = ['purse', 'pack', 'store', 'rack'] as const;
export type FixedPlace = (typeof FIXED_PLACES)[number];
export type BasketPlace = `basket:${string}`;
export type Place = FixedPlace | BasketPlace;

export const BASKET_PREFIX = 'basket:';
/** Longest place string (`basket:` and a station id). */
export const MAX_PLACE_LENGTH = 48;
const STATION_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Shape of data/inventory.json. */
export interface InventoryData {
  packSlots: number;
  /** How many of a kind fill one pack slot, for every kind but currency (the purse) and weapons (the rack). */
  slotSize: Readonly<Record<Exclude<ItemKind, 'currency' | 'weapon'>, number>>;
  /** The most of one item the store keeps, by kind; a kind left out has no store limit of its own. */
  storeLimit: Readonly<Partial<Record<ItemKind, number>>>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_QUANTITY;

/** Check inventory.json-shaped data; every problem is listed, not just the first. */
export function validateInventoryData(
  data: unknown,
): { ok: true; data: InventoryData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter(
    (k) => !['$comment', 'packSlots', 'slotSize', 'storeLimit'].includes(k),
  );
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (!isCount(data.packSlots)) problems.push('packSlots must be a positive integer');
  const slotSize = data.slotSize;
  if (!isObject(slotSize)) problems.push('slotSize must be an object of counts by kind');
  else {
    for (const kind of ITEM_KINDS) {
      if (kind === 'currency' || kind === 'weapon') {
        if (kind in slotSize)
          problems.push(`slotSize: ${kind} takes no slot (it lives in the ${kind === 'currency' ? 'purse' : 'rack'})`);
      } else if (!isCount(slotSize[kind]))
        problems.push(`slotSize.${kind} must be a positive integer`);
    }
    for (const k of Object.keys(slotSize))
      if (!(ITEM_KINDS as readonly string[]).includes(k))
        problems.push(`slotSize: unknown kind ${k}`);
  }
  const storeLimit = data.storeLimit;
  if (!isObject(storeLimit)) problems.push('storeLimit must be an object of counts by kind');
  else {
    for (const [k, v] of Object.entries(storeLimit)) {
      if (!(ITEM_KINDS as readonly string[]).includes(k))
        problems.push(`storeLimit: unknown kind ${k}`);
      else if (!isCount(v)) problems.push(`storeLimit.${k} must be a positive integer`);
    }
  }
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    data: {
      packSlots: data.packSlots as number,
      slotSize: slotSize as InventoryData['slotSize'],
      storeLimit: storeLimit as InventoryData['storeLimit'],
    },
  };
}

function loadInventoryData(): InventoryData {
  const result = validateInventoryData(inventoryJson);
  if (!result.ok) throw new Error(`data/inventory.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const inventoryData: InventoryData = loadInventoryData();
/** How many slots the pack has. */
export const PACK_SLOTS: number = inventoryData.packSlots;

/** A station id (kebab-case), as used in `basket:<stationId>`. */
export function isStationId(value: unknown): value is string {
  return typeof value === 'string' && STATION_ID.test(value);
}

/** The place guard: `purse`, `pack`, `store` or `basket:<stationId>`. */
export function isPlace(value: unknown): value is Place {
  if (typeof value !== 'string' || value.length > MAX_PLACE_LENGTH) return false;
  if ((FIXED_PLACES as readonly string[]).includes(value)) return true;
  return value.startsWith(BASKET_PREFIX) && isStationId(value.slice(BASKET_PREFIX.length));
}

export function basketPlace(stationId: string): BasketPlace {
  const place = `basket:${stationId}` as const;
  if (!isPlace(place)) throw new Error(`not a station id: ${stationId}`);
  return place;
}

/** The station a basket belongs to, or undefined for the fixed places. */
export function basketStation(place: Place): string | undefined {
  return place.startsWith(BASKET_PREFIX) ? place.slice(BASKET_PREFIX.length) : undefined;
}

/** The place a kind belongs in when nothing says otherwise: currency in the purse, weapons on the rack, the rest in the store. */
export function defaultPlace(kind: ItemKind): FixedPlace {
  return kind === 'currency' ? 'purse' : kind === 'weapon' ? 'rack' : 'store';
}

/**
 * Whether an item of `kind` may be in `place` at all: currency only in the
 * purse, weapons only on the rack (M2 Task 8), and nothing else in either.
 */
export function kindFitsPlace(kind: ItemKind, place: Place): boolean {
  if (kind === 'currency') return place === 'purse';
  if (kind === 'weapon') return place === 'rack';
  return place !== 'purse' && place !== 'rack';
}

/** How many of a kind fill one pack slot (currency and weapons take none: undefined). */
export function slotSizeOf(kind: ItemKind): number | undefined {
  return kind === 'currency' || kind === 'weapon' ? undefined : inventoryData.slotSize[kind];
}

/** The most of one item the store keeps: its kind's store limit, else the item's own stack limit. */
export function storeLimitOf(itemId: string): number {
  const def = itemDef(itemId);
  if (!def) return MAX_QUANTITY;
  return inventoryData.storeLimit[def.kind] ?? def.stackLimit ?? MAX_QUANTITY;
}

/** One count of an item in a place. */
export interface Stack {
  itemId: string;
  quantity: number;
}

/** A pack slot: one item and how many of it are in that slot (at most its slot size). */
export interface PackSlot {
  itemId: string;
  quantity: number;
}

/**
 * The pack slots an item count takes: ceil(quantity / slotSize). An item this
 * build doesn't know (a newer server) takes one slot per stack, so the grid
 * stays drawable; currency takes none.
 */
export function slotsFor(itemId: string, quantity: number): number {
  if (quantity <= 0) return 0;
  const def = itemDef(itemId);
  if (!def) return 1;
  const size = slotSizeOf(def.kind);
  return size === undefined ? 0 : Math.ceil(quantity / size);
}

/** How many of the pack's slots a set of stacks takes in all. */
export function packSlotCount(stacks: readonly Stack[]): number {
  return stacks.reduce((n, s) => n + slotsFor(s.itemId, s.quantity), 0);
}

/**
 * The pack's slots, derived from its stacks: in the stacks' order (the
 * server's, items.json), each item split into full slots and then the
 * remainder, so there is no manual arrangement to persist.
 */
export function packSlots(stacks: readonly Stack[]): PackSlot[] {
  const out: PackSlot[] = [];
  for (const { itemId, quantity } of stacks) {
    if (quantity <= 0) continue;
    const def = itemDef(itemId);
    const size = def ? slotSizeOf(def.kind) : quantity;
    if (size === undefined) continue;
    for (let left = quantity; left > 0; left -= size)
      out.push({ itemId, quantity: Math.min(size, left) });
  }
  return out;
}

/**
 * The moves a Kindled may ask for by the API (docs/design/inventory.md):
 * pack and store both ways, and a basket to the store ("take all"). The
 * purse is never a move target, nothing moves into a basket, and the rack
 * moves nothing either way (a weapon is given, never moved).
 */
export function canMove(from: Place, to: Place): boolean {
  if (from === to) return false;
  if (from === 'pack' && to === 'store') return true;
  if (from === 'store' && to === 'pack') return true;
  return basketStation(from) !== undefined && to === 'store';
}
