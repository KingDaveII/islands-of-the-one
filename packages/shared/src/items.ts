import itemsJson from '../data/items.json' with { type: 'json' };
import tellingJson from '../data/telling.json' with { type: 'json' };
import { isDrawable } from './accounts.js';

/**
 * Items and the inventory ledger's shared vocabulary (docs/design/inventory.md):
 * the item list from data/items.json (validated on load), the closed set of
 * reasons a change can give, and the current Telling every ledger row is
 * stamped with. The server is the only authority over who holds what.
 */

export const ITEM_KINDS = ['currency', 'sparkglass', 'material', 'consumable', 'lore'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** The gathering skills an item's tooltip can name on its kind line ("Material · Mining"); 3b gives them rules. */
export const ITEM_SKILLS = ['woodcutting', 'mining', 'farming'] as const;
export type ItemSkill = (typeof ITEM_SKILLS)[number];

/** The display name of a skill. */
export const SKILL_NAMES: Readonly<Record<ItemSkill, string>> = {
  woodcutting: 'Woodcutting',
  mining: 'Mining',
  farming: 'Farming',
};

export interface ItemDef {
  /** kebab-case, glossary terms only; stored in the ledger, so never renamed once shipped. */
  id: string;
  /** Display name. */
  name: string;
  kind: ItemKind;
  /** The most of the item one place holds; null = unlimited. The pack and the store have their own limits (places.ts). */
  stackLimit: number | null;
  /** Card text (LORE's; may be empty until written). */
  description: string;
  /** The gathering skill the tooltip's kind line names, or null. */
  skill: ItemSkill | null;
}

/** The largest balance or delta the ledger stores (quantities are bigint, read as JS numbers). */
export const MAX_QUANTITY = Number.MAX_SAFE_INTEGER;

/**
 * Words the glossary retires (docs/design/glossary.md, "Retired terms"): no
 * item id or name may use them. "shard" is there because a Shard is always an
 * island, never a piece of something.
 */
export const RETIRED_WORDS = ['void', 'island', 'tether', 'crystal', 'fishing', 'shard'] as const;

const ITEM_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ITEM_KEYS = ['id', 'name', 'kind', 'stackLimit', 'description', 'skill'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const usesRetiredWord = (text: string): string | undefined => {
  const words = text.toLowerCase().split(/[^a-z]+/);
  return RETIRED_WORDS.find((w) => words.includes(w));
};

/** Check items.json-shaped data; every problem is listed, not just the first. */
export function validateItemsData(
  data: unknown,
): { ok: true; items: ItemDef[] } | { ok: false; problems: string[] } {
  if (!isObject(data) || !Array.isArray(data.items))
    return { ok: false, problems: ['expected { items: [...] }'] };
  const problems: string[] = [];
  const items: ItemDef[] = [];
  const seen = new Set<string>();
  data.items.forEach((entry: unknown, i) => {
    const at = `items[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const { id, name, kind, stackLimit, description, skill } = entry;
    const extra = Object.keys(entry).filter((k) => !ITEM_KEYS.includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    if (typeof id !== 'string' || !ITEM_ID.test(id)) {
      problems.push(`${at}: id must be kebab-case`);
      return;
    }
    const where = `${at} (${id})`;
    if (seen.has(id)) problems.push(`${where}: duplicate id`);
    seen.add(id);
    if (typeof name !== 'string' || name.trim() === '' || !isDrawable(name))
      problems.push(`${where}: name must be non-empty text the game can draw`);
    for (const text of [id, typeof name === 'string' ? name : '']) {
      const retired = usesRetiredWord(text);
      if (retired) problems.push(`${where}: "${text}" uses the retired word "${retired}"`);
    }
    if (typeof kind !== 'string' || !(ITEM_KINDS as readonly string[]).includes(kind))
      problems.push(`${where}: kind must be one of ${ITEM_KINDS.join(', ')}`);
    const limitOk =
      stackLimit === 'unlimited' ||
      (typeof stackLimit === 'number' &&
        Number.isSafeInteger(stackLimit) &&
        stackLimit > 0 &&
        stackLimit <= MAX_QUANTITY);
    if (!limitOk) problems.push(`${where}: stackLimit must be a positive integer or "unlimited"`);
    if (typeof description !== 'string' || !isDrawable(description))
      problems.push(`${where}: description must be text the game can draw (may be empty)`);
    if (skill !== undefined && !(ITEM_SKILLS as readonly string[]).includes(skill as string))
      problems.push(`${where}: skill must be one of ${ITEM_SKILLS.join(', ')} (or left out)`);
    if (problems.length > 0) return;
    items.push({
      id,
      name: name as string,
      kind: kind as ItemKind,
      stackLimit: stackLimit === 'unlimited' ? null : (stackLimit as number),
      description: description as string,
      skill: skill === undefined ? null : (skill as ItemSkill),
    });
  });
  return problems.length > 0 ? { ok: false, problems } : { ok: true, items };
}

function loadItems(): readonly ItemDef[] {
  const result = validateItemsData(itemsJson);
  if (!result.ok) throw new Error(`data/items.json:\n${result.problems.join('\n')}`);
  return result.items;
}

/** Every item, in display order. */
export const ITEMS: readonly ItemDef[] = loadItems();

const BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((item) => [item.id, item]));

export function isItemId(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value);
}

export function itemDef(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

/** The item's place in display order (unknown ids last). */
export function itemOrder(id: string): number {
  const i = ITEMS.findIndex((item) => item.id === id);
  return i < 0 ? ITEMS.length : i;
}

/** Why an item or currency changed hands; every ledger row names one. */
export const InventoryReason = {
  Grant: 'grant',
  Gather: 'gather',
  Harvest: 'harvest',
  FeedWrit: 'feed-writ',
  Craft: 'craft',
  Trade: 'trade',
  Admin: 'admin',
  /** Between two of one Kindled's places: one set with -n from one and +n to the other. */
  Move: 'move',
} as const;
export type InventoryReason = (typeof InventoryReason)[keyof typeof InventoryReason];

const REASONS = new Set<string>(Object.values(InventoryReason));

export function isInventoryReason(value: unknown): value is InventoryReason {
  return typeof value === 'string' && REASONS.has(value);
}

/** The Telling now running (data/telling.json); stamped on every ledger row. */
export const CURRENT_TELLING: string = tellingJson.current;
