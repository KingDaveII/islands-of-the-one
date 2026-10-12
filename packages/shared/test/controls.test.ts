import { describe, expect, it } from 'vitest';
import { controlsData } from '../src/index.js';

/**
 * controls.json: the gamepad presets and the keyboard bindings. A key or a
 * pad button may only be bound once per layout, so a press never has to
 * guess which action it means.
 */
type Binding = string | string[];

const bindingsOf = (table: Record<string, Binding>): [string, string][] =>
  Object.entries(table).flatMap(([action, b]) =>
    (Array.isArray(b) ? b : [b]).map((key): [string, string] => [action, key]),
  );

function duplicates(pairs: [string, string][]): string[] {
  const seen = new Map<string, string>();
  const out: string[] = [];
  for (const [action, key] of pairs) {
    const first = seen.get(key);
    if (first !== undefined) out.push(`${key} is bound to ${first} and ${action}`);
    else seen.set(key, action);
  }
  return out;
}

describe('controls.json', () => {
  it('binds every keyboard key to one action only', () => {
    expect(duplicates(bindingsOf(controlsData.keyboard))).toEqual([]);
  });

  it('binds every pad button to one action only in each preset', () => {
    for (const preset of controlsData.presets) {
      expect(duplicates(bindingsOf(preset.bindings)), preset.id).toEqual([]);
    }
  });

  it('has the keyboard layout from the design', () => {
    expect(controlsData.keyboard).toEqual({
      light: 'LMB',
      heavy: 'RMB',
      dodge: 'Space',
      ability1: '1',
      ability2: '2',
      ability3: '3',
      item1: 'Q',
      item2: 'F',
      interact: 'E',
      chartPeek: 'Tab',
      journal: 'J',
      menu: 'Esc',
      tuning: 'F2',
    });
  });

  it('names a default preset that exists, with unique ids, each binding every pad action', () => {
    const ids = controlsData.presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(controlsData.defaultPreset);
    const actions = Object.keys(controlsData.presets[0]?.bindings ?? {}).sort();
    for (const preset of controlsData.presets) {
      expect(Object.keys(preset.bindings).sort(), preset.id).toEqual(actions);
      for (const action of actions) expect(action in controlsData.keyboard, action).toBe(true);
    }
  });
});
