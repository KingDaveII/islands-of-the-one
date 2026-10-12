import type Phaser from 'phaser';
import type { ControlAction, ControlPreset } from '@iot/shared';
import { Button, encodeInput, type TickInput } from '@iot/sim';
import { controlsStore } from './controlsStore.js';
import { buttonsFor, hints, softLock, TRIGGER_BUTTONS, TRIGGER_THRESHOLD } from './gamepad.js';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';

const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;

export type AimSource = 'mouse' | 'gamepad';

/** What the sampler needs to know about the world this tick. */
export interface SampleContext {
  /** Enemy offsets from the player, world px (for the soft lock). */
  enemies: readonly { dx: number; dy: number }[];
  /** Abilities 2 and 3 on the face buttons only fire during an encounter. */
  encounter: boolean;
  /** Soft-lock angle for the active preset, degrees. */
  softLockDeg: number;
}

/**
 * Collects keyboard, mouse and gamepad (browser Gamepad API) input and turns
 * it into one packed sim input per tick. Presses are latched between ticks so
 * none are lost when a frame runs zero or several sim steps. Gamepad bindings
 * come from the active preset (controls.json); keyboard/mouse are fixed.
 */
export class Controls {
  private latched = 0;
  private aim = 0;
  private aimSource: AimSource = 'mouse';
  private prevPadButtons: boolean[] = [];
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private mouseHeavy = false;
  private pointer: { x: number; y: number } | null = null;
  lastInput: TickInput = { aim: 0, moveDir: 0, moveMag: 0, buttons: 0 };
  gamepadConnected = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,Q,E,R,T,F,SPACE,SHIFT', true) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    const press = (bit: number) => () => {
      this.latched |= bit;
    };
    this.keys.J?.on('down', press(Button.Light));
    this.keys.SPACE?.on('down', press(Button.Dodge));
    this.keys.SHIFT?.on('down', press(Button.Dodge));
    this.keys.E?.on('down', press(Button.Ability1));
    this.keys.R?.on('down', press(Button.Ability2));
    this.keys.T?.on('down', press(Button.Ability3));
    this.keys.Q?.on('down', press(Button.Item1));
    this.keys.F?.on('down', press(Button.Item2));

    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) this.mouseHeavy = true;
      else if (p.leftButtonDown()) this.latched |= Button.Light;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.rightButtonDown()) this.mouseHeavy = false;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointer = { x: p.worldX, y: p.worldY };
      this.aimSource = 'mouse';
    });
  }

  /** The active gamepad preset. */
  get preset(): ControlPreset {
    return controlsStore.get();
  }

  /** Key/glyph hints for the device in use: the preset's glyphs on a gamepad, else the keyboard. */
  hints(): Record<ControlAction, string> {
    return hints(this.gamepadConnected ? this.preset : 'keyboard');
  }

  /** World-space crosshair position (mouse), or null when aiming with a stick. */
  crosshair(): { x: number; y: number } | null {
    if (this.aimSource !== 'mouse' || !this.pointer) return null;
    const p = this.scene.input.activePointer;
    return { x: p.worldX, y: p.worldY };
  }

  private padButtons(pad: Gamepad): boolean[] {
    return pad.buttons.map((b, i) => (TRIGGER_BUTTONS.has(i) ? b.value > TRIGGER_THRESHOLD : b.pressed));
  }

  /** Build this tick's input. `px, py` is the player position in world pixels. */
  sample(px: number, py: number, ctx: SampleContext): number {
    const k = this.keys;
    let move = keyboardMove(
      Boolean(k.A?.isDown || k.LEFT?.isDown),
      Boolean(k.D?.isDown || k.RIGHT?.isDown),
      Boolean(k.W?.isDown || k.UP?.isDown),
      Boolean(k.S?.isDown || k.DOWN?.isDown),
    );
    let held = this.mouseHeavy || Boolean(k.K?.isDown);

    const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    this.gamepadConnected = Boolean(pad);
    if (pad) {
      const preset = this.preset;
      const lx = pad.axes[0] ?? 0;
      const ly = pad.axes[1] ?? 0;
      const stick = quantizeMove(lx, ly, STICK_DEADZONE);
      if (stick.moveMag > 0) move = stick;
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      const direct = preset.aim === 'right-stick' && Math.hypot(rx, ry) > AIM_DEADZONE;
      if (direct) {
        this.aimSource = 'gamepad';
        this.aim = quantizeAngle(Math.atan2(ry, rx));
      } else if (stick.moveMag > 0 && (this.aimSource === 'gamepad' || preset.aim === 'left-stick')) {
        // Soft lock: aim where you walk, snapped to the nearest enemy within the angle.
        this.aimSource = 'gamepad';
        this.aim = quantizeAngle(softLock(Math.atan2(ly, lx), ctx.enemies, ctx.softLockDeg));
      }
      const buttons = this.padButtons(pad);
      const down = (action: ControlAction) => buttonsFor(preset, action).some((i) => buttons[i] ?? false);
      const edge = (action: ControlAction) =>
        buttonsFor(preset, action).some((i) => (buttons[i] ?? false) && !(this.prevPadButtons[i] ?? false));
      if (edge('light')) this.latched |= Button.Light;
      if (edge('dodge')) this.latched |= Button.Dodge;
      if (edge('ability1')) this.latched |= Button.Ability1;
      if (ctx.encounter && edge('ability2')) this.latched |= Button.Ability2;
      if (ctx.encounter && edge('ability3')) this.latched |= Button.Ability3;
      if (edge('item1')) this.latched |= Button.Item1;
      if (edge('item2')) this.latched |= Button.Item2;
      if (down('heavy')) held = true;
      this.prevPadButtons = buttons;
    }

    if (this.aimSource === 'mouse' && this.pointer) {
      const p = this.scene.input.activePointer;
      if (p.worldX !== px || p.worldY !== py) this.aim = quantizeAngle(Math.atan2(p.worldY - py, p.worldX - px));
    }

    const input: TickInput = {
      aim: this.aim,
      ...move,
      buttons: this.latched | (held ? Button.Heavy : 0),
    };
    this.latched = 0;
    this.lastInput = input;
    return encodeInput(input);
  }

  /** Any "confirm" press this frame (menus): Enter, Space or gamepad Cross/Start. */
  static confirmPressed(prev: { pad: boolean }): boolean {
    const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    const now = Boolean(pad && ((pad.buttons[0]?.pressed ?? false) || (pad.buttons[9]?.pressed ?? false)));
    const edge = now && !prev.pad;
    prev.pad = now;
    return edge;
  }
}
