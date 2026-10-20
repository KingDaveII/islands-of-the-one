import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { deviceStore } from '../game/activeDevice.js';
import { controlsStore } from '../game/controlsStore.js';
import { hintFrom, MENU_BUTTONS, padEdges, type PadFamily } from '../game/gamepad.js';
import { keyboardBinding, keyCodeFor } from '../game/keyboard.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { menuCursor, menuGlyph, padFamilyNow, touchBackButton } from '../render/menus.js';
import { preloadSheets, registerSheetFrames, TOUCH_GLYPH_TEXTURE } from '../render/sheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

/** Rows of the controls table: action, player-facing name, note. */
const ROWS: [ControlAction, string, string][] = [
  ['light', 'LIGHT', 'three quick cuts'],
  ['heavy', 'HOOK-THRUST', 'hold to charge'],
  ['dodge', 'DODGE', 'rolls where you move'],
  ['ability1', 'HAUL', 'the hook'],
  ['ability2', 'THE CATCH', 'locked · combat only'],
  ['ability3', 'TURNING BLADE', 'locked · combat only'],
  ['item1', 'ITEM 1', 'Ration'],
  ['item2', 'ITEM 2', 'Ration'],
  ['interact', 'INTERACT', 'calm only · soon'],
  ['chartPeek', 'CHART PEEK', 'hold · soon'],
  ['journal', 'JOURNAL', 'soon'],
  ['inventory', 'INVENTORY', 'pack and store'],
  ['menu', 'MENU', ''],
  ['tuning', 'TUNING', 'the F2 panel'],
];

/** Two column groups of rows, 2× glyphs (24 px) on a 26 px pitch. */
const GROUP_X = [20, 250];
const ROWS_PER_GROUP = 7;
const ROW_Y = 64;
const ROW_PITCH = 26;
const KEYS_X = 88;
const PAD_X = 124;
const TOUCH_X = 178;

/**
 * The Touch column (M2 Task 10), from GAME DESIGN's touch table: the button's
 * own glyph (the touch-glyph sheet) where it has one, else a word; nothing
 * for what touch has no control for yet. Moving is the floating left stick;
 * the buttons aim (a tap at the soft lock, a drag in its direction).
 */
export const TOUCH_COLUMN: Readonly<Partial<Record<ControlAction, { glyph: string } | { text: string }>>> = {
  light: { glyph: 'light' },
  heavy: { glyph: 'heavy' },
  dodge: { glyph: 'dodge' },
  ability1: { glyph: 'haul' },
  ability2: { text: 'ARC' },
  ability3: { text: 'ARC' },
  item1: { text: 'SLOT 1' },
  item2: { text: 'SLOT 2' },
  interact: { glyph: 'use' },
  inventory: { text: 'PACK' },
  menu: { glyph: 'gear' },
};

/**
 * Controls screen: the gamepad presets from controls.json (left/right or click
 * to switch; the choice is remembered), every binding shown as a 2× controller
 * glyph next to the keyboard/mouse key from the same data; a binding marked
 * per input context shows every key it has, its note says the context. The
 * pad glyphs follow the connected pad's family (DualSense, or Xbox). The
 * active device's column header is lit and the footer names its own keys;
 * both switch live. Esc or Enter goes back, Circle on the pad, BACK on
 * touch; a third column, Touch, shows the touch controls (M2 Task 10).
 */
