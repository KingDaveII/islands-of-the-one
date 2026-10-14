import { describe, expect, it } from 'vitest';
import {
  CURRENT_TELLING,
  InventoryReason,
  isInventoryReason,
  isInventoryResponse,
  isItemId,
  itemDef,
  ITEM_KINDS,
  ITEMS,
  itemOrder,
  RETIRED_WORDS,
  validateItemsData,
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

  it('uses no retired glossary word and no banned name in any id or name', () => {
    for (const item of ITEMS) {
      for (const text of [item.id, item.name, item.description]) {
        expect(BANNED.test(text), text).toBe(false);
        const words = text.toLowerCase().split(/[^a-z]+/);
        for (const retired of RETIRED_WORDS) expect(words, text).not.toContain(retired);
      }
    }
  });

  it('gives every item a known kind and a limit', () => {
    for (const item of ITEMS) {
      expect(ITEM_KINDS).toContain(item.kind);
      if (item.stackLimit !== null) expect(item.stackLimit).toBeGreaterThan(0);
    }
    expect(itemDef('sealed-gin')).toMatchObject({ kind: 'currency', stackLimit: null });
    expect(itemDef('twisted-log')?.stackLimit).toBe(9999);
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
    ).toMatchObject({ ok: true, items: [{ stackLimit: 9999 }, { stackLimit: null }] });
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
    for (const stackLimit of [0, -1, 1.5, 'lots', null, 2 ** 60])
      expect(problemsOf([{ ...good, stackLimit }]), String(stackLimit)).toHaveLength(1);
    expect(problemsOf([{ ...good, description: 7 }])).toHaveLength(1);
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
    ]);
    expect(isInventoryReason('trade')).toBe(true);
    expect(isInventoryReason('theft')).toBe(false);
  });

  it('names the current Telling with a kebab-case id', () => {
    expect(CURRENT_TELLING).toMatch(KEBAB);
  });
});

describe('isInventoryResponse', () => {
  it('accepts held items and refuses anything else', () => {
    expect(isInventoryResponse({ items: [] })).toBe(true);
    expect(isInventoryResponse({ items: [{ item: 'sealed-gin', quantity: 12 }] })).toBe(true);
    expect(isInventoryResponse({ items: [{ item: 'sealed-gin', quantity: 0 }] })).toBe(false);
    expect(isInventoryResponse({ items: [{ item: 'sealed-gin', quantity: 1.5 }] })).toBe(false);
    expect(isInventoryResponse({ items: [{ item: 3, quantity: 1 }] })).toBe(false);
    expect(isInventoryResponse({ items: {} })).toBe(false);
    expect(isInventoryResponse(null)).toBe(false);
  });
});
