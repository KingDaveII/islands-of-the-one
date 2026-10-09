import type Phaser from 'phaser';
import { Button, encodeInput, type TickInput } from '@iot/sim';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';

const STICK_DEADZONE = 0.2;
const AIM_DEADZONE = 0.35;

/** Standard-mapping gamepad buttons. */
const Pad = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7 } as const;

export type AimSource = 'mouse' | 'gamepad';

/** Key hints shown in the HUD. Placeholders until the controls are final. */
export const KEY_HINTS = {
  light: 'LMB',
  heavy: 'RMB',
  dodge: 'SPC',
  abilities: ['Q', 'E', 'R'],
} as const;

/**
 * Collects keyboard, mouse and gamepad (browser Gamepad API) input and turns
 * it into one packed sim input per tick. Presses are latched between ticks so
 * none are lost when a frame runs zero or several sim steps.
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
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,J,K,Q,E,R,SPACE,SHIFT', true) as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    const press = (bit: number) => () => {
      this.latched |= bit;
    };
    this.keys.J?.on('down', press(Button.Light));
    this.keys.SPACE?.on('down', press(Button.Dodge));
    this.keys.SHIFT?.on('down', press(Button.Dodge));
    this.keys.Q?.on('down', press(Button.Ability1));
    this.keys.E?.on('down', press(Button.Ability2));
    this.keys.R?.on('down', press(Button.Ability3));

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

  /** World-space crosshair position (mouse), or null when aiming with a stick. */
  crosshair(): { x: number; y: number } | null {
    if (this.aimSource !== 'mouse' || !this.pointer) return null;
    const p = this.scene.input.activePointer;
    return { x: p.worldX, y: p.worldY };
  }

  private padButtons(pad: Gamepad): boolean[] {
    return pad.buttons.map((b, i) => (i === Pad.LT || i === Pad.RT ? b.value > 0.5 : b.pressed));
  }

  /** Build this tick's input. `px, py` is the player position in world pixels. */
  sample(px: number, py: number): number {
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
      const lx = pad.axes[0] ?? 0;
      const ly = pad.axes[1] ?? 0;
      const stick = quantizeMove(lx, ly, STICK_DEADZONE);
      if (stick.moveMag > 0) move = stick;
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > AIM_DEADZONE) {
        this.aimSource = 'gamepad';
        this.aim = quantizeAngle(Math.atan2(ry, rx));
      } else if (this.aimSource === 'gamepad' && stick.moveMag > 0) {
        // No right stick: aim where you walk.
        this.aim = quantizeAngle(Math.atan2(ly, lx));
      }
      const buttons = this.padButtons(pad);
      const edge = (i: number) => (buttons[i] ?? false) && !(this.prevPadButtons[i] ?? false);
      if (edge(Pad.X)) this.latched |= Button.Light;
      if (edge(Pad.A) || edge(Pad.LB)) this.latched |= Button.Dodge;
      if (edge(Pad.B) || edge(Pad.RB)) this.latched |= Button.Ability1;
      if ((buttons[Pad.Y] ?? false) || (buttons[Pad.RT] ?? false)) held = true;
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

  /** Any "confirm" press this frame (menus): Enter, Space or gamepad A/Start. */
  static confirmPressed(prev: { pad: boolean }): boolean {
    const pad = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    const now = Boolean(pad && ((pad.buttons[Pad.A]?.pressed ?? false) || (pad.buttons[9]?.pressed ?? false)));
    const edge = now && !prev.pad;
    prev.pad = now;
    return edge;
  }
}
