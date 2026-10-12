import type Phaser from 'phaser';
import type { ControlAction, ControlPreset } from '@iot/shared';
import { Button, encodeInput, type InputContext, type TickInput } from '@iot/sim';
import { controlsStore } from './controlsStore.js';
import {
  buttonsFor,
  connectedPad,
  hintFrom,
  padFamily,
  softLock,
  TRIGGER_BUTTONS,
  TRIGGER_THRESHOLD,
  type Hint,
  type HintSource,
} from './gamepad.js';
import { KEYBOARD_ACTIONS, keyboardKeys, keyCodeFor, MOUSE_BUTTONS } from './keyboard.js';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';

const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;

export type AimSource = 'mouse' | 'gamepad';
type MouseSide = 'left' | 'right';

/** Sim button a press of an action sets; heavy is a held state and the rest (chart peek, journal) have no sim button yet. */
const PRESS_BUTTON: Partial<Record<ControlAction, number>> = {
  light: Button.Light,
  dodge: Button.Dodge,
  ability1: Button.Ability1,
  ability2: Button.Ability2,
  ability3: Button.Ability3,
  item1: Button.Item1,
  item2: Button.Item2,
  interact: Button.Interact,
};
const PRESS_ACTIONS = Object.keys(PRESS_BUTTON) as ControlAction[];

/** Keys whose browser default (scrolling, moving focus) must not fire while a run is on. */
const CAPTURED_KEYS: ReadonlySet<string> = new Set(['Space', 'Tab']);

/** What the sampler needs to know about the world this tick. */
export interface SampleContext {
  /** Enemy offsets from the player, world px (for the soft lock). */
  enemies: readonly { dx: number; dy: number }[];
  /** The sim's input context: a binding marked per context fires only in its own. */
  context: InputContext;
  /** Soft-lock angle for the active preset, degrees. */
  softLockDeg: number;
}

/**
 * Collects keyboard, mouse and gamepad (browser Gamepad API) input and turns
 * it into one packed sim input per tick. Presses are latched between ticks so
 * none are lost when a frame runs zero or several sim steps, and resolved to
 * an action at the tick with the input context the sim reports (Combat or
 * Calm, docs/design/controls.md), so the sim's input log holds the resolved
 * action and replays never need the context. Every binding is data
 * (controls.json): the gamepad's from the active preset, the keyboard's and
 * mouse's from the `keyboard` block.
 */
export class Controls {
  /** Key and mouse-button names pressed since the last sample (resolved there). */
  private latchedKeys = new Set<string>();
  private aim = 0;
  private aimSource: AimSource = 'mouse';
  private prevPadButtons: boolean[] = [];
  private moveKeys: Record<string, Phaser.Input.Keyboard.Key>;
  /** Phaser keys by binding name, for every key any action names in any context. */
  private keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private mouseDown: Record<MouseSide, boolean> = { left: false, right: false };
  /** The context the latest sample resolved presses with (hints follow it). */
  context: InputContext = 'calm';
  private pointer: { x: number; y: number } | null = null;
  private captured: number[] = [];
  private padId = '';
  lastInput: TickInput = { aim: 0, moveDir: 0, moveMag: 0, buttons: 0 };
  gamepadConnected = false;

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.moveKeys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', true) as Record<string, Phaser.Input.Keyboard.Key>;
    for (const action of KEYBOARD_ACTIONS) {
      for (const binding of keyboardKeys(action)) {
        if (MOUSE_BUTTONS[binding] || this.keys.has(binding)) continue;
        const code = keyCodeFor(binding);
        if (code === undefined) continue;
        const capture = CAPTURED_KEYS.has(binding);
        if (capture) this.captured.push(code);
        const key = kb.addKey(code, capture);
        this.keys.set(binding, key);
        if (PRESS_BUTTON[action] !== undefined) {
          key.on('down', () => {
            this.latchedKeys.add(binding);
          });
        }
      }
    }

