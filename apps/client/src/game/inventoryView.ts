import {
  itemDef,
  packSlots,
  PACK_SLOTS,
  SKILL_NAMES,
  slotsFor,
  type InventoryEntry,
  type InventoryResponse,
  type ItemKind,
  type PackSlot,
  type WordDef,
  wordDef,
} from '@iot/shared';
import { displayable } from './drawable.js';

/**
 * The inventory screen's layout logic (docs/design/inventory.md), pure so it
 * is tested in node: the pack's 20 slots and the store's cells derived from
 * an inventory answer, the tab filters, the header totals, the tooltip's
 * lines, the grid navigation, which pane holds the focus and the refusal
 * line's place and timing. The scene (scenes/InventoryScene.ts) draws these
 * and sends the moves; it decides nothing about items itself.
 */

/** The tabs, in order: everything, then one kind each, then the known word tiles (M2 Task 5; tiles are not items). */
export const INVENTORY_TABS = [
  'all',
  'material',
  'sparkglass',
  'consumable',
  'lore',
  'words',
] as const;
export type InventoryTab = (typeof INVENTORY_TABS)[number];

export const TAB_LABELS: Readonly<Record<InventoryTab, string>> = {
  all: 'ALL',
  material: 'MATERIALS',
  sparkglass: 'SPARKGLASS',
  consumable: 'CONSUMABLES',
  lore: 'LORE',
  words: 'WORDS',
};

/** The kind line's first word. */
export const KIND_NAMES: Readonly<Record<ItemKind, string>> = {
  currency: 'Currency',
  sparkglass: 'Sparkglass',
  material: 'Material',
  consumable: 'Consumable',
  lore: 'Lore object',
  // Never in a pane (a weapon hangs on the rack, M2 Task 8); here so every kind has its word.
  weapon: 'Weapon',
};

/** The pack grid: 5 across, 4 down. */
export const PACK_COLS = 5;
export const PACK_ROWS = PACK_SLOTS / PACK_COLS;

/** One drawn cell: an item and the count in that cell, or empty. */
export type Cell = PackSlot | null;

/** The two consumable slots under the pack (Q / F): empty until consumables exist. */
export const CONSUMABLE_SLOTS = ['item1', 'item2'] as const;

/** An inventory with nothing in it. */
export const EMPTY_INVENTORY: InventoryResponse = { purse: [], pack: [], store: [], baskets: {} };

/** The kind of an item id (an id this build doesn't know counts as a material, the plainest kind). */
const kindOf = (itemId: string): ItemKind => itemDef(itemId)?.kind ?? 'material';

/** The entries a tab shows: the Words tab shows no items (its tiles come from the holding's `words`). */
export function filterTab(entries: readonly InventoryEntry[], tab: InventoryTab): InventoryEntry[] {
  if (tab === 'words') return [];
  return tab === 'all' ? [...entries] : entries.filter((e) => kindOf(e.itemId) === tab);
}

/** One row of the Words tab: a known tile with its letters, how it is said, its meaning, its slot and element, and LORE's card. */
export interface WordRow {
  wordId: string;
  letters: string;
  say: string;
  meaning: string;
  slot: WordDef['slot'];
  element: WordDef['element'];
  card: string;
}

/** The slot's and the element's words on a row ("Ground · Earth"). */
export const WORD_SLOT_NAMES: Readonly<Record<WordDef['slot'], string>> = {
  ground: 'Ground',
  virtue: 'Virtue',
};
export const WORD_ELEMENT_NAMES: Readonly<Record<WordDef['element'], string>> = {
  earth: 'Earth',
  water: 'Water',
  fire: 'Fire',
  air: 'Air',
};

/** The Words tab's rows from the holding's known words, in the server's order (as learned); an id this build doesn't know is skipped. */
export function wordRows(words: readonly string[]): WordRow[] {
  return words.flatMap((id) => {
    const def = wordDef(id);
    return def
      ? [
          {
            wordId: def.id,
            letters: def.letters,
            say: def.say,
            meaning: def.meaning,
            slot: def.slot,
            element: def.element,
            card: def.card,
          },
        ]
      : [];
  });
}

