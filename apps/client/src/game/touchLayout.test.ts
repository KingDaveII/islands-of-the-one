import { defaultTuning, measureText, silkscreenFont } from '@iot/shared';
import { MOVE_DIRS, MOVE_MAG_MAX } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { hudRects, toastTextWidth } from './holdingView.js';
import { runHudRects } from './runHud.js';
import {
  ABILITY_CONTROLS,
  controlAt,
  controlPx,
  isTap,
  stickKnob,
  stickVector,
  TOUCH,
  touchLayout,
  touchScreen,
  touchZone,
  type TouchLayout,
  type TouchMode,
} from './touchLayout.js';
import { quantizeMove } from './quantize.js';
import { deviceSize, fitUi, fitWorldView, viewInUi, type Rect } from './view.js';

/** The four test screens (M2 Task 10): CSS size and device pixel ratio. */
const SCREENS: [name: string, w: number, h: number, dpr: number][] = [
  ['iPhone landscape 844×390 @ 3', 844, 390, 3],
  ['Android 915×412 @ 2.6', 915, 412, 2.6],
  ['tablet 1180×820 @ 2', 1180, 820, 2],
  ['small phone 667×375 @ 2', 667, 375, 2],
];

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A screen's UI grid, the world view's frame on it, and the HUD's panels in each mode (the panels' own pure math). */
function setup(w: number, h: number, dpr: number) {
  const d = deviceSize(w, h, dpr);
  const screen = touchScreen(d.w, d.h, d.dpr);
  const frame = viewInUi(fitWorldView(d.w, d.h, defaultTuning.view), fitUi(d.w, d.h).zU);
  const label = (t: string): number => measureText(silkscreenFont, t);
  const holding = hudRects(frame, {
    gin: label('9999'),
    pack: label('PACK 20/20'),
    name: label('WWWWWWWWWWWW'),
    letters: 60,
    chip: 60,
    toast: toastTextWidth(),
  });
  const run = runHudRects(frame, { hp: label('100'), room: label('ROOM 3/3'), spark: label('999'), abilities: 3 });
  const avoid: Record<TouchMode, Rect[]> = {
    holding: Object.values(holding),
    // The panels' drop shadow is a pixel below each.
    run: Object.values(run).map((r) => ({ ...r, h: r.h + 1 })),
  };
  return { screen, avoid };
}

function layoutFor(mode: TouchMode, w: number, h: number, dpr: number): { layout: TouchLayout; avoid: Rect[] } {
  const { screen, avoid } = setup(w, h, dpr);
  return { layout: touchLayout(screen, { mode, abilities: ABILITY_CONTROLS, avoid: avoid[mode] }), avoid: avoid[mode] };
}

describe('the touch block of controls.json', () => {
  it('keeps every control at least the minimum across, in a known corner', () => {
    expect(TOUCH.buttonMinCssPx).toBe(56);
    expect(TOUCH.stickRadiusCssPx).toBe(48);
    for (const [id, b] of Object.entries(TOUCH.buttons)) {
      expect(['br', 'tr', 'bl', 'tl'], id).toContain(b.corner);
      expect(b.size, id).toBeGreaterThanOrEqual(TOUCH.buttonMinCssPx);
    }
  });

  it('converts CSS px to whole UI px, never under the minimum', () => {
    expect(controlPx(56, 4 / 3)).toBe(42);
    expect(controlPx(56, 1)).toBe(56);
    expect(controlPx(40, 2)).toBe(28);
    expect(controlPx(80, 3 / 2.6)).toBe(70);
  });
});

