import { describe, expect, it } from 'vitest';
import { deviceStore, DeviceTracker, MOUSE_SWITCH_PX, type PadSnapshot } from './activeDevice.js';

const pad = (buttons: number[] = [], stick = false): PadSnapshot => ({
  buttons: Array.from({ length: 17 }, (_, i) => buttons.includes(i)),
  stick,
});

describe('active device', () => {
  it('starts on the keyboard and switches on a pad button or a stick, back on a key or mouse button', () => {
    const t = new DeviceTracker();
    expect(t.device).toBe('keyboard');
    expect(t.pad(pad())).toBe(false);
    expect(t.pad(pad([5]))).toBe(true);
    expect(t.device).toBe('gamepad');
    expect(t.key()).toBe(true);
    expect(t.device).toBe('keyboard');
    expect(t.pad(pad([5]))).toBe(false); // still held: no new press
    expect(t.pad(pad([], true))).toBe(true);
    expect(t.device).toBe('gamepad');
  });

  it('a held button or a drifting stick is one event, never a flicker', () => {
    const t = new DeviceTracker();
    t.pad(pad([], true));
    expect(t.device).toBe('gamepad');
    t.key();
    for (let i = 0; i < 10; i++) expect(t.pad(pad([], true))).toBe(false);
    expect(t.device).toBe('keyboard');
    // The stick has to go back to center and out again.
    t.pad(pad([], false));
    expect(t.pad(pad([], true))).toBe(true);
  });

  it('mouse motion switches back only once it adds up past the threshold since the last pad activity', () => {
    const t = new DeviceTracker();
    t.pad(pad([0]));
    expect(t.mouseMove(1, 0)).toBe(false);
    expect(t.mouseMove(2, 2)).toBe(false);
    // Pad activity resets the motion counted so far.
    t.pad(pad([0, 1]));
    expect(t.mouseMove(MOUSE_SWITCH_PX - 1, 0)).toBe(false);
    expect(t.device).toBe('gamepad');
    expect(t.mouseMove(0, 1)).toBe(true);
    expect(t.device).toBe('keyboard');
    // On the keyboard already: motion changes nothing.
    expect(t.mouseMove(100, 100)).toBe(false);
  });

  it('a pad going away hands the device back to the keyboard', () => {
    const t = new DeviceTracker();
    t.pad(pad([2]));
    expect(t.device).toBe('gamepad');
    expect(t.pad(null)).toBe(true);
    expect(t.device).toBe('keyboard');
    expect(t.pad(null)).toBe(false);
    // Reconnected with the same button held counts as a press.
    expect(t.pad(pad([2]))).toBe(true);
  });

  it('the store notifies subscribers on a change only', () => {
    const seen: string[] = [];
    const off = deviceStore.subscribe((d) => seen.push(d));
    deviceStore.key();
    deviceStore.pad(pad([0]));
    deviceStore.pad(pad([0]));
    deviceStore.mouseMove(MOUSE_SWITCH_PX, 0);
    deviceStore.mouseMove(MOUSE_SWITCH_PX, 0);
    off();
    deviceStore.pad(pad([], true));
    deviceStore.key();
    expect(seen).toEqual(['gamepad', 'keyboard']);
    expect(deviceStore.get()).toBe('keyboard');
  });
});