/** A row's text lines: "adamah · tilled ground" and "Ground · Earth". */
export function wordLine(row: WordRow): string {
  return displayable(`${row.say} · ${row.meaning}`);
}
export function wordKindLine(row: WordRow): string {
  return `${WORD_SLOT_NAMES[row.slot]} · ${WORD_ELEMENT_NAMES[row.element]}`;
}

/** The Words tab while no word is known (LORE 2026-10-18). */
export const NO_WORDS_LINE = "No words yet. Out here, they're given or found.";

/** The last line of a word's tooltip (LORE 2026-10-18). */
export const WORD_TOOLTIP_LINE = "A word, not an item. Once learned, it's yours for good.";

/** The tooltip over a word row: the tile's say, its slot and element, LORE's card text, and LORE's word-not-item line. */
export function wordTooltipLines(row: WordRow): TooltipLines {
  return {
    name: displayable(row.say),
    kind: wordKindLine(row),
    text: displayable(row.card),
    count: WORD_TOOLTIP_LINE,
  };
}

/**
 * The pack's cells, always PACK_SLOTS of them: the pack's stacks split into
 * slots (full ones first, then the remainder, in the server's order), the
 * tab's items only, then empty cells. A tab hides the other kinds' slots but
 * they still take their room: the grid keeps the pack's true count free.
 */
export function packCells(inventory: InventoryResponse, tab: InventoryTab): Cell[] {
  const shown = packSlots(filterTab(inventory.pack, tab));
  const cells: Cell[] = shown.slice(0, PACK_SLOTS);
  while (cells.length < PACK_SLOTS) cells.push(null);
  return cells;
}

/** How many of the pack's slots are taken, whatever the tab. */
export function packUsed(inventory: InventoryResponse): number {
  return inventory.pack.reduce((n, e) => n + slotsFor(e.itemId, e.quantity), 0);
}

/**
 * The store's cells: its stacks split the way the pack would hold them (a
 * cell is at most a pack slot's worth), so clicking a cell moves what fits
 * in one slot. No empty cells: the grid is as long as the store is.
 */
export function storeCells(inventory: InventoryResponse, tab: InventoryTab): PackSlot[] {
  return packSlots(filterTab(inventory.store, tab));
}

/** The header: the purse's gin and the Sparkglass totals across the pack and the store. */
export interface HeaderTotals {
  gin: number;
  wildSliver: number;
  hummingGlass: number;
  deepGlass: number;
}

const total = (inventory: InventoryResponse, itemId: string): number =>
  [...inventory.pack, ...inventory.store]
    .filter((e) => e.itemId === itemId)
    .reduce((n, e) => n + e.quantity, 0);

export function headerTotals(inventory: InventoryResponse): HeaderTotals {
  return {
    gin: inventory.purse.find((e) => e.itemId === 'sealed-gin')?.quantity ?? 0,
    wildSliver: total(inventory, 'wild-sliver'),
    hummingGlass: total(inventory, 'glass-chip'),
    deepGlass: total(inventory, 'deep-glass'),
  };
}

/** The header's text. */
export function headerLine(t: HeaderTotals): string {
  return `GIN ${t.gin}   SLIVER ${t.wildSliver}   HUMMING ${t.hummingGlass}   DEEP ${t.deepGlass}`;
}

/** The icon placeholder until ART draws icons: the item's initials ("Black stone" → "BS"). */
export function initials(itemId: string): string {
  const name = itemDef(itemId)?.name ?? itemId.replaceAll('-', ' ');
  return displayable(
    name
      .split(/[\s-]+/)
      .filter((w) => w !== '')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2),
  );
}

/** The tooltip's lines for a cell: name, the kind line, the card text, the count in this pane. */
export interface TooltipLines {
  name: string;
  kind: string;
  text: string;
  count: string;
}

export function tooltipLines(itemId: string, inPane: number, pane: 'pack' | 'store'): TooltipLines {
  const def = itemDef(itemId);
  const kind = def ? KIND_NAMES[def.kind] : '';
  const skill = def?.skill ? SKILL_NAMES[def.skill] : null;
  return {
    name: displayable(def?.name ?? itemId),
    kind: skill ? `${kind} · ${skill}` : kind,
    text: displayable(def?.description ?? ''),
    count: `${inPane} in ${pane}`,
  };
}

