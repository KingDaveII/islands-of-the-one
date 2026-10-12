import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { controlsStore } from '../game/controlsStore.js';
import { connectedPad, hintFrom, padFamily, type PadFamily } from '../game/gamepad.js';
import { keyboardBinding, keyCodeFor } from '../game/keyboard.js';
import { Palette } from '../palette.js';
import { HintRow } from '../render/hint.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place } from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

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

/**
 * Controls screen: the gamepad presets from controls.json (left/right or click
 * to switch; the choice is remembered), every binding shown as a 2× controller
 * glyph next to the keyboard/mouse key from the same data; a binding marked
 * per input context shows every key it has, its note says the context. The
 * pad glyphs follow the connected pad's family (DualSense, or Xbox). Esc or
 * Enter goes back.
 */
export class ControlsScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private presetName!: Phaser.GameObjects.Text;
  private aimNote!: Phaser.GameObjects.Text;
  private padRows: HintRow[] = [];
  private prevPad: boolean[] = [];
  private family: PadFamily = 'ps';

  constructor() {
    super('controls');
  }

  preload(): void {
    preloadSheets(this);
  }

  create(): void {
    registerSheetFrames(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    const cx = VIEW_W / 2;
    this.g = this.add.graphics();
    this.padRows = [];
    this.prevPad = [];
    this.family = this.padFamilyNow();
    place(label(this, 0, 0, 'CONTROLS', Palette.uiInk, 16), cx, 8, 0.5);
    place(label(this, 0, 0, 'GAMEPAD PRESET', Palette.uiInkMuted), cx - 180, 30);
    this.presetName = label(this, 0, 0, '', Palette.spark);
    this.aimNote = body(this, 0, 0, '', Palette.uiInkMuted);
    const left = label(this, 0, 0, '<', Palette.uiInk);
    const right = label(this, 0, 0, '>', Palette.uiInk);
    place(left, cx - 76, 30);
    place(right, cx + 46, 30);
    left.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      controlsStore.cycle(-1);
    });
    right.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      controlsStore.cycle(1);
    });

    for (const gx of GROUP_X) {
      place(label(this, 0, 0, 'ACTION', Palette.uiInkMuted), gx, 52);
      place(label(this, 0, 0, 'KEYS', Palette.uiInkMuted), gx + KEYS_X, 52);
      place(label(this, 0, 0, 'PAD', Palette.uiInkMuted), gx + PAD_X, 52);
    }
    ROWS.forEach(([action, name, note], i) => {
      const gx = GROUP_X[Math.floor(i / ROWS_PER_GROUP)] ?? 0;
      const y = ROW_Y + (i % ROWS_PER_GROUP) * ROW_PITCH;
      place(label(this, 0, 0, name, Palette.uiInk), gx, y + 2);
      if (note) place(body(this, 0, 0, note, Palette.uiInkMuted), gx, y + 13);
      new HintRow(this, { scale: 2 }).setHint(hintFrom('keyboard', action)).place(gx + KEYS_X, y);
      const pad = new HintRow(this, { scale: 2 }).place(gx + PAD_X, y);
      this.padRows.push(pad);
    });
    const hint = place(
      label(this, 0, 0, 'LEFT/RIGHT SWITCH  ·  ESC BACK', Palette.uiInk),
      cx,
      VIEW_H - 14,
      0.5,
    );
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const back = () => {
      this.scene.start('start');
    };
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
    const off = controlsStore.subscribe(() => {
      this.sync();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private padFamilyNow(): PadFamily {
    const pad = connectedPad();
    return pad ? padFamily(pad.id) : 'ps';
  }

  private sync(): void {
    const preset = controlsStore.get();
    const cx = VIEW_W / 2;
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
    divider(this.g, GROUP_X[0] ?? 0, ROW_Y + ROWS_PER_GROUP * ROW_PITCH, VIEW_W - 2 * (GROUP_X[0] ?? 0));
    ROWS.forEach(([action], i) => {
      this.padRows[i]?.setHint(hintFrom({ preset, family: this.family }, action));
    });
  }

  override update(): void {
    // D-pad left/right (standard mapping 14/15) and Circle (1) go back.
    const pad = connectedPad();
    const family = pad ? padFamily(pad.id) : 'ps';
    if (family !== this.family) {
      this.family = family;
      this.sync();
    }
    const now = pad ? pad.buttons.map((b) => b.pressed) : [];
    const edge = (i: number) => (now[i] ?? false) && !(this.prevPad[i] ?? false);
    if (edge(14)) controlsStore.cycle(-1);
    if (edge(15)) controlsStore.cycle(1);
    if (edge(1)) this.scene.start('start');
    this.prevPad = now;
  }
}