describe.each(SCREENS)('the touch layout on the %s', (_name, w, h, dpr) => {
  for (const mode of ['run', 'holding'] as const) {
    it(`${mode}: every control at least 56 CSS px across, inside the screen, none overlapping another, the top centre or a HUD panel`, () => {
      const { layout, avoid } = layoutFor(mode, w, h, dpr);
      const { screen } = layout;
      expect(layout.controls.map((c) => c.id)).toEqual(
        mode === 'run' ? ['gear', 'item2', 'item1', 'light', 'heavy', 'dodge', 'ability1', 'ability2', 'ability3', 'use'] : ['gear', 'use'],
      );
      for (const c of layout.controls) {
        expect(Number.isInteger(c.size) && c.size === c.rect.w && c.size === c.rect.h, c.id).toBe(true);
        expect(c.size * screen.cssPerUi, c.id).toBeGreaterThanOrEqual(56 - 1e-9);
        expect([c.rect.x, c.rect.y].every(Number.isInteger), c.id).toBe(true);
        expect(c.rect.x >= 0 && c.rect.y >= 0 && c.rect.x + c.rect.w <= screen.w && c.rect.y + c.rect.h <= screen.h, c.id).toBe(true);
        expect(overlaps(c.rect, layout.topCentre), `${c.id} over the top centre`).toBe(false);
        for (const a of avoid) expect(overlaps(c.rect, a), `${c.id} over a HUD panel`).toBe(false);
        for (const o of layout.controls) if (o !== c) expect(overlaps(c.rect, o.rect), `${c.id} and ${o.id}`).toBe(false);
      }
      // The cluster is on the right, the gear and the item slots in the top half.
      for (const c of layout.controls) expect(c.cx, c.id).toBeGreaterThan(screen.w / 2);
      for (const id of ['gear', 'item1', 'item2']) {
        const c = layout.controls.find((k) => k.id === id);
        if (c) expect(c.cy, id).toBeLessThan(screen.h / 2);
      }
      expect(layout.stickRadius).toBe(Math.round(48 / screen.cssPerUi));
    });
  }

  it('the holding: USE sits over the pack button (or past it, in the margin), clear of the chip', () => {
    const { layout, avoid } = layoutFor('holding', w, h, dpr);
    const use = layout.controls.find((c) => c.id === 'use');
    const [, , chip, pack] = avoid as [Rect, Rect, Rect, Rect];
    if (!use) throw new Error('no use');
    expect(use.rect.y + use.rect.h <= pack.y || use.rect.x >= pack.x + pack.w).toBe(true);
    expect(use.rect.x).toBeGreaterThanOrEqual(chip.x + chip.w);
  });
});

describe('the sizes ART draws for (UI px on the four test screens)', () => {
  it('LIGHT is the largest button; the others in their sizes', () => {
    const table = SCREENS.map(([name, w, h, dpr]) => {
      const { layout } = layoutFor('run', w, h, dpr);
      const size = (id: string): number => layout.controls.find((c) => c.id === id)?.size ?? 0;
      return [name, size('light'), size('heavy'), size('dodge'), size('ability1'), size('gear'), layout.stickRadius];
    });
    // [screen, LIGHT, HEAVY, DODGE, an ability / USE, the gear and item slots, the stick's radius]
    expect(table).toEqual([
      ['iPhone landscape 844×390 @ 3', 60, 48, 42, 42, 42, 36],
      ['Android 915×412 @ 2.6', 70, 56, 49, 49, 49, 42],
      ['tablet 1180×820 @ 2', 40, 32, 28, 28, 28, 24],
      ['small phone 667×375 @ 2', 80, 64, 56, 56, 56, 48],
    ]);
    for (const row of table) expect(row[1]).toBeGreaterThan(row[2] as number);
  });
});

describe('the ability arc on touch (GAME DESIGN, 2026-10-21)', () => {
  it('shows only the unlocked abilities: the Haul alone in M2, growing as more unlock', () => {
    const { screen } = setup(844, 390, 3);
    const ids = (abilities: (typeof ABILITY_CONTROLS)[number][]): string[] =>
      touchLayout(screen, { mode: 'run', abilities }).controls.map((c) => c.id).filter((id) => id.startsWith('ability'));
    expect(ids(['ability1'])).toEqual(['ability1']);
    expect(ids([])).toEqual([]);
    expect(ids(['ability1', 'ability2'])).toEqual(['ability1', 'ability2']);
    expect(ids(['ability1', 'ability3'])).toEqual(['ability1', 'ability3']);
  });
});