/** Which pane a focus is in and which cell. */
export interface Focus {
  pane: 'pack' | 'store';
  index: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Where the pad's or the arrows' focus goes: within a grid by its columns,
 * across to the other pane past the pack's right edge or the store's left
 * one (onto the same row where there is one), never past a grid's edges
 * otherwise. The store's cell count may be 0: then focus stays in the pack.
 */
export function moveFocus(
  focus: Focus,
  dir: Direction,
  storeCols: number,
  storeCount: number,
): Focus {
  const cols = focus.pane === 'pack' ? PACK_COLS : storeCols;
  const count = focus.pane === 'pack' ? PACK_SLOTS : storeCount;
  const row = Math.floor(focus.index / cols);
  const col = focus.index % cols;
  const clamp = (pane: Focus['pane'], index: number, n: number): Focus => ({
    pane,
    index: Math.max(0, Math.min(n - 1, index)),
  });
  switch (dir) {
    case 'up':
      return row > 0 ? { ...focus, index: focus.index - cols } : focus;
    case 'down':
      return focus.index + cols < count ? { ...focus, index: focus.index + cols } : focus;
    case 'left':
      if (col > 0) return { ...focus, index: focus.index - 1 };
      if (focus.pane === 'store') return clamp('pack', row * PACK_COLS + PACK_COLS - 1, PACK_SLOTS);
      return focus;
    case 'right':
      if (col < cols - 1 && focus.index + 1 < count) return { ...focus, index: focus.index + 1 };
      if (focus.pane === 'pack' && storeCount > 0)
        return clamp('store', row * storeCols, storeCount);
      return focus;
  }
}

/** The first row the store grid shows so that `index` is visible, given the rows on screen. */
export function scrollToShow(
  scrollRow: number,
  index: number,
  cols: number,
  visibleRows: number,
): number {
  const row = Math.floor(index / cols);
  if (row < scrollRow) return row;
  if (row >= scrollRow + visibleRows) return row - visibleRows + 1;
  return scrollRow;
}

/** The most the store grid can scroll: its last page's first row, never below 0. */
export function maxScroll(count: number, cols: number, visibleRows: number): number {
  return Math.max(0, Math.ceil(count / cols) - visibleRows);
}

/**
 * Which pane's frame is lit (ART, 2026-10-17): only the pane the keys or
 * the pad act on takes ui-focus on its frame, the other keeps the plain
 * panel frame; with the mouse alone (no focus shown) neither is lit. The
 * focused cell inside the pane keeps its own frame regardless.
 */
export function litPane(focus: Focus, showFocus: boolean): Focus['pane'] | null {
  return showFocus ? focus.pane : null;
}

/**
 * A refused move's line (ART, 2026-10-17): it sits right-aligned in the
 * header row of the pane the move went to ("PACK 20/20 … Pack full."),
 * blinks twice, holds for REFUSAL_HOLD_MS, then disappears in one frame.
 * No fade: the blinks are whole steps on blinkOut()'s pattern (off, on,
 * off, on over the blink window), then solid.
 */
export const REFUSAL_BLINK_MS = 300;
export const REFUSAL_HOLD_MS = 2000;
export const REFUSAL_BLINKS = 2;
/** How long the line lives from the refusal. */
export const REFUSAL_LIFE_MS = REFUSAL_BLINK_MS + REFUSAL_HOLD_MS;

/** The pane whose header shows a refused move's line: the one the move went to. */
export function refusalPane(to: Focus['pane']): Focus['pane'] {
  return to;
}

/** Whether the refusal line is drawn `elapsedMs` after the refusal. */
export function refusalVisible(elapsedMs: number): boolean {
  if (elapsedMs < 0 || elapsedMs >= REFUSAL_LIFE_MS) return false;
  if (elapsedMs >= REFUSAL_BLINK_MS) return true;
  const slot = Math.floor((elapsedMs * 2 * REFUSAL_BLINKS) / REFUSAL_BLINK_MS);
  return slot % 2 === 1;
}
