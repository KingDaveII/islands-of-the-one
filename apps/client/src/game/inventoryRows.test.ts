import { describe, expect, it } from 'vitest';
import { inventoryRows } from './inventoryRows.js';

describe('inventoryRows', () => {
  it('names each held item and its kind, keeping the order', () => {
    expect(
      inventoryRows([
        { item: 'sealed-gin', quantity: 120 },
        { item: 'wild-sliver', quantity: 3 },
        { item: 'pale-grain', quantity: 14 },
        { item: 'later-thing', quantity: 1 },
      ]),
    ).toEqual([
      { name: 'Sealed gin', kind: 'currency', count: '120' },
      { name: 'Wild sliver', kind: 'Sparkglass', count: '3' },
      { name: 'Pale grain', kind: 'material', count: '14' },
      { name: 'later-thing', kind: '', count: '1' },
    ]);
  });
});
