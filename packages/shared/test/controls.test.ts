import { describe, expect, it } from 'vitest';
import {
  bindingContexts,
  bindingKeys,
  bindingKeysAll,
  controlsData,
  INPUT_CONTEXTS,
  isContextual,
  type BindingContext,
  type ControlBinding,
} from '../src/index.js';

/**
 * controls.json: the gamepad presets and the keyboard bindings. A key or a
 * pad button may map to one action only per input context (Combat, Calm)
 * in each layout, so a press never has to guess which action it means; a
 * key bound in both contexts must map to exactly one action in each.
 */
const bindingsOf = (table: Record<string, ControlBinding>, context: BindingContext): [string, string][] =>
  Object.entries(table).flatMap(([action, b]) => bindingKeys(b, context).map((key): [string, string] => [action, key]));

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

const KEYBOARD: Record<string, ControlBinding> = controlsData.keyboard;

describe('binding helpers', () => {
  it('reads plain, list and per-context bindings', () => {
    expect(bindingKeys('R2', 'combat')).toEqual(['R2']);
    expect(bindingKeys(['Cross', 'L1'], 'calm')).toEqual(['Cross', 'L1']);
    expect(bindingKeys({ combat: ['Cross', 'L1'], calm: 'L1' }, 'combat')).toEqual(['Cross', 'L1']);
    expect(bindingKeys({ combat: ['Cross', 'L1'], calm: 'L1' }, 'calm')).toEqual(['L1']);
    expect(bindingKeys({ calm: 'E' }, 'combat')).toEqual([]);
    expect(bindingKeys(undefined, 'calm')).toEqual([]);
    expect(bindingKeysAll({ combat: ['Cross', 'L1'], calm: 'L1' })).toEqual(['Cross', 'L1']);
    expect(bindingContexts('Space')).toEqual(['combat', 'calm']);
    expect(bindingContexts({ calm: 'E' })).toEqual(['calm']);
    expect(isContextual({ calm: 'E' })).toBe(true);
    expect(isContextual(['A', 'B'])).toBe(false);
    expect(isContextual('A')).toBe(false);
  });
});

