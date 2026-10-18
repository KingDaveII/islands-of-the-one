import Phaser from 'phaser';
import { PACK_SLOTS, type InventoryResponse, type Place } from '@iot/shared';
import { api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { controlsStore } from '../game/controlsStore.js';
import {
  buttonsFor,
  connectedPad,
  glyphsFor,
  hintFrom,
  MENU_BUTTONS,
  padEdges,
  padEdgeState,
  type PadFamily,
} from '../game/gamepad.js';
import {
  CONSUMABLE_SLOTS,
  EMPTY_INVENTORY,
  headerLine,
  headerTotals,
  initials,
  INVENTORY_TABS,
  litPane,
  maxScroll,
  moveFocus,
  NO_WORDS_LINE,
  PACK_COLS,
  PACK_ROWS,
  packCells,
  packUsed,
  REFUSAL_LIFE_MS,
  refusalPane,
  refusalVisible,
  scrollToShow,
  storeCells,
  TAB_LABELS,
  tooltipLines,
  wordKindLine,
  wordLine,
  wordRows,
  wordTooltipLines,
  type Cell,
  type Direction,
  type Focus,
  type InventoryTab,
  type TooltipLines,
  type WordRow,
} from '../game/inventoryView.js';
import { keyboardBinding, keyCodeFor } from '../game/keyboard.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { loadLetterSheet, plotLetters, type LetterSheet } from '../render/letters.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { ITEM_ICON_TEXTURE, preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { abilitySlot, divider, panel } from '../render/ui.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

/** Cells are 24 px on a 26 px pitch; a pane is its panel, a title row and its grid. */
const CELL = 24;
/** ART's item icons are 16 px (#77). */
const ICON = 16;
const PITCH = 26;
const PANE_PAD = 7;
const GRID_Y = 18;
const PANE_Y = 56;
const PACK_X = 10;
const PACK_W = PANE_PAD * 2 + PACK_COLS * PITCH - (PITCH - CELL);
const STORE_X = PACK_X + PACK_W + 10;
const STORE_COLS = 11;
const STORE_ROWS = PACK_ROWS;
const STORE_W = PANE_PAD * 2 + STORE_COLS * PITCH - (PITCH - CELL);
const PANE_H = GRID_Y + PACK_ROWS * PITCH - (PITCH - CELL) + PANE_PAD;
const HEADER_Y = 28;
const TABS_Y = 42;
const ITEMS_Y = PANE_Y + PANE_H + 8;
/** The consumable slots' key glyphs sit centred under them, as the HUD shows its key hints. */
const ITEM_SLOT = 14;
const ITEM_SLOT_X = PACK_X + 44;
const ITEM_SLOT_GAP = 44;
/** The pane header row: the pane's title left, the refusal line or the store's page counter right. */
const HEADER_ROW_Y = PANE_Y + 6;
const TOOLTIP_W = 150;
const TIP_DEPTH = 10;
/** The Words tab (M2 Task 5): one panel over both panes' room, a row per known tile: its letters at 2 UI px per sheet px, then its lines. */
const WORDS_X = PACK_X;
const WORDS_W = STORE_X + STORE_W - PACK_X;
const WORD_ROW_H = 22;
const WORD_LETTERS_W = 80;
const WORD_LETTER_SCALE = 2;
/** A pointer that travels this far (UI px) before it is released is a drag, not a click. */
const DRAG_PX = 6;
/** A touch held this long before it is released moves one item instead of the stack. */
const LONG_PRESS_MS = 450;
/** The left stick repeats the focus move after this long held, then at this rate. */
const STICK_DELAY_MS = 320;
const STICK_REPEAT_MS = 120;
const STICK_DEADZONE = 0.5;

/** Where the inventory screen goes back to: the start screen (its default), or the holding it was opened over (M2 Task 3b). */
export interface InventoryData {
  back?: 'start' | 'holding';
}

type Pane = Focus['pane'];
const other = (pane: Pane): Pane => (pane === 'pack' ? 'store' : 'pack');

/** A refused move's line, in the header of the pane the move went to, from `at` (the scene clock). */
interface Refusal {
  pane: Pane;
  text: string;
  at: number;
}

interface Press {
  pane: Pane;
  index: number;
  x: number;
  y: number;
  at: number;
  right: boolean;
  touch: boolean;
}

/**
 * The inventory screen (docs/design/inventory.md): the pack (a 5 × 4 grid
 * of its derived slots) and the holding store (a scrolling grid), both
 * filtered by the tabs, the purse and Sparkglass totals in the header, the
 * two consumable slots under the pack, and a tooltip on hover or focus.
 * Every move is a POST /api/inventory/move; the screen redraws from the
 * answer, never ahead of it, and a refusal shows its reason in one line in
 * the header of the pane the move went to (blinks twice, holds, gone).
 * Only the pane the keys or the pad act on has a lit frame. Placeholder look (the panel style; ART's item icons since #77, initials only for an item without one) until ART's M2 UI
 * kit; nothing here can destroy an item.
 */
export class InventoryScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private tip!: Phaser.GameObjects.Graphics;
  private header!: Text;
  private packTitle!: Text;
  private storeTitle!: Text;
  /** The refusal line in a pane header (one text, moved to the pane it is for). */
  private refusalText!: Text;
  private refusal: Refusal | null = null;
  /** What the load answered when it failed; shown in the store's grid. */
  private loadError = '';
  /** The store's page counter with the page glyphs on either side. */
  private pager!: HintRow;
  private tabTexts: Text[] = [];
  private cellTexts: Text[] = [];
  /** ART's item icons in the cells (#77); the initials stand in for an item without one. */
  private cellIcons: Phaser.GameObjects.Image[] = [];
  private tipTexts: Text[] = [];
  /** The Words tab: the known tiles from the holding's answer, their rows' texts, letters and zones, the hovered and the focused row. */
  private words: WordRow[] = [];
  private wordTexts: Text[] = [];
  private wordLetters!: Phaser.GameObjects.Graphics;
  private wordZones: Phaser.GameObjects.Zone[] = [];
  private wordHover: number | null = null;
  private wordFocus = 0;
  private itemHints: HintRow[] = [];
  private footer!: HintRow;
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';
  private inventory: InventoryResponse = EMPTY_INVENTORY;
  private loaded = false;
  private tab: InventoryTab = 'all';
  private cells: Record<Pane, Cell[]> = { pack: [], store: [] };
  private scrollRow = 0;
  /** The pad's or the arrows' focus; shown while the device is not the mouse. */
  private focus: Focus = { pane: 'pack', index: 0 };
  private hover: Focus | null = null;
  /** The keys moved the focus since the mouse last hovered a cell: show the focus ring in mouse mode too. */
  private keyNav = false;
  /** The pointer press in progress on a cell, until it is released. */
  private press: Press | null = null;
  /** A move is in flight: the screen waits for the answer before it takes another. */
  private busy = false;
  private stickDir: Direction | null = null;
  private stickNext = 0;
  private backTo: 'start' | 'holding' = 'start';
  /** The Old Letters sheet's ink, once loaded (the Words tab's letters); kept across openings. */
  private letterSheet: LetterSheet | null = null;

  constructor() {
    super('inventory');
  }

  init(data: InventoryData): void {
    this.backTo = data.back ?? 'start';
  }

  /** Back: the start screen, or the holding this screen was launched over (resumed, the screen stopped). */
  private back(): void {
    if (this.backTo === 'holding') {
      this.scene.stop();
      this.scene.resume('holding');
    } else this.scene.start('start');
  }

  preload(): void {
    preloadSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    menuCamera(this);
    this.pad = padEdgeState();
    this.family = padFamilyNow();
    this.inventory = EMPTY_INVENTORY;
    this.loaded = false;
    this.tab = 'all';
    this.scrollRow = 0;
    this.focus = { pane: 'pack', index: 0 };
    this.hover = null;
    this.keyNav = false;
    this.press = null;
    this.busy = false;
    this.refusal = null;
    this.loadError = '';
    this.cellTexts = [];
    this.cellIcons = [];
    this.tipTexts = [];
    this.words = [];
    this.wordTexts = [];
    this.wordZones = [];
    this.wordHover = null;
    this.wordFocus = 0;
    this.input.mouse?.disableContextMenu();
    const cx = UI_W / 2;

    this.g = this.add.graphics();
    this.wordLetters = this.add.graphics();
    // The tooltip sits over everything else (the cells' texts are made after it).
    this.tip = this.add.graphics().setDepth(TIP_DEPTH);
    place(label(this, 0, 0, 'INVENTORY', Palette.uiInk, 16), cx, 6, 0.5);
    this.header = label(this, 0, 0, '', Palette.uiInk);
    this.packTitle = label(this, PACK_X + PANE_PAD, PANE_Y + 6, 'PACK', Palette.uiInk);
    this.storeTitle = place(
      label(this, 0, 0, 'STORE', Palette.uiInk),
      STORE_X + PANE_PAD,
      HEADER_ROW_Y,
    );
    this.refusalText = body(this, 0, 0, '', Palette.uiInk).setVisible(false);
    this.pager = new HintRow(this, { wordColor: Palette.uiInkMuted });

    // Tabs: a row of labels, the active one lit; click to switch.
    this.tabTexts = INVENTORY_TABS.map((tab) => {
      const t = label(this, 0, 0, TAB_LABELS[tab], Palette.uiInkMuted);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.setTab(tab);
      });
      return t;
    });
    let x = PACK_X;
    for (const t of this.tabTexts) {
      place(t, x, TABS_Y);
      x += Math.round(t.width) + 12;
    }

    // The consumable slots (Q / F): empty until consumables exist; they take nothing yet.
    place(label(this, 0, 0, 'ITEMS', Palette.uiInkMuted), PACK_X, ITEMS_Y + 3);
    this.itemHints = CONSUMABLE_SLOTS.map(() => new HintRow(this));

    // One zone per cell, for hover, clicks, drags and taps.
    const zone = (pane: Pane, index: number, x: number, y: number): void => {
      const z = this.add.zone(x, y, CELL, CELL).setOrigin(0, 0).setInteractive();
      z.on('pointerover', () => {
        this.hover = { pane, index };
        this.keyNav = false;
        this.sync();
      });
      z.on('pointerout', () => {
        if (this.hover?.pane === pane && this.hover.index === index) this.hover = null;
        this.sync();
      });
      z.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.cells[pane][index]) return;
        this.press = {
          pane,
          index,
          x: p.worldX,
          y: p.worldY,
          at: p.downTime,
          right: p.rightButtonDown(),
          touch: p.wasTouch,
        };
      });
    };
    for (let i = 0; i < PACK_SLOTS; i++) {
      const at = this.cellAt('pack', i);
      if (at) zone('pack', i, at.x, at.y);
    }
    for (let i = 0; i < STORE_COLS * STORE_ROWS; i++) {
      const at = this.cellAt('store', this.scrollRow * STORE_COLS + i);
      if (at) zone('store', i, at.x, at.y);
    }
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.release(p);
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      this.scroll(dy > 0 ? 1 : -1);
    });

    this.footer = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInk });
    const offDevice = deviceStore.subscribe(() => {
      this.syncHints();
      this.syncTip();
    });
    const offPreset = controlsStore.subscribe(() => {
      this.syncHints();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offDevice();
      offPreset();
    });

    // Keys: Esc or I close; the arrows (or WASD) move the focus; Enter moves the stack; Tab switches tabs.
    const back = () => {
      this.back();
    };
    const kb = this.input.keyboard;
    for (const action of ['menu', 'inventory'] as const) {
      const code = keyCodeFor(keyboardBinding(action));
      if (code !== undefined) kb?.addKey(code, true).on('down', back);
    }
    kb?.addCapture(Phaser.Input.Keyboard.KeyCodes.TAB);
    const arrows: [string, Direction][] = [
      ['UP', 'up'],
      ['DOWN', 'down'],
      ['LEFT', 'left'],
      ['RIGHT', 'right'],
      ['W', 'up'],
      ['S', 'down'],
      ['A', 'left'],
      ['D', 'right'],
    ];
    for (const [key, dir] of arrows)
      kb?.on(`keydown-${key}`, () => {
        this.moveFocusBy(dir);
      });
    kb?.on('keydown-ENTER', () => {
      this.moveFocused(true);
    });
    kb?.on('keydown-TAB', (e: KeyboardEvent) => {
      this.cycleTab(e.shiftKey ? -1 : 1);
    });

    this.sync();
    this.syncHints();
    void api.inventory().then((res) => {
      if (!this.scene.isActive()) return;
      if (!res.ok) {
        this.loadError = res.message;
        this.sync();
        return;
      }
      this.inventory = res.value;
      this.loaded = true;
      this.sync();
    });
    // The known word tiles come with the holding (M2 Task 5); without one (no Kindled yet) the Words tab stays empty.
    void api.holding().then((res) => {
      if (!this.scene.isActive() || !res.ok) return;
      this.words = wordRows(res.value.words);
      this.sync();
    });
    if (!this.letterSheet)
      void loadLetterSheet().then(
        (sheet) => {
          if (!this.scene.isActive()) return;
          this.letterSheet = sheet;
          this.sync();
        },
        (err: unknown) => {
          console.warn(err);
        },
      );
  }

  /** The grid cell's top left for a pane and a cell index (the store's index counts from its first row), or null when it is off the grid. */
  private cellAt(pane: Pane, index: number): { x: number; y: number } | null {
    const cols = pane === 'pack' ? PACK_COLS : STORE_COLS;
    const row = Math.floor(index / cols) - (pane === 'store' ? this.scrollRow : 0);
    const col = index % cols;
    if (row < 0 || row >= PACK_ROWS) return null;
    const x0 = (pane === 'pack' ? PACK_X : STORE_X) + PANE_PAD;
    return { x: x0 + col * PITCH, y: PANE_Y + GRID_Y + row * PITCH };
  }

  /** Which pane a point (layout px) is over, by its panel. */
  private paneAt(x: number, y: number): Pane | null {
    if (y < PANE_Y || y >= PANE_Y + PANE_H) return null;
    if (x >= PACK_X && x < PACK_X + PACK_W) return 'pack';
    if (x >= STORE_X && x < STORE_X + STORE_W) return 'store';
    return null;
  }

  private setTab(tab: InventoryTab): void {
    this.tab = tab;
    this.scrollRow = 0;
    this.wordHover = null;
    this.sync();
  }

  private cycleTab(delta: number): void {
    const i = INVENTORY_TABS.indexOf(this.tab);
    const n = INVENTORY_TABS.length;
    this.setTab(INVENTORY_TABS[(((i + delta) % n) + n) % n] ?? 'all');
  }

  private scroll(rows: number): void {
    const max = maxScroll(this.cells.store.length, STORE_COLS, STORE_ROWS);
    const next = Math.max(0, Math.min(max, this.scrollRow + rows));
    if (next === this.scrollRow) return;
    this.scrollRow = next;
    this.sync();
  }

  /** The pointer released: a drag to the other pane moves the stack; a click or tap moves the stack, a right click or a long press one. */
  private release(p: Phaser.Input.Pointer): void {
    const press = this.press;
    this.press = null;
    if (!press) return;
    const dragged = Math.hypot(p.worldX - press.x, p.worldY - press.y) >= DRAG_PX;
    if (dragged) {
      if (this.paneAt(p.worldX, p.worldY) === other(press.pane))
        this.move(press.pane, press.index, true);
      return;
    }
    const held = press.touch && p.upTime - press.at >= LONG_PRESS_MS;
    this.move(press.pane, press.index, !(press.right || held));
  }

  private moveFocusBy(dir: Direction): void {
    this.hover = null;
    this.keyNav = true;
    if (this.tab === 'words') {
      // The Words tab is a list: up and down move along it.
      this.wordHover = null;
      const n = this.words.length;
      if (dir === 'up') this.wordFocus = Math.max(0, this.wordFocus - 1);
      else if (dir === 'down') this.wordFocus = Math.min(Math.max(0, n - 1), this.wordFocus + 1);
      this.sync();
      return;
    }
    this.focus = moveFocus(this.focus, dir, STORE_COLS, this.cells.store.length);
    if (this.focus.pane === 'store')
      this.scrollRow = scrollToShow(this.scrollRow, this.focus.index, STORE_COLS, STORE_ROWS);
    this.sync();
  }

  private moveFocused(all: boolean): void {
    this.move(this.focus.pane, this.focus.index, all);
  }

  /** Ask the server to move a cell's stack (or one of it) to the other pane; redraw from its answer. */
  private move(pane: Pane, index: number, all: boolean): void {
    const cell = this.cells[pane][index];
    if (!cell || this.busy || !this.loaded) return;
    const from: Place = pane;
    const to: Place = other(pane);
    this.busy = true;
    this.refusal = null;
    void api
      .move({ itemId: cell.itemId, from, to, quantity: all ? cell.quantity : 1 })
      .then((res) => {
        if (!this.scene.isActive()) return;
        this.busy = false;
        if (res.ok) this.inventory = res.value;
        else this.refusal = { pane: refusalPane(to), text: res.message, at: this.time.now };
        this.sync();
      });
  }

  /** Redraw everything from the inventory and the tab. */
  private sync(): void {
    this.cells = {
      pack: packCells(this.inventory, this.tab),
      store: storeCells(this.inventory, this.tab),
    };
    const max = maxScroll(this.cells.store.length, STORE_COLS, STORE_ROWS);
    this.scrollRow = Math.min(this.scrollRow, max);
    if (this.focus.pane === 'store' && this.cells.store.length === 0)
      this.focus = { pane: 'pack', index: 0 };
    else if (this.focus.pane === 'store')
      this.focus.index = Math.min(this.focus.index, this.cells.store.length - 1);

    place(this.header.setText(headerLine(headerTotals(this.inventory))), UI_W / 2, HEADER_Y, 0.5);
    this.packTitle.setText(`PACK ${packUsed(this.inventory)}/${PACK_SLOTS}`);
    INVENTORY_TABS.forEach((tab, i) => {
      this.tabTexts[i]?.setTint(tab === this.tab ? Palette.uiFocus : Palette.uiInkMuted);
    });

    const g = this.g;
    g.clear();
    for (const t of this.cellTexts) t.destroy();
    this.cellTexts = [];
    for (const icon of this.cellIcons) icon.destroy();
    this.cellIcons = [];
    // Only the pane the keys or the pad act on has the lit rim; the other keeps the plain frame.
    const showFocus = deviceStore.get() === 'gamepad' || this.keyNav;
    this.packTitle.setVisible(this.tab !== 'words');
    this.storeTitle.setVisible(this.tab !== 'words');
    if (this.tab === 'words') {
      this.syncWords(showFocus);
      this.pager.setVisible(false);
      this.refusalText.setVisible(false);
      this.drawItemSlots();
      this.syncTip();
      return;
    }
    this.clearWords();
    const lit = litPane(this.focus, showFocus);
    panel(
      g,
      PACK_X,
      PANE_Y,
      PACK_W,
      PANE_H,
      lit === 'pack' ? { rim: Palette.uiFocus } : { plain: true },
    );
    panel(
      g,
      STORE_X,
      PANE_Y,
      STORE_W,
      PANE_H,
      lit === 'store' ? { rim: Palette.uiFocus } : { plain: true },
    );
    const drawCell = (pane: Pane, index: number, cell: Cell): void => {
      const at = this.cellAt(pane, index);
      if (!at) return;
      const focused = showFocus && this.focus.pane === pane && this.focus.index === index;
      const hovered = this.hover?.pane === pane && this.hover.index === index;
      g.fillStyle(Palette.uiOutline, 1).fillRect(at.x, at.y, CELL, CELL);
      g.fillStyle(focused || hovered ? Palette.uiFocus : Palette.uiBevel, 1).fillRect(
        at.x + 1,
        at.y + 1,
        CELL - 2,
        CELL - 2,
      );
      g.fillStyle(cell ? Palette.uiPanel : Palette.hollow, 1).fillRect(
        at.x + 2,
        at.y + 2,
        CELL - 4,
        CELL - 4,
      );
      if (!cell) return;
      // ART's 16 px icon centred in the cell's 20 px inside; the initials only for an item without one.
      if (this.textures.get(ITEM_ICON_TEXTURE).has(cell.itemId))
        this.cellIcons.push(
          this.add
            .image(
              at.x + (CELL - ICON) / 2,
              at.y + (CELL - ICON) / 2,
              ITEM_ICON_TEXTURE,
              cell.itemId,
            )
            .setOrigin(0, 0),
        );
      else
        this.cellTexts.push(
          place(label(this, 0, 0, initials(cell.itemId), Palette.uiInk), at.x + 3, at.y + 3),
        );
      this.cellTexts.push(
        place(
          label(this, 0, 0, String(cell.quantity), Palette.spark),
          at.x + CELL - 2,
          at.y + CELL - 2,
          1,
          1,
        ),
      );
    };
    this.cells.pack.forEach((cell, i) => {
      drawCell('pack', i, cell);
    });
    const first = this.scrollRow * STORE_COLS;
    for (let i = first; i < Math.min(this.cells.store.length, first + STORE_COLS * STORE_ROWS); i++)
      drawCell('store', i, this.cells.store[i] ?? null);
    if (this.cells.store.length === 0 && (this.loaded || this.loadError))
      this.cellTexts.push(
        body(
          this,
          STORE_X + PANE_PAD,
          PANE_Y + GRID_Y + 2,
          this.loadError || 'Nothing here.',
          Palette.uiInkMuted,
        ),
      );
    this.syncHeaderRows(max);
    this.drawItemSlots();
    this.syncTip();
  }

  /** The two consumable slots: sunken and empty. */
  private drawItemSlots(): void {
    CONSUMABLE_SLOTS.forEach((_action, i) => {
      abilitySlot(this.g, ITEM_SLOT_X + i * ITEM_SLOT_GAP, ITEMS_Y, {
        icon: 'ration',
        cooldown: 0,
        locked: false,
        ready: false,
        small: true,
        empty: true,
      });
    });
  }

  /** The Words tab's row rectangle, or null past the list. */
  private wordRowAt(index: number): { x: number; y: number; w: number; h: number } | null {
    if (index < 0 || index >= this.words.length) return null;
    return {
      x: WORDS_X + PANE_PAD,
      y: PANE_Y + GRID_Y + index * WORD_ROW_H,
      w: WORDS_W - 2 * PANE_PAD,
      h: WORD_ROW_H - 2,
    };
  }

  private clearWords(): void {
    for (const t of this.wordTexts) t.destroy();
    this.wordTexts = [];
    for (const z of this.wordZones) z.destroy();
    this.wordZones = [];
    this.wordLetters.clear();
  }

  /**
   * The Words tab (M2 Task 5): every known tile in one panel, a row each with its letters (the sheet's ink,
   * once loaded), "say · meaning" and "Slot · Element"; the hovered or focused row is lit and shows the card in
   * the tooltip. Word tiles are not items: nothing here moves.
   */
  private syncWords(showFocus: boolean): void {
    this.clearWords();
    const g = this.g;
    const rows = Math.max(1, this.words.length);
    const h = GRID_Y + rows * WORD_ROW_H + PANE_PAD;
    panel(g, WORDS_X, PANE_Y, WORDS_W, h, showFocus ? { rim: Palette.uiFocus } : { plain: true });
    this.wordTexts.push(
      place(
        label(this, 0, 0, `WORDS ${this.words.length}`, Palette.uiInk),
        WORDS_X + PANE_PAD,
        HEADER_ROW_Y,
      ),
    );
    if (this.words.length === 0) {
      this.wordTexts.push(
        body(this, WORDS_X + PANE_PAD, PANE_Y + GRID_Y + 2, NO_WORDS_LINE, Palette.uiInkMuted, WORDS_W - 2 * PANE_PAD),
      );
      return;
    }
    this.wordFocus = Math.min(this.wordFocus, this.words.length - 1);
    this.words.forEach((row, i) => {
      const r = this.wordRowAt(i);
      if (!r) return;
      const lit = (showFocus && this.wordFocus === i) || this.wordHover === i;
      g.fillStyle(lit ? Palette.uiFocus : Palette.uiBevel, 1).fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(Palette.uiPanel, 1).fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      if (this.letterSheet)
        plotLetters(this.wordLetters, this.letterSheet, row.letters, r.x + 4, r.y + 2, {
          scale: WORD_LETTER_SCALE,
        });
      this.wordTexts.push(
        place(body(this, 0, 0, wordLine(row), Palette.uiInk), r.x + WORD_LETTERS_W, r.y + 2),
      );
      this.wordTexts.push(
        place(
          body(this, 0, 0, wordKindLine(row), Palette.uiInkMuted),
          r.x + WORD_LETTERS_W,
          r.y + 11,
        ),
      );
      const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0, 0).setInteractive();
      z.on('pointerover', () => {
        this.wordHover = i;
        this.keyNav = false;
        this.sync();
      });
      z.on('pointerout', () => {
        if (this.wordHover === i) this.wordHover = null;
        this.sync();
      });
      this.wordZones.push(z);
    });
  }

  /**
   * The right side of the pane header rows: a refused move's line in the
   * header of the pane it went to while it lives, and the store's page
   * counter (with the page glyphs on either side) while it has pages and no
   * refusal line is over it.
   */
  private syncHeaderRows(maxScrollRow: number): void {
    const refusal = this.refusal;
    if (refusal) {
      const right = refusal.pane === 'pack' ? PACK_X + PACK_W : STORE_X + STORE_W;
      place(this.refusalText.setText(refusal.text), right - PANE_PAD, HEADER_ROW_Y + 1, 1);
      this.refusalText.setVisible(refusalVisible(this.time.now - refusal.at));
    } else this.refusalText.setVisible(false);
    const pages = maxScrollRow > 0 && !(refusal && refusal.pane === 'store');
    if (pages) {
      const last = maxScrollRow + STORE_ROWS;
      const text = `${this.scrollRow + 1}-${Math.min(this.scrollRow + STORE_ROWS, last)} of ${last}`;
      const padMode = deviceStore.get() === 'gamepad';
      const up = padMode ? menuGlyph(MENU_BUTTONS.up) : 'W';
      const down = padMode ? menuGlyph(MENU_BUTTONS.down) : 'S';
      const family = padMode ? this.family : 'keyboard';
      this.pager
        .setItems([...glyphs([up], family), word(text), ...glyphs([down], family)])
        .place(STORE_X + STORE_W - PANE_PAD, HEADER_ROW_Y - 2, 1);
    }
    this.pager.setVisible(pages);
  }

  /** The tooltip for the hovered cell (mouse) or the focused one (pad, keys); none over an empty cell. */
  private syncTip(): void {
    for (const t of this.tipTexts) t.destroy();
    this.tipTexts = [];
    this.tip.clear();
    const showFocus = deviceStore.get() === 'gamepad' || this.keyNav;
    if (this.tab === 'words') {
      // The card of the hovered or the focused row, beside the pointer's row, to the right of the lines.
      const i = this.wordHover ?? (showFocus ? this.wordFocus : null);
      const row = i === null ? undefined : this.words[i];
      const r = i === null ? null : this.wordRowAt(i);
      if (!row || !r) return;
      this.drawTip(wordTooltipLines(row), { x: r.x + r.w - TOOLTIP_W - 4, y: r.y + r.h + 2 });
      return;
    }
    const at = this.hover ?? (showFocus ? this.focus : null);
    const cell = at ? this.cells[at.pane][at.index] : null;
    if (!at || !cell) return;
    const pos = this.cellAt(at.pane, at.index);
    if (!pos) return;
    const inPane =
      (at.pane === 'pack' ? this.inventory.pack : this.inventory.store).find(
        (e) => e.itemId === cell.itemId,
      )?.quantity ?? 0;
    const lines = tooltipLines(cell.itemId, inPane, at.pane);
    const x = pos.x + CELL + 4 + TOOLTIP_W <= UI_W - 4 ? pos.x + CELL + 4 : pos.x - 4 - TOOLTIP_W;
    this.drawTip(lines, { x, y: pos.y });
  }

  /** The tooltip's panel and lines, its top left near `pos` (kept on the grid). */
  private drawTip(lines: TooltipLines, pos: { x: number; y: number }): void {
    const x = Math.max(2, Math.min(UI_W - 2 - TOOLTIP_W, pos.x));
    const inner = TOOLTIP_W - 2 * PANE_PAD;
    const name = label(this, 0, 0, lines.name.toUpperCase(), Palette.uiInk);
    const kind = body(this, 0, 0, lines.kind, Palette.uiInkMuted);
    const text = body(this, 0, 0, lines.text, Palette.uiInkMuted, inner);
    // The count line wraps too: a word's is LORE's two sentences ("A word, not an item. Once learned, …").
    const count = body(this, 0, 0, lines.count, Palette.uiInk, inner);
    const h = PANE_PAD + 10 + 11 + 4 + 1 + 4 + Math.round(text.height) + 4 + Math.max(11, Math.round(count.height)) + PANE_PAD;
    const y = Math.max(2, Math.min(UI_H - 2 - h, pos.y));
    panel(this.tip, x, y, TOOLTIP_W, h, { plain: true });
    let ly = y + PANE_PAD;
    place(name, x + PANE_PAD, ly);
    ly += 10;
    place(kind, x + PANE_PAD, ly);
    ly += 11 + 4;
    divider(this.tip, x + PANE_PAD, ly, inner);
    ly += 1 + 4;
    place(text, x + PANE_PAD, ly);
    ly += Math.round(text.height) + 4;
    place(count, x + PANE_PAD, ly);
    this.tipTexts.push(name, kind, text, count);
    for (const t of this.tipTexts) t.setDepth(TIP_DEPTH);
  }

  /** The footer and the consumable key hints for the device in use. */
  private syncHints(): void {
    const padMode = deviceStore.get() === 'gamepad';
    const preset = controlsStore.get();
    const source = padMode ? { preset, family: this.family } : 'keyboard';
    CONSUMABLE_SLOTS.forEach((action, i) => {
      this.itemHints[i]
        ?.setHint(hintFrom(source, action))
        .place(ITEM_SLOT_X + i * ITEM_SLOT_GAP + ITEM_SLOT / 2, ITEMS_Y + ITEM_SLOT + 1, 0.5);
    });
    const items: HintItem[] = padMode
      ? [
          ...glyphs([menuGlyph(MENU_BUTTONS.confirm[0])], this.family),
          word('move  ·'),
          ...glyphs([menuGlyph(MENU_BUTTONS.one)], this.family),
          word('one  ·'),
          ...glyphs(
            [menuGlyph(MENU_BUTTONS.tabPrev), menuGlyph(MENU_BUTTONS.tabNext)],
            this.family,
          ),
          word('tabs  ·'),
          ...glyphs([menuGlyph(MENU_BUTTONS.back), ...glyphsFor(preset, 'inventory')], this.family),
          word('back'),
        ]
      : [
          ...glyphs(['LMB'], 'keyboard'),
          word('move  ·'),
          ...glyphs(['RMB'], 'keyboard'),
          word('one  ·  drag between panes  ·'),
          ...glyphs(['Tab'], 'keyboard'),
          word('tabs  ·'),
          ...glyphs([keyboardBinding('menu'), keyboardBinding('inventory')], 'keyboard'),
          word('back'),
        ];
    this.footer.setItems(items).place(UI_W / 2, UI_H - 16, 0.5);
    menuCursor(this);
  }

  /** The left stick as a D-pad with key repeat. */
  private stick(now: number): void {
    const pad = connectedPad();
    const x = pad?.axes[0] ?? 0;
    const y = pad?.axes[1] ?? 0;
    const dir: Direction | null =
      Math.abs(x) < STICK_DEADZONE && Math.abs(y) < STICK_DEADZONE
        ? null
        : Math.abs(x) > Math.abs(y)
          ? x > 0
            ? 'right'
            : 'left'
          : y > 0
            ? 'down'
            : 'up';
    if (dir !== this.stickDir) {
      this.stickDir = dir;
      this.stickNext = now + STICK_DELAY_MS;
      if (dir) this.moveFocusBy(dir);
    } else if (dir && now >= this.stickNext) {
      this.stickNext = now + STICK_REPEAT_MS;
      this.moveFocusBy(dir);
    }
  }

  override update(): void {
    const family = padFamilyNow();
    if (family !== this.family) {
      this.family = family;
      this.syncHints();
    }
    // The refusal line blinks, holds, then goes in one frame; the page counter comes back after it.
    if (this.refusal) {
      const elapsed = this.time.now - this.refusal.at;
      if (elapsed >= REFUSAL_LIFE_MS) {
        this.refusal = null;
        this.sync();
      } else this.refusalText.setVisible(refusalVisible(elapsed));
    }
    const edges = padEdges(this.pad);
    const closes = [MENU_BUTTONS.back, ...buttonsFor(controlsStore.get(), 'inventory', 'calm')];
    if (closes.some((b) => edges.includes(b))) {
      this.back();
      return;
    }
    if (edges.includes(MENU_BUTTONS.confirm[0])) this.moveFocused(true);
    else if (edges.includes(MENU_BUTTONS.one)) this.moveFocused(false);
    else if (edges.includes(MENU_BUTTONS.tabPrev)) this.cycleTab(-1);
    else if (edges.includes(MENU_BUTTONS.tabNext)) this.cycleTab(1);
    const dpad: [number, Direction][] = [
      [MENU_BUTTONS.up, 'up'],
      [MENU_BUTTONS.down, 'down'],
      [MENU_BUTTONS.left, 'left'],
      [MENU_BUTTONS.right, 'right'],
    ];
    for (const [button, dir] of dpad) if (edges.includes(button)) this.moveFocusBy(dir);
    this.stick(this.time.now);
  }
}
