import { itemDef, type InventoryEntry, type ItemKind } from '@iot/shared';
import { displayable } from './drawable.js';

/** One line of the inventory view: what it is, what kind, how many. */
export interface InventoryRow {
  name: string;
  kind: string;
  count: string;
}

const KIND_NAMES: Record<ItemKind, string> = {
  currency: 'currency',
  sparkglass: 'Sparkglass',
  material: 'material',
};

/**
 * The rows the inventory view draws, in the server's order (items.json). An
 * id this build doesn't know (a newer server) still shows, by its id.
 */
export function inventoryRows(entries: readonly InventoryEntry[]): InventoryRow[] {
  return entries.map(({ item, quantity }) => {
    const def = itemDef(item);
    return {
      name: displayable(def?.name ?? item),
      kind: def ? KIND_NAMES[def.kind] : '',
      count: String(quantity),
    };
  });
}