describe('controls.json', () => {
  it('binds every keyboard key to one action only per context', () => {
    for (const context of INPUT_CONTEXTS) expect(duplicates(bindingsOf(KEYBOARD, context)), context).toEqual([]);
  });

  it('one action per input per context in each preset', () => {
    for (const preset of controlsData.presets) {
      const table: Record<string, ControlBinding> = preset.bindings;
      for (const context of INPUT_CONTEXTS) {
        expect(duplicates(bindingsOf(table, context)), `${preset.id} / ${context}`).toEqual([]);
      }
    }
  });

  it('a key bound in both contexts maps to exactly one action in each', () => {
    const tables: [string, Record<string, ControlBinding>][] = [
      ['keyboard', KEYBOARD],
      ...controlsData.presets.map((p): [string, Record<string, ControlBinding>] => [p.id, p.bindings]),
    ];
    for (const [name, table] of tables) {
      const actionsOf = (key: string, context: BindingContext) =>
        bindingsOf(table, context)
          .filter(([, k]) => k === key)
          .map(([a]) => a);
      const keys = new Set(Object.values(table).flatMap((b) => bindingKeysAll(b)));
      for (const key of keys) {
        const combat = actionsOf(key, 'combat');
        const calm = actionsOf(key, 'calm');
        expect(combat.length, `${name}: ${key} in combat`).toBeLessThanOrEqual(1);
        expect(calm.length, `${name}: ${key} in calm`).toBeLessThanOrEqual(1);
        expect(combat.length + calm.length, `${name}: ${key} is bound nowhere`).toBeGreaterThan(0);
      }
    }
  });

  it('has the keyboard layout from the design: E interacts in Calm only, Space dodges in both contexts, Haul on the middle mouse button', () => {
    expect(controlsData.keyboard).toEqual({
      light: 'LMB',
      heavy: 'RMB',
      dodge: 'Space',
      ability1: ['MMB', '1'],
      ability2: '2',
      ability3: '3',
      item1: 'Q',
      item2: 'F',
      interact: { calm: 'E' },
      rotate: 'R',
      chartPeek: 'Tab',
      journal: 'J',
      inventory: 'I',
      menu: 'Esc',
      controls: 'C',
      tuning: 'F2',
      debug: 'F3',
    });
    expect(bindingKeys(KEYBOARD.interact, 'combat')).toEqual([]);
    // No stop binding (GAME DESIGN 2026-10-18): stopping the holding's action is on the chip and in the station panel.
    expect(Object.keys(controlsData.keyboard)).not.toContain('stopAction');
    for (const preset of controlsData.presets) expect(Object.keys(preset.bindings), preset.id).not.toContain('stopAction');
    expect(bindingKeys(KEYBOARD.dodge, 'combat')).toEqual(['Space']);
    expect(bindingKeys(KEYBOARD.dodge, 'calm')).toEqual(['Space']);
    // The middle mouse button first (the glyph the hints show), 1 as the alternate.
    expect(bindingKeys(KEYBOARD.ability1, 'combat')).toEqual(['MMB', '1']);
  });

  it('rotates a ghost with R on the keyboard and Triangle in Calm on the pad, where Triangle is free (M2 Task 6); Faces keeps it for heavy, so rotate is unbound there', () => {
    expect(bindingKeysAll(KEYBOARD.rotate)).toEqual(['R']);
    expect(bindingKeys(KEYBOARD.rotate, 'combat')).toEqual(['R']);
    for (const id of ['triggers', 'left-stick']) {
      const preset = controlsData.presets.find((p) => p.id === id);
      const b: Record<string, ControlBinding> = preset?.bindings ?? {};
      expect(bindingKeys(b.rotate, 'calm'), id).toEqual(['Triangle']);
      expect(bindingKeys(b.rotate, 'combat'), id).toEqual([]);
    }
    const faces = controlsData.presets.find((p) => p.id === 'faces');
    const b: Record<string, ControlBinding> = faces?.bindings ?? {};
    expect(bindingKeysAll(b.rotate)).toEqual([]);
    expect(bindingKeys(b.heavy, 'calm')).toContain('Triangle');
  });

  it('opens the inventory with I on the keyboard and the Touchpad on every pad preset (M2 Task 3a)', () => {
    expect(bindingKeysAll(KEYBOARD.inventory)).toEqual(['I']);
    for (const preset of controlsData.presets) {
      const b: Record<string, ControlBinding> = preset.bindings;
      expect(bindingKeysAll(b.inventory), preset.id).toEqual(['Touchpad']);
    }
  });

  it('Triggers and Left-stick (Playtest 2): R1 light, R2 heavy, L2 Haul, L1 dodge', () => {
    for (const id of ['triggers', 'left-stick']) {
      const preset = controlsData.presets.find((p) => p.id === id);
      const b: Record<string, ControlBinding> = preset?.bindings ?? {};
      expect([b.light, b.heavy, b.ability1, b.dodge], id).toEqual(['R1', 'R2', 'L2', 'L1']);
    }
  });

  it('Faces: Cross dodges in Combat and interacts in Calm; L3 is unbound', () => {
    const faces = controlsData.presets.find((p) => p.id === 'faces');
    const b: Record<string, ControlBinding> = faces?.bindings ?? {};
    expect(bindingKeys(b.dodge, 'combat')).toEqual(['Cross', 'L1']);
    expect(bindingKeys(b.dodge, 'calm')).toEqual(['L1']);
    expect(bindingKeys(b.interact, 'calm')).toEqual(['Cross']);
    expect(bindingKeys(b.interact, 'combat')).toEqual([]);
    expect(Object.values(b).flatMap((x) => bindingKeysAll(x))).not.toContain('L3');
  });

  it('Triggers and Left-stick: interact = Cross in Calm only; abilities 2/3 on buttons fire in Combat only', () => {
    for (const id of ['triggers', 'left-stick']) {
      const preset = controlsData.presets.find((p) => p.id === id);
      const b: Record<string, ControlBinding> = preset?.bindings ?? {};
      expect(bindingKeys(b.interact, 'calm'), id).toEqual(['Cross']);
      expect(bindingKeys(b.interact, 'combat'), id).toEqual([]);
      expect(bindingsOf(b, 'combat').some(([, k]) => k === 'Cross'), `${id}: Cross in combat`).toBe(false);
    }
    for (const preset of controlsData.presets) {
      const b: Record<string, ControlBinding> = preset.bindings;
      for (const action of ['ability2', 'ability3']) {
        expect(bindingContexts(b[action]), `${preset.id}: ${action}`).toEqual(['combat']);
      }
    }
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
