import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { controlsStore } from '../game/controlsStore.js';
import { hintFor, KEYBOARD_HINTS } from '../game/gamepad.js';
import { Palette } from '../palette.js';
import { body, label, place } from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

/** Rows of the controls table: action, player-facing name. Glyphs are text labels until a glyph sheet exists. */
const ROWS: [ControlAction, string, string][] = [
  ['light', 'LIGHT', 'three quick cuts'],
  ['heavy', 'HOOK-THRUST', 'hold to charge'],
  ['dodge', 'DODGE', 'from the move stick'],
  ['ability1', 'HAUL', 'the hook'],
  ['ability2', 'THE CATCH', 'encounters only · locked'],
  ['ability3', 'TURNING BLADE', 'encounters only · locked'],
  ['item1', 'ITEM 1', 'Ration'],
  ['item2', 'ITEM 2', 'Ration'],
  ['interact', 'INTERACT', 'soon'],
  ['chartPeek', 'CHART PEEK', 'soon'],
  ['journal', 'JOURNAL', 'soon'],
];

/**
 * Controls screen: the gamepad presets from controls.json (left/right or click
 * to switch; the choice is remembered), each binding shown as a text label
 * next to the fixed keyboard/mouse key. Esc or Enter goes back.
 */
export class ControlsScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private presetName!: Phaser.GameObjects.Text;
  private aimNote!: Phaser.GameObjects.Text;
  private padLabels: Phaser.GameObjects.Text[] = [];
  private prevPad: boolean[] = [];

  constructor() {
    super('controls');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.hollow);
    const cx = VIEW_W / 2;
    this.g = this.add.graphics();
    place(label(this, 0, 0, 'CONTROLS', Palette.uiInk, 16), cx, 10, 0.5);
    place(label(this, 0, 0, 'GAMEPAD PRESET', Palette.uiInkMuted), cx - 120, 36);
    this.presetName = label(this, 0, 0, '', Palette.spark);
    this.aimNote = body(this, 0, 0, '', Palette.uiInkMuted);
    const left = label(this, 0, 0, '<', Palette.uiInk);
    const right = label(this, 0, 0, '>', Palette.uiInk);
    place(left, cx - 26, 36);
    place(right, cx + 100, 36);
    left.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      controlsStore.cycle(-1);
    });
    right.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      controlsStore.cycle(1);
    });

    const top = 64;
    place(label(this, 0, 0, 'ACTION', Palette.uiInkMuted), cx - 170, top);
    place(label(this, 0, 0, 'KEYBOARD', Palette.uiInkMuted), cx - 40, top);
    place(label(this, 0, 0, 'GAMEPAD', Palette.uiInkMuted), cx + 50, top);
    ROWS.forEach(([action, name, note], i) => {
      const y = top + 14 + i * 13;
      place(label(this, 0, 0, name, Palette.uiInk), cx - 170, y);
      place(label(this, 0, 0, KEYBOARD_HINTS[action], Palette.uiInk), cx - 40, y);
      const pad = label(this, 0, 0, '', Palette.spark);
      place(pad, cx + 50, y);
      this.padLabels.push(pad);
      place(body(this, 0, 0, note, Palette.uiInkMuted), cx + 110, y);
    });
    place(
      body(
        this,
        0,
        0,
        'Soft lock: with the right stick centered, aim follows the move stick, snapped to the nearest enemy within the preset angle. Dodge always rolls where you move.',
        Palette.uiBevel,
        300,
      ),
      cx - 150,
      VIEW_H - 46,
    );
    const hint = place(
      label(this, 0, 0, 'LEFT/RIGHT SWITCH  ·  ESC BACK', Palette.uiInk),
      cx,
      VIEW_H - 18,
      0.5,
    );
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    const back = () => {
      this.scene.start('start');
    };
    this.input.keyboard?.on('keydown-ESC', back);
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

  private sync(): void {
    const preset = controlsStore.get();
    const cx = VIEW_W / 2;
    this.g.clear();
    panel(this.g, cx - 20, 32, 116, 16, { plain: true });
    place(this.presetName.setText(preset.name.toUpperCase()), cx - 15, 36);
    place(
      this.aimNote.setText(
        preset.aim === 'left-stick'
          ? 'aim always follows movement'
          : 'right stick aims; centered = soft lock',
      ),
      cx + 112,
      37,
    );
    divider(this.g, cx - 170, 60 + 14 + ROWS.length * 13 + 2, 340);
    ROWS.forEach(([action], i) => {
      const t = this.padLabels[i];
      if (t) t.setText(hintFor(preset, action));
    });
  }

  override update(): void {
    // D-pad left/right (standard mapping 14/15) and Circle (1) go back.
    const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    const now = pad ? pad.buttons.map((b) => b.pressed) : [];
    const edge = (i: number) => (now[i] ?? false) && !(this.prevPad[i] ?? false);
    if (edge(14)) controlsStore.cycle(-1);
    if (edge(15)) controlsStore.cycle(1);
    if (edge(1)) this.scene.start('start');
    this.prevPad = now;
  }
}
