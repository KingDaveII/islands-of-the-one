/**
 * The one "active device" of the client: keyboard+mouse or gamepad. Every
 * binding shown anywhere (HUD, start, controls and results screens) and the
 * reticle follow it live (docs/design/controls.md §5). It switches on any
 * key or mouse button, on mouse movement past a few px, and on any pad
 * button or a stick deflected past its deadzone. Hysteresis so it never
 * flickers: mouse motion only counts once it adds up to `MOUSE_SWITCH_PX`
 * since the last pad activity, and a stick that stays deflected (drift) is
 * one event, not one per frame. Pure, so it is tested in node; main.ts feeds
 * it from DOM events and a per-frame pad poll.
 */
export type Device = 'keyboard' | 'gamepad';

/** Screen (CSS) px of mouse motion that take the device back from the pad. */
export const MOUSE_SWITCH_PX = 8;
/** Stick deflection that counts as use. */
export const PAD_STICK_DEADZONE = 0.2;

/** What the tracker reads from a pad each frame: buttons down, and whether any stick is deflected. */
export interface PadSnapshot {
  buttons: boolean[];
  stick: boolean;
}

export class DeviceTracker {
  device: Device = 'keyboard';
  private mouseAcc = 0;
  private prevButtons: boolean[] = [];
  private prevStick = false;

  private set(device: Device): boolean {
    this.mouseAcc = 0;
    if (device === this.device) return false;
    this.device = device;
    return true;
  }

  /** A key or mouse button went down. Returns true when the device changed. */
  key(): boolean {
    return this.set('keyboard');
  }

  /** The mouse moved by (dx, dy) screen px. Switches once the motion since the last pad activity passes the threshold. */
  mouseMove(dx: number, dy: number): boolean {
    if (this.device === 'keyboard') return false;
    this.mouseAcc += Math.abs(dx) + Math.abs(dy);
    if (this.mouseAcc < MOUSE_SWITCH_PX) return false;
    return this.set('keyboard');
  }

  /**
   * One frame of the pad (null when none is connected). A button going down
   * or a stick leaving its deadzone switches to the pad; a pad going away
   * switches back to the keyboard.
   */
  pad(pad: PadSnapshot | null): boolean {
    if (!pad) {
      this.prevButtons = [];
      this.prevStick = false;
      return this.device === 'gamepad' ? this.set('keyboard') : false;
    }
    const buttonEdge = pad.buttons.some((down, i) => down && !(this.prevButtons[i] ?? false));
    const stickEdge = pad.stick && !this.prevStick;
    this.prevButtons = pad.buttons;
    this.prevStick = pad.stick;
    if (!buttonEdge && !stickEdge) return false;
    return this.set('gamepad');
  }
}

type Listener = (device: Device) => void;
const tracker = new DeviceTracker();
const listeners: Listener[] = [];

function notify(changed: boolean): void {
  if (!changed) return;
  for (const l of listeners) l(tracker.device);
}

/** The client-wide active device, with the tracker's inputs and a subscription for things that show bindings. */
export const deviceStore = {
  get(): Device {
    return tracker.device;
  },
  key(): void {
    notify(tracker.key());
  },
  mouseMove(dx: number, dy: number): void {
    notify(tracker.mouseMove(dx, dy));
  },
  pad(pad: PadSnapshot | null): void {
    notify(tracker.pad(pad));
  },
  subscribe(l: Listener): () => void {
    listeners.push(l);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
};
