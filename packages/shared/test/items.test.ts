import { describe, expect, it } from 'vitest';
import {
  CURRENT_TELLING,
  DRAWABLE_CHARS,
  InventoryReason,
  isInventoryReason,
  isItemId,
  itemDef,
  ITEM_KINDS,
  ITEM_SKILLS,
  ITEMS,
  itemOrder,
  RETIRED_WORDS,
  SKILL_NAMES,
  validateItemsData,
  pluralItemName,
  itemCount,
} from '../src/index.js';
import { BANNED } from './banned.js';

/**
 * data/items.json (docs/design/inventory.md): every item id unique, kebab-case,
 * free of the glossary's retired words and of the banned names; the shared
 * validator refuses each kind of bad entry.
 */
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const good = {
  id: 'black-stone',
  name: 'Black stone',
  plural: 'black stone',
  kind: 'material',
  stackLimit: 9999,
  description: '',
};

const problemsOf = (items: unknown[]): string[] => {
  const result = validateItemsData({ items });
  return result.ok ? [] : result.problems;
};

describe('items.json', () => {
  it('holds the M2 items with unique, kebab-case ids', () => {
    const ids = ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(KEBAB);
    expect(ids).toEqual([
      'sealed-gin',
      'wild-sliver',
      'glass-chip',
      'deep-glass',
      'twisted-log',
      'black-stone',
      'streaked-stone',
      'grey-seeds',
      'pale-grain',
    ]);
  });

  it('uses no retired glossary word and no banned name in any id, name or card text', () => {
    for (const item of ITEMS) {
      for (const text of [item.id, item.name, item.description]) {
        expect(BANNED.test(text), text).toBe(false);
        const words = text.toLowerCase().split(/[^a-z]+/);
        for (const retired of RETIRED_WORDS) expect(words, text).not.toContain(retired);
      }
    }
  });

  it("has LORE's card text for every item, in characters the fonts can draw", () => {
    // A character the atlases lack is flagged here, not changed in the text (tools/bitmap-fonts.py adds it).
    const lacking: string[] = [];
    for (const item of ITEMS) {
      expect(item.description.trim(), item.id).not.toBe('');
      for (const ch of `${item.name}${item.description}`)
        if (!DRAWABLE_CHARS.has(ch))
          lacking.push(`${item.id}: "${ch}" (U+${ch.codePointAt(0)?.toString(16)})`);
    }
    expect(lacking).toEqual([]);
    expect(itemDef('glass-chip')?.name).toBe('Humming glass');
    expect(itemDef('streaked-stone')?.description).toContain("bird's wing");
  });

  it('gives every item a known kind, a limit and at most one skill', () => {
    for (const item of ITEMS) {
      expect(ITEM_KINDS).toContain(item.kind);
      if (item.stackLimit !== null) expect(item.stackLimit).toBeGreaterThan(0);
      if (item.skill !== null) expect(ITEM_SKILLS).toContain(item.skill);
    }
    expect(itemDef('sealed-gin')).toMatchObject({
      kind: 'currency',
      stackLimit: null,
      skill: null,
    });
    expect(itemDef('twisted-log')).toMatchObject({ stackLimit: 9999, skill: 'woodcutting' });
    expect(itemDef('black-stone')?.skill).toBe('mining');
    expect(itemDef('streaked-stone')?.skill).toBe('mining');
    expect(itemDef('grey-seeds')?.skill).toBe('farming');
    expect(itemDef('pale-grain')?.skill).toBe('farming');
    expect(itemDef('wild-sliver')?.skill).toBeNull();
    expect(ITEM_KINDS).toEqual(['currency', 'sparkglass', 'material', 'consumable', 'lore']);
    for (const skill of ITEM_SKILLS) expect(SKILL_NAMES[skill]).toMatch(/^[A-Z][a-z]+$/);
  });

  it("has every item's plural as data: count nouns take an s, mass nouns stay, grey seeds stay grey seeds", () => {
    expect(Object.fromEntries(ITEMS.map((i) => [i.id, i.plural]))).toEqual({
      'sealed-gin': 'sealed gin',
      'wild-sliver': 'wild slivers',
      'glass-chip': 'humming glass',
      'deep-glass': 'deep glass',
      'twisted-log': 'twisted logs',
      'black-stone': 'black stone',
      'streaked-stone': 'streaked stone',
      'grey-seeds': 'grey seeds',
      'pale-grain': 'pale grain',
    });
    for (const item of ITEMS) {
      expect(item.plural, item.id).toBe(item.plural.toLowerCase());
      expect(Array.from(item.plural).filter((ch) => !DRAWABLE_CHARS.has(ch)), item.id).toEqual([]);
      expect(BANNED.test(item.plural), item.id).toBe(false);
    }
    expect(pluralItemName('twisted-log')).toBe('twisted logs');
    expect(pluralItemName('black-stone')).toBe('black stone');
    expect(pluralItemName('grey-seeds')).toBe('grey seeds');
    expect(pluralItemName('no-such')).toBe('no such');
    expect(itemCount('twisted-log', 1)).toBe('1 twisted log');
    expect(itemCount('twisted-log', 18)).toBe('18 twisted logs');
    expect(itemCount('black-stone', 40)).toBe('40 black stone');
    expect(itemCount('grey-seeds', 4)).toBe('4 grey seeds');
  });

  it('looks items up by id', () => {
    expect(isItemId('pale-grain')).toBe(true);
    expect(isItemId('pale-grains')).toBe(false);
    expect(isItemId(7)).toBe(false);
    expect(itemOrder('sealed-gin')).toBe(0);
    expect(itemOrder('nothing')).toBe(ITEMS.length);
  });
});