describe('the zone of a touch', () => {
  const { screen } = setup(844, 390, 3);
  const layout = touchLayout(screen, { mode: 'run', abilities: ABILITY_CONTROLS });
  const light = layout.controls.find((c) => c.id === 'light');

  it('is the control it lands on, else a HUD zone, else the stick on the left half and a tap on the right', () => {
    if (!light) throw new Error('no light');
    expect(touchZone(layout, light.cx, light.cy, { overHud: true, stick: true })).toEqual({ kind: 'control', id: 'light' });
    expect(touchZone(layout, 40, 200, { overHud: true, stick: true })).toEqual({ kind: 'hud' });
    expect(touchZone(layout, 40, 200, { overHud: false, stick: true })).toEqual({ kind: 'stick' });
    expect(touchZone(layout, screen.w / 2 + 10, 150, { overHud: false, stick: true })).toEqual({ kind: 'tap' });
    // No stick while a panel is open: a tap.
    expect(touchZone(layout, 40, 200, { overHud: false, stick: false })).toEqual({ kind: 'tap' });
    // A control not showing (USE without a prompt) is not there.
    const use = layout.controls.find((c) => c.id === 'use');
    if (!use) throw new Error('no use');
    expect(touchZone(layout, use.cx, use.cy, { overHud: false, stick: true, showing: (id) => id !== 'use' }).kind).toBe('tap');
  });

  it('finds a disc by its radius and a square by its rectangle', () => {
    if (!light) throw new Error('no light');
    const r = light.size / 2;
    expect(controlAt(layout, light.cx + r * 0.75, light.cy + r * 0.75)).toBeNull();
    expect(controlAt(layout, light.cx + r - 1, light.cy)?.id).toBe('light');
    const gear = layout.controls.find((c) => c.id === 'gear');
    if (!gear) throw new Error('no gear');
    expect(controlAt(layout, gear.rect.x, gear.rect.y)?.id).toBe('gear');
    expect(controlAt(layout, gear.rect.x + gear.size, gear.rect.y)).toBeNull();
  });
});

describe('the stick', () => {
  const anchor = { x: 100, y: 200 };

  it('anchors where the thumb lands, and past the radius the knob clamps (the base stays)', () => {
    expect(stickKnob(anchor, { x: 110, y: 200 }, 36)).toEqual({ x: 110, y: 200 });
    expect(stickKnob(anchor, { x: 100 + 72, y: 200 }, 36)).toEqual({ x: 136, y: 200 });
    const k = stickKnob(anchor, { x: 100 + 300, y: 200 + 400 }, 36);
    expect(Math.hypot(k.x - 100, k.y - 200)).toBeCloseTo(36);
  });

  it('gives the deflection, quantized like the pad stick with its deadzone', () => {
    expect(stickVector(anchor, anchor, 36)).toEqual({ x: 0, y: 0 });
    expect(quantizeMove(0.1, 0, 0.2)).toEqual({ moveDir: 0, moveMag: 0 });
    const v = stickVector(anchor, { x: 100, y: 200 - 360 }, 36);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-1);
    // Straight up at full deflection: direction 3/4 of a turn, full magnitude.
    expect(quantizeMove(v.x, v.y, 0.2)).toEqual({ moveDir: (MOVE_DIRS * 3) / 4, moveMag: MOVE_MAG_MAX });
    // A half push walks (under walkStickMax).
    const half = stickVector(anchor, { x: 118, y: 200 }, 36);
    expect(half.x).toBeCloseTo(0.5);
    expect(quantizeMove(half.x, half.y, 0.2).moveMag).toBeLessThanOrEqual(4);
  });
});

describe('a tap versus a drag', () => {
  const layout = { tapMove: 9, tapMaxMs: 300 };
  it('is a tap only when short and still', () => {
    expect(isTap(layout, { x: 0, y: 0, t: 0 }, { x: 3, y: 4, t: 200 })).toBe(true);
    expect(isTap(layout, { x: 0, y: 0, t: 0 }, { x: 9, y: 0, t: 100 })).toBe(false);
    expect(isTap(layout, { x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 301 })).toBe(false);
    // Wandering away and back is a drag.
    expect(isTap(layout, { x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 100 }, 20)).toBe(false);
  });
});
