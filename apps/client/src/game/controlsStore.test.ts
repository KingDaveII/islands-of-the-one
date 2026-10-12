import { afterEach, describe, expect, it, vi } from 'vitest';

/** A minimal localStorage for node. */
function fakeStorage(
  initial: Record<string, string> = {},
): Storage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => {
      data.delete(k);
    },
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

/**
 * The remembered gamepad preset is its id only, never its bindings: a saved
 * choice always resolves to the current data, so a preset whose buttons
 * changed in controls.json (Playtest 2 moved the Triggers layout) never
 * replays old bindings from localStorage.
 */
describe('controls store persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('stores only the preset id, and resolves it against the current data', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.resetModules();
    const { controlsStore } = await import('./controlsStore.js');
    controlsStore.set('left-stick');
    expect([...storage.data]).toEqual([['iot.controls.preset', 'left-stick']]);
    expect(controlsStore.get().bindings.light).toBe('R1');
    controlsStore.set('triggers');
  });

  it('loads a remembered id with the bindings from the data file, and falls back on an unknown or stale value', async () => {
    vi.stubGlobal('localStorage', fakeStorage({ 'iot.controls.preset': 'left-stick' }));
    vi.resetModules();
    let { controlsStore } = await import('./controlsStore.js');
    expect(controlsStore.get().id).toBe('left-stick');
    expect(controlsStore.get().bindings).toMatchObject({
      light: 'R1',
      heavy: 'R2',
      ability1: 'L2',
      dodge: 'L1',
    });

    vi.stubGlobal('localStorage', fakeStorage({ 'iot.controls.preset': '{"light":"R2"}' }));
    vi.resetModules();
    ({ controlsStore } = await import('./controlsStore.js'));
    expect(controlsStore.get().id).toBe('triggers');
  });
});
