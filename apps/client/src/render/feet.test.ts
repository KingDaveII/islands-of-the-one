import { defaultTuning, roomTemplates } from '@iot/shared';
import { createRun, type Params } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { DEPTH } from './depth.js';
import { bodyDepth, groundLine, huskFeet, PLAYER_FEET, type Body } from './feet.js';

const P: Params = createRun({
  seed: 1,
  tuning: defaultTuning,
  rooms: roomTemplates,
  weapon: 'hookblade',
}).params;
const KINDLED: Body = { kind: 'kindled' };
const CHEST: Body = { kind: 'chest' };
const PEELING: Body = { kind: 'husk', husk: 'peeling', P };
const NUTSHELL: Body = { kind: 'husk', husk: 'nutshell', P };

/** The sim y (body centre) that puts a body's ground line at `line` sim px. */
const centreOn = (body: Body, line: number): number => line - groundLine(body, 0);

describe('the ground line, the one sort key of the bodies layer (G1.5h)', () => {
  it('is the feet for the Kindled and a Husk, the position for a chest', () => {
    expect(groundLine(KINDLED, 100)).toBe(100 + PLAYER_FEET);
    expect(groundLine(PEELING, 100)).toBe(100 + huskFeet(P, 'peeling'));
    expect(groundLine(NUTSHELL, 100)).toBe(100 + huskFeet(P, 'nutshell'));
    expect(groundLine(CHEST, 100)).toBe(100);
    // The feet are the sim radii the sprites already stand on: 5 (the Kindled, a Peeling) and 10 (a Nutshell).
    expect([PLAYER_FEET, huskFeet(P, 'peeling'), huskFeet(P, 'nutshell')]).toEqual([5, 5, 10]);
  });

  it('draws the Kindled over a chest with its feet 1 px in front of the base, and under it 1 px behind', () => {
    const chest = 120;
    const front = bodyDepth(KINDLED, centreOn(KINDLED, chest + 1));
    const behind = bodyDepth(KINDLED, centreOn(KINDLED, chest - 1));
    expect(front).toBeGreaterThan(bodyDepth(CHEST, chest));
    expect(behind).toBeLessThan(bodyDepth(CHEST, chest));
    // Before G1.5h the Kindled sorted by its centre, 5 px above its feet: 1 px in front it still drew under the chest.
    expect(centreOn(KINDLED, chest + 1)).toBeLessThan(chest);
  });

  it('does the same for a Husk, by its radius', () => {
    const chest = 120;
    for (const husk of [PEELING, NUTSHELL]) {
      expect(bodyDepth(husk, centreOn(husk, chest + 1))).toBeGreaterThan(bodyDepth(CHEST, chest));
      expect(bodyDepth(husk, centreOn(husk, chest - 1))).toBeLessThan(bodyDepth(CHEST, chest));
    }
    // A Nutshell's centre sits 10 px above its feet: 1 px in front of the chest its centre is 9 px behind the base.
    expect(centreOn(NUTSHELL, chest + 1)).toBe(chest - 9);
    // And a Husk against the Kindled: the one in front draws over, whichever is taller.
    expect(bodyDepth(NUTSHELL, centreOn(NUTSHELL, 101))).toBeGreaterThan(
      bodyDepth(KINDLED, centreOn(KINDLED, 100)),
    );
    expect(bodyDepth(KINDLED, centreOn(KINDLED, 101))).toBeGreaterThan(
      bodyDepth(NUTSHELL, centreOn(NUTSHELL, 100)),
    );
  });

  it("keeps today's order on the same line: a Husk under the Kindled under a chest", () => {
    const line = 100;
    const husks = [PEELING, NUTSHELL].map((h) => bodyDepth(h, centreOn(h, line)));
    const kindled = bodyDepth(KINDLED, centreOn(KINDLED, line));
    const chest = bodyDepth(CHEST, line);
    for (const h of husks) expect(h).toBeLessThan(kindled);
    expect(kindled).toBeLessThan(chest);
    // The tie ranks live within one world px, under the next line's depth, so they never beat a real difference.
    expect(chest).toBeLessThan(bodyDepth(PEELING, centreOn(PEELING, line + 0.5)));
    expect(chest - bodyDepth(PEELING, centreOn(PEELING, line))).toBeLessThan(DEPTH.perPixel);
  });

  it('sorts on the world px row the sprite is drawn on and stays under the overlays', () => {
    // Half a sim px is a whole world px: a different row, so a different depth.
    expect(bodyDepth(CHEST, 100.5)).toBeGreaterThan(bodyDepth(CHEST, 100));
    expect(bodyDepth(CHEST, 100.2)).toBe(bodyDepth(CHEST, 100));
    expect(bodyDepth(CHEST, 100) - DEPTH.bodies).toBeCloseTo(
      200 * DEPTH.perPixel + (2 / 4) * DEPTH.perPixel,
      12,
    );
    expect(bodyDepth(CHEST, 2000)).toBeLessThan(DEPTH.debug);
  });
});
