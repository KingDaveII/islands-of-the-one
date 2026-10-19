import itemsJson from '../data/items.json' with { type: 'json' };
import tellingJson from '../data/telling.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import { isWeaponId, weaponCanFight } from './weapons.js';

/**
 * Items and the inventory ledger's shared vocabulary (docs/design/inventory.md):
 * the item list from data/items.json (validated on load), the closed set of
 * reasons a change can give, and the current Telling every ledger row is
 * stamped with. The server is the only authority over who holds what.
 */

export const ITEM_KINDS = ['currency', 'sparkglass', 'material', 'consumable', 'lore', 'weapon'] as const;
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
  /** The name in a count past 1, lowercase: "twisted logs", and a mass noun as it is, "black stone" (MAIN 2026-10-19: the plural is data). */
  plural: string;
  kind: ItemKind;
  /** The most of the item one place holds; null = unlimited. The pack and the store have their own limits (places.ts). */
  stackLimit: number | null;
  /** Card text (LORE's; may be empty until written). */
  description: string;
  /** The gathering skill the tooltip's kind line names, or null. */
  skill: ItemSkill | null;
  /**
   * A weapon's moves in input order, as the rack shows them (M2 Task 8; GAME
   * DESIGN): the Hookblade's Arc, Hook-thrust, Haul. Empty on a weapon whose
   * combat hasn't landed (locked in the roster); null on every other kind.
   */
  kit: readonly string[] | null;
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
const ITEM_KEYS = ['id', 'name', 'plural', 'kind', 'stackLimit', 'description', 'skill', 'kit'];

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
    const { id, name, plural, kind, stackLimit, description, skill, kit } = entry;
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
    if (typeof plural !== 'string' || plural.trim() === '' || plural !== plural.toLowerCase() || !isDrawable(plural))
      problems.push(`${where}: plural must be non-empty lowercase text the game can draw`);
    for (const text of [id, typeof name === 'string' ? name : '', typeof plural === 'string' ? plural : '']) {
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
    // A weapon (M2 Task 8): an id the tuning names, one of each on the rack, no skill, and its kit: the moves in
    // input order, non-empty once the sim can run it. Only a weapon carries a kit.
    if (kind === 'weapon') {
      if (!isWeaponId(id)) problems.push(`${where}: a weapon must be in tuning.json's weaponRoster or weapons`);
      if (stackLimit !== 1) problems.push(`${where}: a weapon's stackLimit is 1 (one of each hangs on the rack)`);
      if (skill !== undefined) problems.push(`${where}: a weapon has no skill`);
      const kitOk = Array.isArray(kit) && kit.every((m) => typeof m === 'string' && m.trim() !== '' && isDrawable(m));
      if (!kitOk) problems.push(`${where}: kit must be a list of the weapon's moves, text the game can draw`);
      else if (kit.length === 0 && weaponCanFight(id)) problems.push(`${where}: a weapon that can fight needs its kit`);
    } else if (kit !== undefined) problems.push(`${where}: only a weapon carries a kit`);
    if (problems.length > 0) return;
    items.push({
      id,
      name: name as string,
      plural: plural as string,
      kind: kind as ItemKind,
      stackLimit: stackLimit === 'unlimited' ? null : (stackLimit as number),
      description: description as string,
      skill: skill === undefined ? null : (skill as ItemSkill),
      kit: kind === 'weapon' ? [...(kit as string[])] : null,
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

/** An item's name in a count past 1, lowercase, from items.json's `plural`: "twisted logs", "black stone" (a mass noun). The one place the plural is read. */
export function pluralItemName(itemId: string): string {
  return itemDef(itemId)?.plural ?? itemId.replaceAll('-', ' ');
}

/** An item's name in a count: "1 twisted log", "3 twisted logs", "40 black stone". */
export function itemCount(itemId: string, quantity: number): string {
  const one = (itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ')).toLowerCase();
  return `${quantity} ${quantity === 1 ? one : pluralItemName(itemId)}`;
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
  /** A gift from an NPC: Kesh's first sliver and the tide's, his seeds (docs/design/holding.md "Kesh"). */
  Gift: 'gift',
  /** A plot renamed (docs/design/holding.md "Plots"): the gin a change of its sentence costs. The first naming is free. */
  NamePlot: 'name-plot',
  /** A new field sown: the seed it takes, once, before it cycles or can be worked. */
  Sow: 'sow',
  /** A piece built in a plot (docs/design/holding.md "Build mode"): its cost from the store; a take-down's refund, positive, back into it. */
  Build: 'build',
  /** What a Kindled is given to start with (M2 Task 8): the Hookblade onto the rack, once, behind m2Scaffold. */
  Kit: 'kit',
} as const;
export type InventoryReason = (typeof InventoryReason)[keyof typeof InventoryReason];

const REASONS = new Set<string>(Object.values(InventoryReason));

export function isInventoryReason(value: unknown): value is InventoryReason {
  return typeof value === 'string' && REASONS.has(value);
}

/** The Telling now running (data/telling.json); stamped on every ledger row. */
export const CURRENT_TELLING: string = tellingJson.current;
