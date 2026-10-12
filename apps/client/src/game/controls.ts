import type Phaser from 'phaser';
import type { ControlAction, ControlPreset } from '@iot/shared';
import { Button, encodeInput, type TickInput } from '@iot/sim';
import { controlsStore } from './controlsStore.js';
import {
  buttonsFor,
  hintFrom,
  padFamily,
  softLock,
  TRIGGER_BUTTONS,
  TRIGGER_THRESHOLD,
  type Hint,
  type HintSource,
} from './gamepad.js';
import { KEYBOARD_ACTIONS, keyboardBinding, keyCodeFor, MOUSE_BUTTONS } from './keyboard.js';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';

const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;

export type AimSource = 'mouse' | 'gamepad';
type MouseSide = 'left' | 'right';

/** Sim button a press of an action latches; heavy is a held state and the rest have no sim button yet. */
const PRESS_BUTTON: Partial<Record<ControlAction, number>> = {
  light: Button.Light,
  dodge: Button.Dodge,
  ability1: Button.Ability1,
  ability2: Button.Ability2,
  ability3: Button.Ability3,
  item1: Button.Item1,
  item2: Button.Item2,
};

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
 * none are lost when a frame runs zero or several sim steps. Every binding is
 * data (controls.json): the gamepad's from the active preset, the keyboard's
 * and mouse's from the `keyboard` block.
 */
export class Controls {
  private latched = 0;
  private aim = 0;
  private aimSource: AimSource = 'mouse';
  private prevPadButtons: boolean[] = [];
  private moveKeys: Record<string, Phaser.Input.Keyboard.Key>;
  private actionKeys: Partial<Record<ControlAction, Phaser.Input.Keyboard.Key>> = {};
  private mouseActions: Partial<Record<MouseSide, ControlAction>> = {};
  private mouseDown: Record<MouseSide, boolean> = { left: false, right: false };
  private pointer: { x: number; y: number } | null = null;
  private padId = '';
  lastInput: TickInput = { aim: 0, moveDir: 0, moveMag: 0, buttons: 0 };
  gamepadConnected = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.moveKeys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', true) as Record<string, Phaser.Input.Keyboard.Key>;
    const press = (bit: number) => () => {
      this.latched |= bit;
    };
    for (const action of KEYBOARD_ACTIONS) {
      const binding = keyboardBinding(action);
      const side = MOUSE_BUTTONS[binding];
      if (side) {
        this.mouseActions[side] = action;
        continue;
      }
      const code = keyCodeFor(binding);
      if (code === undefined) continue;
      // Captured keys (Tab, F2, Space) never reach the browser's defaults.
      const key = kb.addKey(code, true);
      this.actionKeys[action] = key;
      const bit = PRESS_BUTTON[action];
      if (bit !== undefined) key.on('down', press(bit));
    }

    scene.input.mouse?.disableContextMenu();
    const side = (p: Phaser.Input.Pointer): MouseSide | null => (p.button === 0 ? 'left' : p.button === 2 ? 'right' : null);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = side(p);
      if (!s) return;
      this.mouseDown[s] = true;
      const action = this.mouseActions[s];
      const bit = action ? PRESS_BUTTON[action] : undefined;
      if (bit !== undefined) this.latched |= bit;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const s = side(p);
      if (s) this.mouseDown[s] = false;
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

  /** Where hints come from: the pad preset (in the pad's glyph family) while a pad is connected, else the keyboard. */
  hintSource(): HintSource {
    return this.gamepadConnected ? { preset: this.preset, family: padFamily(this.padId) } : 'keyboard';
  }

  /** The hint for an action from the device in use. */
  hint(action: ControlAction): Hint {
    return hintFrom(this.hintSource(), action);
  }

  /** Whether an action's keyboard key or mouse button is down right now (held actions: heavy, chart peek). */
  held(action: ControlAction): boolean {
    if (this.actionKeys[action]?.isDown) return true;
    for (const s of ['left', 'right'] as const) if (this.mouseActions[s] === action && this.mouseDown[s]) return true;
    return false;
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
    const k = this.moveKeys;
    let move = keyboardMove(
      Boolean(k.A?.isDown || k.LEFT?.isDown),
      Boolean(k.D?.isDown || k.RIGHT?.isDown),
      Boolean(k.W?.isDown || k.UP?.isDown),
      Boolean(k.S?.isDown || k.DOWN?.isDown),
    );
    let held = this.held('heavy');

    const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    this.gamepadConnected = Boolean(pad);
    if (pad) {
      this.padId = pad.id;
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
