import type Phaser from 'phaser';
import type { ControlAction, ControlPreset } from '@iot/shared';
import { Button, encodeInput, type InputContext, type TickInput } from '@iot/sim';
import { deviceStore } from './activeDevice.js';
import { controlsStore } from './controlsStore.js';
import {
  buttonsFor,
  connectedPad,
  hintFrom,
  padButtonsDown,
  padFamily,
  softLockPick,
  type Hint,
  type HintSource,
  type LockCandidate,
} from './gamepad.js';
import { KEYBOARD_ACTIONS, keyboardKeys, keyCodeFor, MOUSE_BUTTONS, mouseBindingFor, type MouseSide } from './keyboard.js';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';
import { touchSample, type TouchInput, type TouchPress } from './touchInput.js';
import { TOUCH } from './touchLayout.js';

/** The left stick's deadzone, the pad's and the touch stick's (controls.md §6). */
export const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;

export type AimSource = 'mouse' | 'gamepad' | 'touch';

/**
 * Where the reticle goes: on the mouse pointer in mouse mode (null until the
 * mouse has moved; sim px, read through the world camera), or along the pad
 * aim in pad and touch mode, on the soft-locked Husk when there is one
 * (`targetId`); on touch, while a button is dragged, the aim line's length
 * (`line`, world px; 0 for none).
 */
export type Reticle =
  | { kind: 'mouse'; x: number; y: number }
  | { kind: 'pad'; aim: number; targetId: number | null; line?: number };

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

/** The sim button each touch press sets (USE is interact). */
const TOUCH_BUTTON: Record<TouchPress, number> = {
  light: Button.Light,
  dodge: Button.Dodge,
  ability1: Button.Ability1,
  ability2: Button.Ability2,
  ability3: Button.Ability3,
  item1: Button.Item1,
  item2: Button.Item2,
  interact: Button.Interact,
};

/** Keys whose browser default (scrolling, moving focus) must not fire while a run is on. */
const CAPTURED_KEYS: ReadonlySet<string> = new Set(['Space', 'Tab']);

/** A pointer's position in the world, sim px: read through the world camera (the UI camera is on top of it). */
export type PointerToSim = (pointer: Phaser.Input.Pointer) => { x: number; y: number };

