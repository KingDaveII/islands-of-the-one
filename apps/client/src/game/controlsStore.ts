import type { ControlPreset } from '@iot/shared';
import { DEFAULT_PRESET_ID, presetById, PRESETS } from './gamepad.js';

/**
 * The active gamepad preset, selectable in the controls screen and the F2
 * panel, remembered in localStorage. Keyboard/mouse bindings never change.
 */
const STORAGE_KEY = 'iot.controls.preset';
type Listener = (preset: ControlPreset) => void;

/** localStorage when the page has it (tests run in node without one). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function load(): string {
  return storage()?.getItem(STORAGE_KEY) ?? DEFAULT_PRESET_ID;
}

let current: ControlPreset = presetById(load());
const listeners: Listener[] = [];

export const controlsStore = {
  get(): ControlPreset {
    return current;
  },
  presets(): readonly ControlPreset[] {
    return PRESETS;
  },
  set(id: string): void {
    current = presetById(id);
    try {
      storage()?.setItem(STORAGE_KEY, current.id);
    } catch {
      // Private mode or storage disabled: the choice just doesn't persist.
    }
    for (const l of listeners) l(current);
  },
  /** Step to the next/previous preset in data order (wraps). */
  cycle(delta: number): void {
    const i = PRESETS.findIndex((p) => p.id === current.id);
    const n = PRESETS.length;
    controlsStore.set(PRESETS[(((i + delta) % n) + n) % n]?.id ?? DEFAULT_PRESET_ID);
  },
  subscribe(l: Listener): () => void {
    listeners.push(l);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
};
