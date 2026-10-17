import { PACK_SLOTS, type InventoryResponse } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_INVENTORY,
  filterTab,
  headerLine,
  headerTotals,
  initials,
  INVENTORY_TABS,
  maxScroll,
  moveFocus,
  PACK_COLS,
  PACK_ROWS,
  packCells,
  packUsed,
  scrollToShow,
  storeCells,
  TAB_LABELS,
  tooltipLines,
} from './inventoryView.js';

const inventory: InventoryResponse = {
  purse: [{ itemId: 'sealed-gin', quantity: 120 }],
  pack: [
    { itemId: 'wild-sliver', quantity: 120 },
    { itemId: 'black-stone', quantity: 50 },
    { itemId: 'pale-grain', quantity: 101 },
  ],
  store: [
    { itemId: 'glass-chip', quantity: 2 },
    { itemId: 'deep-glass', quantity: 1 },
    { itemId: 'twisted-log', quantity: 130 },
    { itemId: 'later-thing', quantity: 7 },
  ],
  baskets: { field: [{ itemId: 'pale-grain', quantity: 9 }] },
};

describe('the inventory screen layout', () => {
  it('has the tabs in order, the Words tab left for Task 5', () => {
    expect(INVENTORY_TABS).toEqual(['all', 'material', 'sparkglass', 'consumable', 'lore']);
    expect(Object.values(TAB_LABELS)).toEqual([
      'ALL',
      'MATERIALS',
      'SPARKGLASS',
      'CONSUMABLES',
      'LORE',
    ]);
    expect(PACK_COLS * PACK_ROWS).toBe(PACK_SLOTS);
    expect([PACK_COLS, PACK_ROWS]).toEqual([5, 4]);
  });

  it('filters by kind; an unknown item counts as a material; empty kinds show empty', () => {
    expect(filterTab(inventory.store, 'all')).toEqual(inventory.store);
    expect(filterTab(inventory.store, 'sparkglass').map((e) => e.itemId)).toEqual([
      'glass-chip',
      'deep-glass',
    ]);
    expect(filterTab(inventory.store, 'material').map((e) => e.itemId)).toEqual([
      'twisted-log',
      'later-thing',
    ]);
    expect(filterTab(inventory.store, 'consumable')).toEqual([]);
    expect(filterTab(inventory.store, 'lore')).toEqual([]);
  });

  it('derives the pack slots from the answer: split stacks, then empties up to 20', () => {
    const cells = packCells(inventory, 'all');
    expect(cells).toHaveLength(PACK_SLOTS);
    expect(cells.slice(0, 7)).toEqual([
      { itemId: 'wild-sliver', quantity: 99 },
      { itemId: 'wild-sliver', quantity: 21 },
      { itemId: 'black-stone', quantity: 50 },
      { itemId: 'pale-grain', quantity: 50 },
      { itemId: 'pale-grain', quantity: 50 },
      { itemId: 'pale-grain', quantity: 1 },
      null,
    ]);
    expect(cells.filter((c) => c === null)).toHaveLength(14);
    expect(packUsed(inventory)).toBe(6);
    expect(packCells(inventory, 'sparkglass').filter((c) => c !== null)).toEqual([
      { itemId: 'wild-sliver', quantity: 99 },
      { itemId: 'wild-sliver', quantity: 21 },
    ]);
    expect(packCells(inventory, 'lore').every((c) => c === null)).toBe(true);
    expect(packCells(EMPTY_INVENTORY, 'all').every((c) => c === null)).toBe(true);
    expect(packUsed(EMPTY_INVENTORY)).toBe(0);
    // Exactly full: 19 slots of stone and one of grain.
    const full = {
      ...EMPTY_INVENTORY,
      pack: [
        { itemId: 'black-stone', quantity: 950 },
        { itemId: 'pale-grain', quantity: 1 },
      ],
    };
    expect(packCells(full, 'all').every((c) => c !== null)).toBe(true);
    expect(packUsed(full)).toBe(PACK_SLOTS);
  });

  it("splits the store into cells of a pack slot's worth, with no empties", () => {
    expect(storeCells(inventory, 'all')).toEqual([
      { itemId: 'glass-chip', quantity: 2 },
      { itemId: 'deep-glass', quantity: 1 },
      { itemId: 'twisted-log', quantity: 50 },
      { itemId: 'twisted-log', quantity: 50 },
      { itemId: 'twisted-log', quantity: 30 },
      { itemId: 'later-thing', quantity: 7 },
    ]);
    expect(storeCells(inventory, 'material')).toHaveLength(4);
    expect(storeCells(inventory, 'consumable')).toEqual([]);
  });

  it('totals the header from the purse, the pack and the store (not the baskets)', () => {
    const t = headerTotals(inventory);
    expect(t).toEqual({ gin: 120, wildSliver: 120, hummingGlass: 2, deepGlass: 1 });
    expect(headerLine(t)).toBe('GIN 120   SLIVER 120   HUMMING 2   DEEP 1');
    expect(headerTotals(EMPTY_INVENTORY)).toEqual({
      gin: 0,
      wildSliver: 0,
      hummingGlass: 0,
      deepGlass: 0,
    });
  });

  it('draws initials for icons until ART draws them', () => {
    expect(initials('black-stone')).toBe('BS');
    expect(initials('glass-chip')).toBe('HG');
    expect(initials('sealed-gin')).toBe('SG');
    expect(initials('later-thing')).toBe('LT');
  });

  it('writes the tooltip: name, the kind line with its skill, the card text, the count in the pane', () => {
    expect(tooltipLines('black-stone', 50, 'pack')).toEqual({
      name: 'Black stone',
      kind: 'Material · Mining',
      text: 'Heavy, dense and faintly warm. Good for walls, hearths and anything that has to stay put.',
      count: '50 in pack',
    });
    expect(tooltipLines('wild-sliver', 3, 'store')).toMatchObject({
      kind: 'Sparkglass',
      count: '3 in store',
    });
    expect(tooltipLines('glass-chip', 1, 'store').name).toBe('Humming glass');
    expect(tooltipLines('later-thing', 1, 'store')).toEqual({
      name: 'later-thing',
      kind: '',
      text: '',
      count: '1 in store',
    });
  });

  it('moves the focus within a grid, across the panes at their edges, and never off them', () => {
    const cols = 11;
    const count = 6;
    expect(moveFocus({ pane: 'pack', index: 0 }, 'right', cols, count)).toEqual({
      pane: 'pack',
      index: 1,
    });
    expect(moveFocus({ pane: 'pack', index: 4 }, 'right', cols, count)).toEqual({
      pane: 'store',
      index: 0,
    });
    expect(moveFocus({ pane: 'pack', index: 9 }, 'right', cols, count)).toEqual({
      pane: 'store',
      index: 5,
    });
    expect(moveFocus({ pane: 'pack', index: 4 }, 'right', cols, 0)).toEqual({
      pane: 'pack',
      index: 4,
    });
    expect(moveFocus({ pane: 'pack', index: 0 }, 'left', cols, count)).toEqual({
      pane: 'pack',
      index: 0,
    });
    expect(moveFocus({ pane: 'pack', index: 0 }, 'up', cols, count)).toEqual({
      pane: 'pack',
      index: 0,
    });
    expect(moveFocus({ pane: 'pack', index: 0 }, 'down', cols, count)).toEqual({
      pane: 'pack',
      index: 5,
    });
    expect(moveFocus({ pane: 'pack', index: 17 }, 'down', cols, count)).toEqual({
      pane: 'pack',
      index: 17,
    });
    expect(moveFocus({ pane: 'store', index: 0 }, 'left', cols, count)).toEqual({
      pane: 'pack',
      index: 4,
    });
    expect(moveFocus({ pane: 'store', index: 3 }, 'left', cols, count)).toEqual({
      pane: 'store',
      index: 2,
    });
    expect(moveFocus({ pane: 'store', index: 5 }, 'right', cols, count)).toEqual({
      pane: 'store',
      index: 5,
    });
    expect(moveFocus({ pane: 'store', index: 0 }, 'down', cols, 15)).toEqual({
      pane: 'store',
      index: 11,
    });
    expect(moveFocus({ pane: 'store', index: 11 }, 'up', cols, 15)).toEqual({
      pane: 'store',
      index: 0,
    });
    expect(moveFocus({ pane: 'store', index: 11 }, 'left', cols, 15)).toEqual({
      pane: 'pack',
      index: 9,
    });
    expect(moveFocus({ pane: 'store', index: 44 }, 'left', cols, 50)).toEqual({
      pane: 'pack',
      index: 19,
    });
  });

  it('scrolls the store grid to show the focus and no further than its last page', () => {
    expect(scrollToShow(0, 5, 11, 4)).toBe(0);
    expect(scrollToShow(0, 44, 11, 4)).toBe(1);
    expect(scrollToShow(3, 0, 11, 4)).toBe(0);
    expect(scrollToShow(1, 20, 11, 4)).toBe(1);
    expect(maxScroll(6, 11, 4)).toBe(0);
    expect(maxScroll(45, 11, 4)).toBe(1);
    expect(maxScroll(200, 11, 4)).toBe(15);
  });
});