export class ControlsScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private presetName!: Text;
  private aimNote!: Text;
  private padRows: HintRow[] = [];
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';
  private headers: { keys: Text; pad: Text; touch: Text }[] = [];
  private footer!: HintRow;

  constructor() {
    super('controls');
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
    const cx = UI_W / 2;
    this.g = this.add.graphics();
    this.padRows = [];
    this.pad = { prev: [] };
    this.headers = [];
    this.family = padFamilyNow();
    place(label(this, 0, 0, 'CONTROLS', Palette.uiInk, 16), cx, 8, 0.5);
    place(label(this, 0, 0, 'GAMEPAD PRESET', Palette.uiInkMuted), cx - 180, 30);
    this.presetName = label(this, 0, 0, '', Palette.spark);
    this.aimNote = body(this, 0, 0, '', Palette.uiInkMuted);
    const left = label(this, 0, 0, '<', Palette.uiInk);
    const right = label(this, 0, 0, '>', Palette.uiInk);
    place(left, cx - 76, 30);
    place(right, cx + 46, 30);
    // A hit area a fingertip finds (the arrows are 5 px wide).
    const arrowHit = (): Phaser.Types.Input.InputConfiguration => ({
      hitArea: new Phaser.Geom.Rectangle(-8, -6, 21, 20),
      hitAreaCallback: (r: Phaser.Geom.Rectangle, x: number, y: number) => Phaser.Geom.Rectangle.Contains(r, x, y),
      useHandCursor: true,
    });
    left.setInteractive(arrowHit()).on('pointerdown', () => {
      controlsStore.cycle(-1);
    });
    right.setInteractive(arrowHit()).on('pointerdown', () => {
      controlsStore.cycle(1);
    });

    for (const gx of GROUP_X) {
      place(label(this, 0, 0, 'ACTION', Palette.uiInkMuted), gx, 52);
      this.headers.push({
        keys: place(label(this, 0, 0, 'KEYS', Palette.uiInkMuted), gx + KEYS_X, 52),
        pad: place(label(this, 0, 0, 'PAD', Palette.uiInkMuted), gx + PAD_X, 52),
        touch: place(label(this, 0, 0, 'TOUCH', Palette.uiInkMuted), gx + TOUCH_X, 52),
      });
    }
    ROWS.forEach(([action, name, note], i) => {
      const gx = GROUP_X[Math.floor(i / ROWS_PER_GROUP)] ?? 0;
      const y = ROW_Y + (i % ROWS_PER_GROUP) * ROW_PITCH;
      place(label(this, 0, 0, name, Palette.uiInk), gx, y + 2);
      if (note) place(body(this, 0, 0, note, Palette.uiInkMuted), gx, y + 13);
      new HintRow(this, { scale: 2 }).setHint(hintFrom('keyboard', action)).place(gx + KEYS_X, y);
      const pad = new HintRow(this, { scale: 2 }).place(gx + PAD_X, y);
      this.padRows.push(pad);
      const touch = TOUCH_COLUMN[action];
      if (touch && 'glyph' in touch) this.add.image(gx + TOUCH_X, y + 4, TOUCH_GLYPH_TEXTURE, touch.glyph).setOrigin(0, 0);
      else if (touch) place(label(this, 0, 0, touch.text, Palette.uiInk), gx + TOUCH_X, y + 8);
    });
    this.footer = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInk });
    this.tweens.add({ targets: this.footer.container, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const back = () => {
      this.scene.start('start');
    };
    const touchBack = touchBackButton(this, 8, 6, back);
    const menuCode = keyCodeFor(keyboardBinding('menu'));
    if (menuCode !== undefined) this.input.keyboard?.addKey(menuCode, true).on('down', back);
    this.input.keyboard?.on('keydown-ENTER', back);
    this.input.keyboard?.on('keydown-LEFT', () => {
      controlsStore.cycle(-1);
    });
    this.input.keyboard?.on('keydown-RIGHT', () => {
      controlsStore.cycle(1);
    });
    this.sync();
    const offPreset = controlsStore.subscribe(() => {
      this.sync();
    });
    const offDevice = deviceStore.subscribe(() => {
      this.sync();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offPreset();
      offDevice();
      touchBack.off();
    });
  }

  /** The footer for the device in use: how to switch presets and go back with it. */
  private footerItems(): HintItem[] {
    // On touch: the arrows are tapped and BACK is the button.
    if (deviceStore.get() === 'touch') return [word('tap  <  >  to switch')];
    if (deviceStore.get() === 'gamepad') {
      const menu = (index: number): HintItem[] => glyphs([menuGlyph(index)], this.family);
      return [...menu(MENU_BUTTONS.left), ...menu(MENU_BUTTONS.right), word('switch  ·'), ...menu(MENU_BUTTONS.back), word('back')];
    }
    return [...glyphs(['Left', 'Right'], 'keyboard'), word('switch  ·'), ...glyphs([keyboardBinding('menu')], 'keyboard'), word('back')];
  }

  private sync(): void {
    const preset = controlsStore.get();
    const cx = UI_W / 2;
    this.g.clear();
    panel(this.g, cx - 66, 26, 108, 16, { plain: true });
    place(this.presetName.setText(preset.name.toUpperCase()), cx - 61, 30);
    place(
      this.aimNote.setText(
        preset.aim === 'left-stick'
          ? 'aim always follows movement'
          : 'right stick aims; centered = soft lock',
      ),
      cx + 58,
      31,
    );
    divider(this.g, GROUP_X[0] ?? 0, ROW_Y + ROWS_PER_GROUP * ROW_PITCH, UI_W - 2 * (GROUP_X[0] ?? 0));
    ROWS.forEach(([action], i) => {
      this.padRows[i]?.setHint(hintFrom({ preset, family: this.family }, action));
    });
    // The active device's column is lit; the footer names its keys; the cursor follows it.
    const device = deviceStore.get();
    for (const h of this.headers) {
      h.keys.setTint(device === 'keyboard' ? Palette.uiFocus : Palette.uiInkMuted);
      h.pad.setTint(device === 'gamepad' ? Palette.uiFocus : Palette.uiInkMuted);
      h.touch.setTint(device === 'touch' ? Palette.uiFocus : Palette.uiInkMuted);
    }
    this.footer.setItems(this.footerItems()).place(cx, UI_H - 16, 0.5);
    menuCursor(this);
  }

  override update(): void {
    const family = padFamilyNow();
    if (family !== this.family) {
      this.family = family;
      this.sync();
    }
    const edges = padEdges(this.pad);
    if (edges.includes(MENU_BUTTONS.left)) controlsStore.cycle(-1);
    if (edges.includes(MENU_BUTTONS.right)) controlsStore.cycle(1);
    if (edges.includes(MENU_BUTTONS.back)) this.scene.start('start');
  }
}
