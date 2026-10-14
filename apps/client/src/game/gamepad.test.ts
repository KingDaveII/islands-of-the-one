import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { controlsStore } from './controlsStore.js';
import {
  buttonsFor,
  DEFAULT_PRESET_ID,
  GLYPH_BUTTON,
  hintFor,
  hints,
  MENU_BUTTONS,
  padEdges,
  padEdgeState,
  presetById,
  PRESETS,
  softLock,
} from './gamepad.js';

const deg = (d: number) => (d * Math.PI) / 180;

describe('gamepad presets (data-driven)', () => {
  it('Triggers is the default: R1 light, R2 heavy (hold), L1 dodge, L2 Haul, faces for the rest', () => {
    expect(DEFAULT_PRESET_ID).toBe('triggers');
    const t = presetById('triggers');
    expect(buttonsFor(t, 'light', 'combat')).toEqual([GLYPH_BUTTON.R1]);
    expect(buttonsFor(t, 'heavy', 'calm')).toEqual([GLYPH_BUTTON.R2]);
    expect(buttonsFor(t, 'dodge', 'combat')).toEqual([GLYPH_BUTTON.L1]);
    expect(buttonsFor(t, 'dodge', 'calm')).toEqual([GLYPH_BUTTON.L1]);
    expect(buttonsFor(t, 'ability1', 'combat')).toEqual([GLYPH_BUTTON.L2]);
    expect([hintFor(t, 'ability2'), hintFor(t, 'ability3')]).toEqual(['Square', 'Triangle']);
    expect([hintFor(t, 'interact'), hintFor(t, 'chartPeek'), hintFor(t, 'journal')]).toEqual([
      'Cross',
      'Circle',
      'Down',
    ]);
    // Per context: Cross interacts in Calm only; abilities 2/3 on the face buttons fire in Combat only.
    expect(buttonsFor(t, 'interact', 'calm')).toEqual([GLYPH_BUTTON.Cross]);
    expect(buttonsFor(t, 'interact', 'combat')).toEqual([]);
    expect(buttonsFor(t, 'ability2', 'combat')).toEqual([GLYPH_BUTTON.Square]);
    expect(buttonsFor(t, 'ability2', 'calm')).toEqual([]);
    expect(hintFor(t, 'interact', 'combat')).toBe('');
    expect([hintFor(t, 'item1'), hintFor(t, 'item2')]).toEqual(['Left', 'Right']);
    expect(t.aim).toBe('right-stick');
  });

  it('Faces keeps the previous layout with its alternates; Left-stick aims with movement', () => {
    const f = presetById('faces');
    expect(buttonsFor(f, 'light', 'combat')).toEqual([GLYPH_BUTTON.Square]);
    expect(buttonsFor(f, 'heavy', 'combat')).toEqual([GLYPH_BUTTON.Triangle, GLYPH_BUTTON.R2]);
    // Cross dodges in Combat and interacts in Calm; L1 dodges in both.
    expect(buttonsFor(f, 'dodge', 'combat')).toEqual([GLYPH_BUTTON.Cross, GLYPH_BUTTON.L1]);
    expect(buttonsFor(f, 'dodge', 'calm')).toEqual([GLYPH_BUTTON.L1]);
    expect(buttonsFor(f, 'interact', 'calm')).toEqual([GLYPH_BUTTON.Cross]);
    expect(buttonsFor(f, 'interact', 'combat')).toEqual([]);
    expect(hintFor(f, 'dodge')).toBe('Cross/L1');
    expect(hintFor(f, 'dodge', 'calm')).toBe('L1');
    expect(hintFor(f, 'ability1')).toBe('Circle/R1');
    const l = presetById('left-stick');
    expect(l.aim).toBe('left-stick');
    expect(buttonsFor(l, 'light', 'combat')).toEqual(buttonsFor(presetById('triggers'), 'light', 'combat'));
    expect(buttonsFor(l, 'ability1', 'combat')).toEqual([GLYPH_BUTTON.L2]);
    expect(PRESETS.map((p) => p.id)).toEqual(['triggers', 'faces', 'left-stick']);
  });

  it('unknown ids fall back to the default; hints come from the keyboard or the preset', () => {
    expect(presetById('nope').id).toBe('triggers');
    expect(hints('keyboard')).toMatchObject({
      light: 'LMB',
      heavy: 'RMB',
      dodge: 'Space',
      item1: 'Q',
      item2: 'F',
      interact: 'E',
    });
    expect(hints('keyboard', 'combat').interact).toBe('');
    expect(hints(presetById('triggers'))).toMatchObject({ light: 'R1', heavy: 'R2', ability1: 'L2' });
    expect(hints('keyboard').ability1).toBe('MMB/1');
    expect(hints(presetById('triggers'), 'calm')).toMatchObject({ interact: 'Cross', ability2: '' });
  });
});

