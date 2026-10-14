import Phaser from 'phaser';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { inventoryRows } from '../game/inventoryRows.js';
import { keyboardBinding, keyCodeFor } from '../game/keyboard.js';
import { displayable } from '../game/drawable.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

const PANEL_W = 240;
const PANEL_Y = 50;
const ROW_Y = PANEL_Y + 9;
const ROW_PITCH = 14;
const PAD_X = 12;
/** Rows before the list stops (with a "+N more" line); the M2 item list fits. */
const MAX_ROWS = 12;

/**
 * The inventory view (docs/design/inventory.md): what the signed-in Kindled
 * holds, as GET /api/inventory answers it, one row per item with its count.
 * Only here to see the ledger work; no icons until ART draws them. Esc or
 * Enter goes back, Circle on the pad.
 */
export class InventoryScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private status!: Text;
  private rows: Text[] = [];
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';
  private footer!: HintRow;

  constructor() {
    super('inventory');
  }

  preload(): void {
    preloadSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.pad = padEdgeState();
    this.rows = [];
    this.family = padFamilyNow();
    const cx = VIEW_W / 2;
    place(label(this, 0, 0, 'INVENTORY', Palette.uiInk, 16), cx, 8, 0.5);
    const who = accountStore.current?.kindled?.name;
    if (who) place(body(this, 0, 0, displayable(who), Palette.uiInkMuted), cx, 30, 0.5);
    this.g = this.add.graphics();
    this.status = body(this, 0, 0, '...', Palette.uiInkMuted);
    this.layout(1);
    place(this.status, cx, ROW_Y, 0.5);

    this.footer = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInk });
    this.syncFooter();
    const offDevice = deviceStore.subscribe(() => {
      this.syncFooter();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, offDevice);

    const back = () => {
      this.scene.start('start');
    };
    const menuCode = keyCodeFor(keyboardBinding('menu'));
    if (menuCode !== undefined) this.input.keyboard?.addKey(menuCode, true).on('down', back);
    this.input.keyboard?.on('keydown-ENTER', back);

    void api.inventory().then((res) => {
      if (!this.scene.isActive()) return;
      if (!res.ok) {
        this.status.setText(res.message);
        place(this.status, cx, ROW_Y, 0.5);
        return;
      }
      this.show(inventoryRows(res.value));
    });
  }

  /** Draw the list; an empty inventory says so. */
  private show(list: ReturnType<typeof inventoryRows>): void {
    const cx = VIEW_W / 2;
    if (list.length === 0) {
      this.status.setText('Nothing yet.');
      place(this.status, cx, ROW_Y, 0.5);
      return;
    }
    this.status.setVisible(false);
    const shown = list.slice(0, MAX_ROWS);
    const extra = list.length - shown.length;
    this.layout(shown.length + (extra > 0 ? 1 : 0));
    const left = cx - PANEL_W / 2 + PAD_X;
    const right = cx + PANEL_W / 2 - PAD_X;
    shown.forEach((row, i) => {
      const y = ROW_Y + i * ROW_PITCH;
      this.rows.push(
        place(label(this, 0, 0, row.name.toUpperCase(), Palette.uiInk), left, y),
        place(body(this, 0, 0, row.kind, Palette.uiInkMuted), left + 120, y + 1),
        place(label(this, 0, 0, row.count, Palette.uiInk), right, y, 1),
      );
    });
    if (extra > 0)
      place(body(this, 0, 0, `+${extra} more`, Palette.uiInkMuted), left, ROW_Y + shown.length * ROW_PITCH);
  }

  /** The panel behind `count` rows. */
  private layout(count: number): void {
    const h = 16 + count * ROW_PITCH;
    this.g.clear();
    panel(this.g, VIEW_W / 2 - PANEL_W / 2, PANEL_Y, PANEL_W, h);
  }

  /** The footer for the device in use: how to go back with it. */
  private syncFooter(): void {
    const items: HintItem[] =
      deviceStore.get() === 'gamepad'
        ? [...glyphs([menuGlyph(MENU_BUTTONS.back)], this.family), word('back')]
        : [...glyphs([keyboardBinding('menu')], 'keyboard'), word('back')];
    this.footer.setItems(items).place(VIEW_W / 2, VIEW_H - 16, 0.5);
    menuCursor(this);
  }

  override update(): void {
    const family = padFamilyNow();
    if (family !== this.family) {
      this.family = family;
      this.syncFooter();
    }
    const edges = padEdges(this.pad);
    if (edges.includes(MENU_BUTTONS.back)) this.scene.start('start');
  }
}