/** What the sampler needs to know about the world this tick. */
export interface SampleContext {
  /** Enemy offsets from the player, sim px, with their ids (for the soft lock and its reticle). */
  enemies: readonly LockCandidate[];
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
  /** The Husk the soft lock snapped the latest pad aim to, or -1. */
  private lockTargetId = -1;
  private prevPadButtons: boolean[] = [];
  private moveKeys: Record<string, Phaser.Input.Keyboard.Key>;
  /** Phaser keys by binding name, for every key any action names in any context. */
  private keys = new Map<string, Phaser.Input.Keyboard.Key>();
  private mouseDown: Record<MouseSide, boolean> = { left: false, middle: false, right: false };
  /** DOM listeners on the canvas that stop the browser's middle-click autoscroll; removed on dispose. */
  private readonly domListeners: [string, (e: Event) => void][] = [];
  /** The context the latest sample resolved presses with (hints follow it). */
  context: InputContext = 'calm';
  /** Whether the mouse has moved over the canvas since the run started (the reticle waits for it). */
  private pointerMoved = false;
  private captured: number[] = [];
  private padId = '';
  lastInput: TickInput = { aim: 0, moveDir: 0, moveMag: 0, buttons: 0 };
  gamepadConnected = false;
  /** The touch layer's input (ui/touchControls.ts), read like a pad while touch is the active device (M2 Task 10). */
  touch: TouchInput | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly pointerToSim: PointerToSim,
  ) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.moveKeys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', true) as Record<string, Phaser.Input.Keyboard.Key>;
    // Captured too: released in dispose(), or they'd stay swallowed in the menus' text inputs.
    this.captured.push(...Object.values(this.moveKeys).map((k) => k.keyCode));
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
    // A touch is the touch layer's (it reaches the sim through `touch`), never a mouse button.
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const binding = mouseBindingFor(p.button);
      const side = binding ? MOUSE_BUTTONS[binding] : undefined;
      if (!binding || !side) return;
      this.mouseDown[side] = true;
      this.latchedKeys.add(binding);
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      const binding = mouseBindingFor(p.button);
      const side = binding ? MOUSE_BUTTONS[binding] : undefined;
      if (side) this.mouseDown[side] = false;
    });
    // The middle button is a game button (the Haul): never the browser's autoscroll or a paste.
    const canvas = scene.game.canvas;
    const swallowMiddle = (e: Event): void => {
      if (e instanceof MouseEvent && e.button === 1) e.preventDefault();
    };
    for (const type of ['mousedown', 'auxclick'] as const) {
      canvas.addEventListener(type, swallowMiddle);
      this.domListeners.push([type, swallowMiddle]);
    }
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.pointerMoved = true;
    });
  }

  /** Release the key captures (Phaser keeps them past the scene). Call from the scene's shutdown. */
  dispose(): void {
    this.scene.input.keyboard?.removeCapture(this.captured);
    this.captured = [];
    for (const [type, fn] of this.domListeners) this.scene.game.canvas.removeEventListener(type, fn);
    this.domListeners.length = 0;
  }

  /** The active gamepad preset. */
  get preset(): ControlPreset {
    return controlsStore.get();
  }

  /** The aim follows the active device (docs/design/controls.md §5): the pad in pad mode, the buttons on touch, the mouse otherwise. */
  get aimSource(): AimSource {
    const device = deviceStore.get();
    if (device === 'touch' && this.touch) return 'touch';
    return device === 'gamepad' && this.gamepadConnected ? 'gamepad' : 'mouse';
  }

  /** Touch is the active device: the key and pad hints hide, the prompt shows its verb alone (controls.md §6). */
  get touchMode(): boolean {
    return deviceStore.get() === 'touch';
  }

  /** The soft lock's angle for the device in use: on touch the Left-stick preset's (GAME DESIGN), else the preset's. */
  softLockDeg(soft: { angleDeg: number; leftStickAngleDeg: number }): number {
    return this.aimSource === 'touch' || this.preset.aim === 'left-stick' ? soft.leftStickAngleDeg : soft.angleDeg;
  }

  /** Where hints come from: the pad preset (in the pad's glyph family) while the pad is the active device, else the keyboard. */
  hintSource(): HintSource {
    return this.aimSource === 'gamepad' ? { preset: this.preset, family: padFamily(this.padId) } : 'keyboard';
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

  /** Where to draw the reticle this frame (see Reticle), or null before the mouse has moved. */
  reticle(): Reticle | null {
    if (this.aimSource === 'gamepad') return { kind: 'pad', aim: this.aim, targetId: this.lockTargetId >= 0 ? this.lockTargetId : null };
    if (this.aimSource === 'touch')
      return {
        kind: 'pad',
        aim: this.aim,
        targetId: this.lockTargetId >= 0 ? this.lockTargetId : null,
        line: this.touch?.dragAim() !== null ? TOUCH.aimLinePx : 0,
      };
    if (!this.pointerMoved) return null;
    const p = this.pointerToSim(this.scene.input.activePointer);
    return { kind: 'mouse', x: p.x, y: p.y };
  }

  /** Build this tick's input. `px, py` is the player position in sim px. */
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
    // Holding light keeps attacking (GAME DESIGN, 2026-10-21): the sim chains a held light at the combo's own pace.
    if (this.held('light')) buttons |= Button.Light;
    this.latchedKeys.clear();

    const pad = connectedPad();
    this.gamepadConnected = Boolean(pad);
    const padMode = this.aimSource === 'gamepad';
    if (pad) {
      this.padId = pad.id;
      const preset = this.preset;
      const lx = pad.axes[0] ?? 0;
      const ly = pad.axes[1] ?? 0;
      const stick = quantizeMove(lx, ly, STICK_DEADZONE);
      if (stick.moveMag > 0) move = stick;
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      const direct = padMode && preset.aim === 'right-stick' && Math.hypot(rx, ry) > AIM_DEADZONE;
      if (direct) {
        this.aim = quantizeAngle(Math.atan2(ry, rx));
        this.lockTargetId = -1;
      } else if (padMode && stick.moveMag > 0) {
        // Soft lock: aim where you walk, snapped to the nearest enemy within the angle.
        const lock = softLockPick(Math.atan2(ly, lx), ctx.enemies, ctx.softLockDeg);
        this.aim = quantizeAngle(lock.angle);
        this.lockTargetId = lock.target?.id ?? -1;
      } else if (padMode && this.lockTargetId >= 0 && !ctx.enemies.some((e) => e.id === this.lockTargetId)) {
        // Standing still: the aim is kept, but a lock on a Husk that is gone lets go.
        this.lockTargetId = -1;
      }
      const padButtons = padButtonsDown(pad);
      const context = ctx.context;
      const down = (action: ControlAction) => buttonsFor(preset, action, context).some((i) => padButtons[i] ?? false);
      const edge = (action: ControlAction) =>
        buttonsFor(preset, action, context).some((i) => (padButtons[i] ?? false) && !(this.prevPadButtons[i] ?? false));
      // A button bound per context (Cross: dodge in Combat, interact in Calm) resolves to this tick's context only.
      for (const action of PRESS_ACTIONS) if (edge(action)) buttons |= PRESS_BUTTON[action] ?? 0;
      if (down('heavy')) held = true;
      if (down('light')) buttons |= Button.Light;
      this.prevPadButtons = padButtons;
    }

    const touch = this.touch;
    if (touch && this.aimSource === 'touch') {
      // Touch, like the pad: the stick moves, the buttons press and hold, a dragged button aims (touchInput.ts).
      const t = touchSample(touch, ctx.enemies, ctx.softLockDeg, STICK_DEADZONE, this.lockTargetId);
      if (t.move) {
        const stick = quantizeMove(t.move.x, t.move.y, STICK_DEADZONE);
        if (stick.moveMag > 0) move = stick;
      }
      for (const p of t.presses) buttons |= TOUCH_BUTTON[p];
      if (t.heavy) held = true;
      if (t.aim !== null) this.aim = quantizeAngle(t.aim);
      if (t.lockTarget !== undefined) this.lockTargetId = t.lockTarget;
    } else if (touch) {
      // Not the device: a touch layer's stray latches never fire later.
      touch.take();
    }

    if (this.aimSource === 'mouse') {
      this.lockTargetId = -1;
      if (this.pointerMoved) {
        const p = this.pointerToSim(this.scene.input.activePointer);
        if (p.x !== px || p.y !== py) this.aim = quantizeAngle(Math.atan2(p.y - py, p.x - px));
      }
    }

    const input: TickInput = {
      aim: this.aim,
      ...move,
      buttons: buttons | (held ? Button.Heavy : 0),
    };
    this.lastInput = input;
    return encodeInput(input);
  }

}
