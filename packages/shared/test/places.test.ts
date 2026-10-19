import { describe, expect, it } from 'vitest';
import {
  basketPlace,
  basketStation,
  canMove,
  FIXED_PLACES,
  defaultPlace,
  inventoryData,
  isInventoryMoveRequest,
  isInventoryResponse,
  isPlace,
  ITEMS,
  kindFitsPlace,
  MAX_PLACE_LENGTH,
  PACK_SLOTS,
  packSlotCount,
  packSlots,
  slotSizeOf,
  slotsFor,
  storeLimitOf,
  validateInventoryData,
} from '../src/index.js';

/**
 * Where items are (docs/design/inventory.md): data/inventory.json and its
 * validator, the place guard, the pack slots derived from counts, and the
 * moves the API allows.
 */
const good = {
  packSlots: 20,
  slotSize: { material: 50, sparkglass: 99, consumable: 5, lore: 1 },
  storeLimit: { material: 9999 },
};

const problemsOf = (data: unknown): string[] => {
  const result = validateInventoryData(data);
  return result.ok ? [] : result.problems;
};

describe('inventory.json', () => {
  it("holds GAME DESIGN's starting values", () => {
    expect(inventoryData).toEqual(good);
    expect(PACK_SLOTS).toBe(20);
    expect(slotSizeOf('material')).toBe(50);
    expect(slotSizeOf('sparkglass')).toBe(99);
    expect(slotSizeOf('consumable')).toBe(5);
    expect(slotSizeOf('currency')).toBeUndefined();
    expect(storeLimitOf('black-stone')).toBe(9999);
    expect(storeLimitOf('wild-sliver')).toBe(Number.MAX_SAFE_INTEGER);
    expect(storeLimitOf('nothing')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('is validated on load', () => {
    expect(validateInventoryData({ ...good, $comment: 'x' })).toMatchObject({
      ok: true,
      data: good,
    });
    expect(problemsOf([])).toEqual(['expected an object']);
    expect(problemsOf({ ...good, packSlots: 0 })).toEqual(['packSlots must be a positive integer']);
    expect(problemsOf({ ...good, packSlots: 2.5 })).toHaveLength(1);
    expect(problemsOf({ ...good, slotSize: { ...good.slotSize, currency: 1 } })).toEqual([
      'slotSize: currency takes no slot (it lives in the purse)',
    ]);
    expect(
      problemsOf({ ...good, slotSize: { material: 50, sparkglass: 99, consumable: 5 } }),
    ).toEqual(['slotSize.lore must be a positive integer']);
    // A weapon takes no pack slot: it hangs on the rack (M2 Task 8).
    expect(problemsOf({ ...good, slotSize: { ...good.slotSize, weapon: 1 } })).toEqual([
      'slotSize: weapon takes no slot (it lives in the rack)',
    ]);
    expect(problemsOf({ ...good, slotSize: { ...good.slotSize, tool: 1 } })).toEqual(['slotSize: unknown kind tool']);
    expect(problemsOf({ ...good, slotSize: 'lots' })).toHaveLength(1);
    expect(problemsOf({ ...good, storeLimit: { material: -1 } })).toHaveLength(1);
    expect(problemsOf({ ...good, storeLimit: { tool: 1 } })).toEqual(['storeLimit: unknown kind tool']);
    expect(problemsOf({ ...good, storeLimit: [] })).toHaveLength(1);
    expect(problemsOf({ ...good, extra: 1 })).toEqual(['unknown field(s) extra']);
  });
});

describe('places', () => {
  it('guards purse, pack, store and basket:<stationId>', () => {
    for (const place of ['purse', 'pack', 'store', 'basket:field', 'basket:deep-quarry-2'])
      expect(isPlace(place), place).toBe(true);
    for (const place of [
      'bag',
      'Purse',
      'basket:',
      'basket:Field',
      'basket:-field',
      'basket:field-',
      'basket:field--2',
      'basket:a_b',
      'basket:' + 'a'.repeat(MAX_PLACE_LENGTH),
      ' pack',
      7,
      null,
      undefined,
      {},
    ])
      expect(isPlace(place), JSON.stringify(place)).toBe(false);
    expect(basketPlace('field')).toBe('basket:field');
    expect(() => basketPlace('Field')).toThrow();
    expect(basketStation('basket:field')).toBe('field');
    expect(basketStation('store')).toBeUndefined();
  });

  it('knows which kind goes where: currency in the purse, weapons on the rack, nothing else in either', () => {
    expect(defaultPlace('currency')).toBe('purse');
    expect(defaultPlace('material')).toBe('store');
    expect(defaultPlace('sparkglass')).toBe('store');
    expect(defaultPlace('weapon')).toBe('rack');
    expect(kindFitsPlace('currency', 'purse')).toBe(true);
    expect(kindFitsPlace('currency', 'pack')).toBe(false);
    expect(kindFitsPlace('currency', 'basket:field')).toBe(false);
    expect(kindFitsPlace('currency', 'rack')).toBe(false);
    expect(kindFitsPlace('material', 'purse')).toBe(false);
    expect(kindFitsPlace('material', 'pack')).toBe(true);
    expect(kindFitsPlace('material', 'rack')).toBe(false);
    expect(kindFitsPlace('sparkglass', 'basket:field')).toBe(true);
    expect(kindFitsPlace('sparkglass', 'rack')).toBe(false);
    // The rack (M2 Task 8) holds weapons and nothing else; a weapon is nowhere else, and takes no pack slot.
    expect(kindFitsPlace('weapon', 'rack')).toBe(true);
    for (const place of ['purse', 'pack', 'store', 'basket:field'] as const) expect(kindFitsPlace('weapon', place), place).toBe(false);
    expect(isPlace('rack')).toBe(true);
    expect(FIXED_PLACES).toEqual(['purse', 'pack', 'store', 'rack']);
    expect(slotSizeOf('weapon')).toBeUndefined();
    expect(slotsFor('hookblade', 1)).toBe(0);
    expect(packSlots([{ itemId: 'hookblade', quantity: 1 }, { itemId: 'twisted-log', quantity: 1 }])).toEqual([{ itemId: 'twisted-log', quantity: 1 }]);
    expect(canMove('rack', 'store')).toBe(false);
    expect(canMove('store', 'rack')).toBe(false);
    expect(canMove('pack', 'rack')).toBe(false);
  });

  it('allows pack and store both ways and a basket to the store, nothing else', () => {
    expect(canMove('pack', 'store')).toBe(true);
    expect(canMove('store', 'pack')).toBe(true);
    expect(canMove('basket:field', 'store')).toBe(true);
    for (const [from, to] of [
      ['pack', 'pack'],
      ['store', 'store'],
      ['purse', 'pack'],
      ['pack', 'purse'],
      ['store', 'purse'],
      ['basket:field', 'pack'],
      ['basket:field', 'purse'],
      ['basket:field', 'basket:quarry'],
      ['store', 'basket:field'],
      ['pack', 'basket:field'],
    ] as const)
      expect(canMove(from, to), `${from} -> ${to}`).toBe(false);
  });
});

describe('pack slots', () => {
  it('derives slots from counts: full slots first, then the remainder, in order', () => {
    expect(slotsFor('black-stone', 1)).toBe(1);
    expect(slotsFor('black-stone', 50)).toBe(1);
    expect(slotsFor('black-stone', 51)).toBe(2);
    expect(slotsFor('wild-sliver', 99)).toBe(1);
    expect(slotsFor('wild-sliver', 100)).toBe(2);
    expect(slotsFor('black-stone', 0)).toBe(0);
    // Currency takes no slot (it is never in the pack); an unknown item takes one.
    expect(slotsFor('sealed-gin', 500)).toBe(0);
    expect(slotsFor('new-thing', 500)).toBe(1);
    expect(
      packSlots([
        { itemId: 'wild-sliver', quantity: 120 },
        { itemId: 'black-stone', quantity: 50 },
        { itemId: 'pale-grain', quantity: 101 },
      ]),
    ).toEqual([
      { itemId: 'wild-sliver', quantity: 99 },
      { itemId: 'wild-sliver', quantity: 21 },
      { itemId: 'black-stone', quantity: 50 },
      { itemId: 'pale-grain', quantity: 50 },
      { itemId: 'pale-grain', quantity: 50 },
      { itemId: 'pale-grain', quantity: 1 },
    ]);
    expect(packSlots([])).toEqual([]);
    expect(packSlots([{ itemId: 'new-thing', quantity: 500 }])).toEqual([
      { itemId: 'new-thing', quantity: 500 },
    ]);
  });

  it('counts the 20-slot edge', () => {
    // 19 full slots of stone and one of grain: exactly full.
    const full = [
      { itemId: 'black-stone', quantity: 950 },
      { itemId: 'pale-grain', quantity: 1 },
    ];
    expect(packSlotCount(full)).toBe(PACK_SLOTS);
    expect(packSlots(full)).toHaveLength(PACK_SLOTS);
    // One more stone spills into a 21st slot.
    expect(
      packSlotCount([
        { itemId: 'black-stone', quantity: 951 },
        full[1] ?? { itemId: 'pale-grain', quantity: 1 },
      ]),
    ).toBe(PACK_SLOTS + 1);
    expect(packSlotCount([{ itemId: 'black-stone', quantity: 1000 }])).toBe(PACK_SLOTS);
  });
});

describe('inventory API guards', () => {
  const entry = { itemId: 'sealed-gin', quantity: 12 };
  const empty = { purse: [], pack: [], store: [], baskets: {} };

  it('isInventoryResponse accepts the four places and refuses anything else', () => {
    expect(isInventoryResponse(empty)).toBe(true);
    expect(
      isInventoryResponse({
        ...empty,
        purse: [entry],
        store: [{ itemId: 'black-stone', quantity: 3 }],
        baskets: { field: [{ itemId: 'pale-grain', quantity: 2 }] },
      }),
    ).toBe(true);
    expect(isInventoryResponse({ ...empty, purse: [{ itemId: 'sealed-gin', quantity: 0 }] })).toBe(
      false,
    );
    expect(isInventoryResponse({ ...empty, pack: [{ itemId: 'sealed-gin', quantity: 1.5 }] })).toBe(
      false,
    );
    expect(isInventoryResponse({ ...empty, store: [{ item: 'sealed-gin', quantity: 1 }] })).toBe(
      false,
    );
    expect(isInventoryResponse({ ...empty, baskets: { Field: [] } })).toBe(false);
    expect(isInventoryResponse({ ...empty, baskets: { field: {} } })).toBe(false);
    expect(isInventoryResponse({ ...empty, baskets: [] })).toBe(false);
    expect(isInventoryResponse({ ...empty, items: [] })).toBe(false);
    expect(isInventoryResponse({ purse: [], pack: [], store: [] })).toBe(false);
    // Task 2's shape.
    expect(isInventoryResponse({ items: [] })).toBe(false);
    expect(isInventoryResponse(null)).toBe(false);
  });

  it('isInventoryMoveRequest checks the shape only, clamping nothing', () => {
    const move = { itemId: 'black-stone', from: 'store', to: 'pack', quantity: 3 };
    expect(isInventoryMoveRequest(move)).toBe(true);
    expect(isInventoryMoveRequest({ ...move, from: 'basket:field', to: 'store' })).toBe(true);
    // The item and the pair of places are the route's to judge.
    expect(isInventoryMoveRequest({ ...move, itemId: 'gold' })).toBe(true);
    expect(isInventoryMoveRequest({ ...move, to: 'purse' })).toBe(true);
    for (const bad of [
      { ...move, quantity: 0 },
      { ...move, quantity: -1 },
      { ...move, quantity: 1.5 },
      { ...move, quantity: '3' },
      { ...move, quantity: 2 ** 53 },
      { ...move, from: 'bag' },
      { ...move, to: 'basket:' },
      { ...move, itemId: 7 },
      { ...move, all: true },
      { itemId: 'black-stone', from: 'store', to: 'pack' },
      null,
      [],
    ])
      expect(isInventoryMoveRequest(bad), JSON.stringify(bad)).toBe(false);
  });

  it('every item has a default place', () => {
    for (const item of ITEMS) expect(['purse', 'store', 'rack']).toContain(defaultPlace(item.kind));
  });
});
