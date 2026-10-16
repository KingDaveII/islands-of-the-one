import {
  hookbladeFxSheet,
  spriteSheets,
  SPRITE_FACINGS,
  type HookbladeFxSheet,
  type SpriteSheet,
} from '@iot/shared';
import fixtureJson from '../../../../packages/shared/test/fixtures/kindled-fixture.json' with { type: 'json' };
import hookbladeFixtureJson from '../../../../packages/shared/test/fixtures/hookblade-fixture.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { PLAYER_SHEET } from './characters.js';
import {
  chainLinks,
  hookbladeDraw,
  hookbladePoint,
  m1HookbladeOffset,
  pointInWorld,
  type PlayerFrame,
} from './hookbladePoints.js';

const fixture: SpriteSheet = fixtureJson;
const cell = fixture.frames.idle_S_0;
if (!cell) throw new Error('the kindled fixture has no idle_S_0');

/**
 * The v2 fixture's cells as frames with points, the way the pipeline writes
 * them: S and E drawn, NW and W the mirrors of NE and E (x → 95 − x in a
 * 96 px cell).
 */
const withPoints: SpriteSheet = {
  ...fixture,
  frames: {
    ...fixture.frames,
    heavy_charge_S_2: { ...cell, points: { tip: [31, 42] } },
    heavy_charge_NE_2: { ...cell, points: { tip: [60, 33] } },
    heavy_charge_NW_2: { ...cell, points: { tip: [35, 33] } },
    haul_throw_E_1: { ...cell, points: { hand: [58, 44] } },
    haul_throw_W_1: { ...cell, points: { hand: [37, 44] } },
  },
};

/** The player drawn with its origin at world px (200, 300), its body centre at sim px (100, 145). */
const at = (sheet: SpriteSheet, frame: string, facing: string): PlayerFrame => ({
  sheet,
  frame,
  anchor: { x: 200, y: 300 },
  facing: SPRITE_FACINGS.indexOf(facing as (typeof SPRITE_FACINGS)[number]),
  body: { x: 100, y: 145 },
});

describe("the Hookblade's points in the world", () => {
  it('maps a point like its frame: anchor + (point − origin) × pixelScale', () => {
    expect(pointInWorld(withPoints, 'heavy_charge_S_2', 'tip', { x: 200, y: 300 })).toEqual({ x: 183, y: 278 });
    expect(pointInWorld(withPoints, 'heavy_charge_S_2', 'hand', { x: 200, y: 300 })).toBeNull();
    // The same frame read at the legacy 2: every sheet px is two world px from the anchor.
    const doubled = { ...withPoints, meta: { ...withPoints.meta, pixelScale: 2 } };
    expect(pointInWorld(doubled, 'heavy_charge_S_2', 'tip', { x: 200, y: 300 })).toEqual({ x: 166, y: 256 });
  });

  it('puts the charge spark on the tip in two facings, one of them mirrored', () => {
    expect(hookbladePoint(at(withPoints, 'heavy_charge_S_2', 'S'), 'tip')).toEqual({ x: 183, y: 278 });
    const ne = hookbladePoint(at(withPoints, 'heavy_charge_NE_2', 'NE'), 'tip');
    const nw = hookbladePoint(at(withPoints, 'heavy_charge_NW_2', 'NW'), 'tip');
    expect(ne).toEqual({ x: 212, y: 269 });
    expect(nw).toEqual({ x: 187, y: 269 });
    // Mirrored about the origin's column: 200 − 13 and 200 + 12 (a 96 px cell's mirror is 95 − x).
    expect(ne.x + nw.x).toBe(2 * 200 - 1);
  });

  it("starts the chain's first link next to the hand, in E and in the mirrored W", () => {
    const { spacing } = hookbladeDraw(hookbladeFxSheet);
    for (const [frame, facing, hookX, hand] of [
      ['haul_throw_E_1', 'E', 400, { x: 210, y: 280 }],
      ['haul_throw_W_1', 'W', 0, { x: 189, y: 280 }],
    ] as const) {
      const from = hookbladePoint(at(withPoints, frame, facing), 'hand');
      expect(from, frame).toEqual(hand);
      const links = chainLinks(hookbladeFxSheet, from.x, from.y, hookX, 280, 16);
      // Half a spacing out from the hand, along the chain, at a whole world px.
      expect(links[0], frame).toEqual({ x: hand.x + Math.sign(hookX - hand.x) * (spacing / 2), y: 280, angle: hookX > hand.x ? 0 : Math.PI });
    }
    const diagonal = chainLinks(hookbladeFxSheet, 210, 280, 310, 380, 16);
    const first = diagonal[0];
    expect(first && Math.hypot(first.x - 210, first.y - 280)).toBeCloseTo(spacing / 2, 0);
  });

  it("reads kindled-ash's points: its mirrored facings carry their twin's, mirrored", () => {
    const sheet = spriteSheets[PLAYER_SHEET];
    for (const [twin, mirrored] of [
      ['haul_throw_E_1', 'haul_throw_W_1'],
      ['haul_recover_SE_0', 'haul_recover_SW_0'],
      ['heavy_charge_NE_2', 'heavy_charge_NW_2'],
    ] as const) {
      const point = twin.startsWith('heavy') ? 'tip' : 'hand';
      const a = pointInWorld(sheet, twin, point, { x: 0, y: 0 });
      const b = pointInWorld(sheet, mirrored, point, { x: 0, y: 0 });
      expect(a, twin).not.toBeNull();
      expect(b && a && [b.x, b.y], mirrored).toEqual(a && [-1 - a.x, a.y]);
    }
  });
});