describe('validateItemsData', () => {
  it('accepts a good entry', () => {
    expect(
      validateItemsData({ items: [good, { ...good, id: 'gin', stackLimit: 'unlimited' }] }),
    ).toMatchObject({ ok: true, items: [{ stackLimit: 9999, skill: null }, { stackLimit: null }] });
    expect(validateItemsData({ items: [{ ...good, skill: 'mining' }] })).toMatchObject({
      ok: true,
      items: [{ skill: 'mining' }],
    });
  });

  it('refuses each kind of bad entry', () => {
    expect(validateItemsData([])).toEqual({ ok: false, problems: ['expected { items: [...] }'] });
    expect(problemsOf([good, good])).toEqual(['items[1] (black-stone): duplicate id']);
    expect(problemsOf([{ ...good, id: 'Black_Stone' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, id: 'glass-shard' }])[0]).toContain('retired word "shard"');
    expect(problemsOf([{ ...good, name: 'Void crystal' }])[0]).toContain('retired word "void"');
    expect(problemsOf([{ ...good, name: '' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, name: 'Stone א' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, kind: 'weapon' }])).toHaveLength(1);
    // The plural is data (MAIN 2026-10-19): required, lowercase, drawable.
    const noPlural: Record<string, unknown> = { ...good };
    delete noPlural.plural;
    expect(problemsOf([noPlural])).toEqual(['items[0] (black-stone): plural must be non-empty lowercase text the game can draw']);
    expect(problemsOf([{ ...good, plural: 'Black stone' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, plural: 'stone \u05d0' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, plural: 'void stone' }])[0]).toContain('retired word "void"');
    for (const stackLimit of [0, -1, 1.5, 'lots', null, 2 ** 60])
      expect(problemsOf([{ ...good, stackLimit }]), String(stackLimit)).toHaveLength(1);
    expect(problemsOf([{ ...good, description: 7 }])).toHaveLength(1);
    expect(problemsOf([{ ...good, description: 'Stone \u05d0' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, skill: 'smithing' }])).toHaveLength(1);
    expect(problemsOf([{ ...good, skill: null }])).toHaveLength(1);
    expect(problemsOf([{ ...good, rarity: 'rare' }])).toEqual([
      'items[0]: unknown field(s) rarity',
    ]);
    expect(problemsOf(['stone'])).toEqual(['items[0]: not an object']);
  });
});

describe('ledger vocabulary', () => {
  it('has a closed set of reasons', () => {
    expect(Object.values(InventoryReason)).toEqual([
      'grant',
      'gather',
      'harvest',
      'feed-writ',
      'craft',
      'trade',
      'admin',
      'move',
      'gift',
      'name-plot',
      'sow',
      'build',
    ]);
    expect(isInventoryReason('trade')).toBe(true);
    expect(isInventoryReason('theft')).toBe(false);
  });

  it('names the current Telling with a kebab-case id', () => {
    expect(CURRENT_TELLING).toMatch(KEBAB);
  });
});