describe('preset switching', () => {
  it('the store switches presets, cycles in data order and notifies', () => {
    const seen: string[] = [];
    const off = controlsStore.subscribe((p) => seen.push(p.id));
    controlsStore.set('faces');
    expect(controlsStore.get().id).toBe('faces');
    controlsStore.cycle(1);
    expect(controlsStore.get().id).toBe('left-stick');
    controlsStore.cycle(1);
    expect(controlsStore.get().id).toBe('triggers');
    controlsStore.cycle(-1);
    expect(controlsStore.get().id).toBe('left-stick');
    controlsStore.set('bogus');
    expect(controlsStore.get().id).toBe('triggers');
    off();
    controlsStore.set('faces');
    expect(seen).toEqual(['faces', 'left-stick', 'triggers', 'left-stick', 'triggers']);
    controlsStore.set('triggers');
  });
});

describe('soft lock', () => {
  it('snaps the move direction to the nearest enemy within the angle, else keeps it', () => {
    const enemies = [
      { dx: 100, dy: 0 },
      { dx: 40 * Math.cos(deg(12)), dy: 40 * Math.sin(deg(12)) },
    ];
    // Walking right: both are within 15°, the one at 12° is nearer.
    expect(softLock(0, enemies, 15)).toBeCloseTo(deg(12), 5);
    // Within 10° only the far one on the line qualifies.
    expect(softLock(0, enemies, 10)).toBeCloseTo(0, 5);
    // Walking up: nothing within 15°, aim stays the move direction.
    expect(softLock(-Math.PI / 2, enemies, 15)).toBe(-Math.PI / 2);
    // 20° (the Left-stick preset) catches an enemy 18° off.
    const off18 = [{ dx: 50 * Math.cos(deg(18)), dy: 50 * Math.sin(deg(18)) }];
    expect(softLock(0, off18, 15)).toBe(0);
    expect(softLock(0, off18, 20)).toBeCloseTo(deg(18), 5);
  });

  it('wraps around the angle seam and ignores an enemy on top of the player', () => {
    const left = [{ dx: -60, dy: 1 }];
    expect(softLock(-Math.PI + 0.1, left, 15)).toBeCloseTo(Math.atan2(1, -60), 5);
    expect(softLock(0, [{ dx: 0, dy: 0 }], 15)).toBe(0);
  });
});

describe('menu pad edges', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  const press = (i: number, down: boolean): void => {
    const b = buttons[i];
    if (b) b.pressed = down;
  };

  beforeEach(() => {
    for (const b of buttons) b.pressed = false;
    vi.stubGlobal('navigator', {
      getGamepads: () => [{ id: 'pad', connected: true, buttons, axes: [] }],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores the press that opened the menu until it is released', () => {
    press(MENU_BUTTONS.confirm[0], true);
    const state = padEdgeState();
    expect(padEdges(state)).toEqual([]);
    press(MENU_BUTTONS.confirm[0], false);
    expect(padEdges(state)).toEqual([]);
    press(MENU_BUTTONS.confirm[0], true);
    expect(padEdges(state)).toEqual([MENU_BUTTONS.confirm[0]]);
  });
});