describe('the v1 fallback (M1 offsets, a frame without the point)', () => {
  // M1's numbers, sim px from the body centre (PR #40, section 2): the spark forward of the body, the chain 2 px up.
  const M1_SPARK: Record<string, [number, number]> = {
    S: [5, 8],
    SE: [12, 8],
    E: [12, -1],
    NE: [12, -5],
    N: [5, -5],
    NW: [-12, -5],
    W: [-12, -1],
    SW: [-12, 8],
  };

  it('keeps the offsets exactly, for every facing', () => {
    SPRITE_FACINGS.forEach((facing, i) => {
      const [x, y] = M1_SPARK[facing] ?? [0, 0];
      expect(m1HookbladeOffset('tip', i), facing).toEqual({ x, y });
      expect(m1HookbladeOffset('hand', i), facing).toEqual({ x: 0, y: -2 });
    });
  });

  it('draws at the body centre plus the offset, doubled, where the frame has no point (a v1 sheet, a fixture)', () => {
    const v1: SpriteSheet = { ...withPoints, meta: { ...withPoints.meta, version: '1' }, frames: fixture.frames };
    // Body (100, 145) sim px; W's spark (−12, −1) and the chain's (0, −2), in world px.
    expect(hookbladePoint(at(v1, 'idle_S_0', 'W'), 'tip')).toEqual({ x: 176, y: 288 });
    expect(hookbladePoint(at(v1, 'idle_S_0', 'W'), 'hand')).toEqual({ x: 200, y: 286 });
    expect(hookbladePoint(at(withPoints, 'heavy_charge_S_2', 'S'), 'hand')).toEqual({ x: 200, y: 286 });
  });
});

describe('hookblade-fx draws at its own scale and tint (meta)', () => {
  const fixtureFx: HookbladeFxSheet = hookbladeFixtureJson;

  it("draws the shipped sheet (ART's B redraw) at 1, untinted, a link every 14 world px", () => {
    expect(hookbladeDraw(hookbladeFxSheet)).toEqual({ scale: 1, tinted: false, spacing: 14, clear: 2 });
    const links = chainLinks(hookbladeFxSheet, 0, 0, 100, 0, 16);
    expect(links.map((l) => l.x)).toEqual([7, 21, 35, 49, 63, 77, 91]);
  });

  it('draws an untinted B sheet at 1, in its own colours, with its spacing in sheet px', () => {
    expect(hookbladeDraw(fixtureFx)).toEqual({ scale: 1, tinted: false, spacing: 32, clear: 2 });
    expect(chainLinks(fixtureFx, 0, 0, 97, 0, 16).map((l) => l.x)).toEqual([16, 48, 80]);
    // A sheet without meta is M1's: 2, tinted.
    const bare: HookbladeFxSheet = { ...hookbladeFxSheet };
    delete bare.meta;
    expect(hookbladeDraw(bare)).toEqual({ scale: 2, tinted: true, spacing: 28, clear: 4 });
  });
});