    scene.input.mouse?.disableContextMenu();
    const side = (p: Phaser.Input.Pointer): MouseSide | null => (p.button === 0 ? 'left' : p.button === 2 ? 'right' : null);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = side(p);
      if (!s) return;
      this.mouseDown[s] = true;
      this.latchedKeys.add(s === 'left' ? 'LMB' : 'RMB');
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

  /** Release the key captures (Phaser keeps them past the scene). Call from the scene's shutdown. */
  dispose(): void {
    this.scene.input.keyboard?.removeCapture(this.captured);
    this.captured = [];
  }

  /** The active gamepad preset. */
  get preset(): ControlPreset {
    return controlsStore.get();
  }

  /** Where hints come from: the pad preset (in the pad's glyph family) while a pad is connected, else the keyboard. */
  hintSource(): HintSource {
    return this.gamepadConnected ? { preset: this.preset, family: padFamily(this.padId) } : 'keyboard';
  }

  /** The hint for an action from the device in use, in the current input context. */
  hint(action: ControlAction): Hint {
    return hintFrom(this.hintSource(), action, this.context);
  }

  /** Whether a key or mouse button is down right now, by binding name. */
  private keyDown(binding: string): boolean {
    const side = MOUSE_BUTTONS[binding];
    if (side) return this.mouseDown[side];
    return this.keys.get(binding)?.isDown ?? false;
  }

  /** Whether an action's keyboard key or mouse button is down right now in the current context (held actions: heavy, chart peek). */
  held(action: ControlAction): boolean {
    return keyboardKeys(action, this.context).some((k) => this.keyDown(k));
  }

  /** Whether a key bound to the action in the current context was pressed since the last sample. */
  private pressed(action: ControlAction): boolean {
    return keyboardKeys(action, this.context).some((k) => this.latchedKeys.has(k));
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
    this.context = ctx.context;
    const k = this.moveKeys;
    let move = keyboardMove(
      Boolean(k.A?.isDown || k.LEFT?.isDown),
      Boolean(k.D?.isDown || k.RIGHT?.isDown),
      Boolean(k.W?.isDown || k.UP?.isDown),
      Boolean(k.S?.isDown || k.DOWN?.isDown),
    );
    let held = this.held('heavy');
    // Keyboard and mouse presses, resolved to actions with this tick's context.
    let buttons = 0;
    for (const action of PRESS_ACTIONS) if (this.pressed(action)) buttons |= PRESS_BUTTON[action] ?? 0;
    this.latchedKeys.clear();

    const pad = connectedPad();
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
      const padButtons = this.padButtons(pad);
      const context = ctx.context;
      const down = (action: ControlAction) => buttonsFor(preset, action, context).some((i) => padButtons[i] ?? false);
      const edge = (action: ControlAction) =>
        buttonsFor(preset, action, context).some((i) => (padButtons[i] ?? false) && !(this.prevPadButtons[i] ?? false));
      // A button bound per context (Cross: dodge in Combat, interact in Calm) resolves to this tick's context only.
      for (const action of PRESS_ACTIONS) if (edge(action)) buttons |= PRESS_BUTTON[action] ?? 0;
      if (down('heavy')) held = true;
      this.prevPadButtons = padButtons;
    }

    if (this.aimSource === 'mouse' && this.pointer) {
      const p = this.scene.input.activePointer;
      if (p.worldX !== px || p.worldY !== py) this.aim = quantizeAngle(Math.atan2(p.worldY - py, p.worldX - px));
    }

    const input: TickInput = {
      aim: this.aim,
      ...move,
      buttons: buttons | (held ? Button.Heavy : 0),
    };
    this.lastInput = input;
    return encodeInput(input);
  }

  /** Any "confirm" press this frame (menus): Enter, Space or gamepad Cross/Start. */
  static confirmPressed(prev: { pad: boolean }): boolean {
    const pad = connectedPad();
    const now = Boolean(pad && ((pad.buttons[0]?.pressed ?? false) || (pad.buttons[9]?.pressed ?? false)));
    const edge = now && !prev.pad;
    prev.pad = now;
    return edge;
  }
}
