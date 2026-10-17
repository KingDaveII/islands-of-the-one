import { describe, expect, it } from 'vitest';
import {
  arcPixels,
  bayerLevel,
  checker,
  circlePixels,
  DASH_COUNT,
  dashed,
  discPixels,
  dithered,
  outlinePixels,
  pixelAngle,
  plusPixels,
  type Px,
} from './pixelShapes.js';

const key = (p: Px): string => `${p[0]},${p[1]}`;
const keys = (set: readonly Px[]): string[] => set.map(key).sort();
const unique = (set: readonly Px[]): boolean => new Set(set.map(key)).size === set.length;

/** The set as rows of text, `#` for a pixel, over the box [-r, r]. */
function picture(set: readonly Px[], r: number): string[] {
  const has = new Set(set.map(key));
  const rows: string[] = [];
  for (let y = -r; y <= r; y++) {
    let row = '';
    for (let x = -r; x <= r; x++) row += has.has(`${x},${y}`) ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

describe('pixel circles and discs', () => {
  it('draws a 1 px circle with no gaps and no doubled pixels, in angle order', () => {
    expect(picture(circlePixels(3), 3)).toEqual([
      '..###..',
      '.#...#.',
      '#.....#',
      '#.....#',
      '#.....#',
      '.#...#.',
      '..###..',
    ]);
    const c = circlePixels(5);
    expect(unique(c)).toBe(true);
    for (let i = 1; i < c.length; i++)
      expect(pixelAngle(c[i] as Px)).toBeGreaterThanOrEqual(pixelAngle(c[i - 1] as Px));
    // Every pixel touches the next (8-connected): no gaps on the diagonals.
    for (let i = 0; i < c.length; i++) {
      const a = c[i] as Px;
      const b = c[(i + 1) % c.length] as Px;
      expect(
        Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])),
        `${key(a)} → ${key(b)}`,
      ).toBeLessThanOrEqual(1);
    }
    expect(circlePixels(0)).toEqual([[0, 0]]);
  });

  it('thickens inwards: a 2 px circle is the rings r and r − 1', () => {
    expect(keys(circlePixels(3, 2))).toEqual(keys([...circlePixels(3), ...circlePixels(2)]));
    expect(picture(circlePixels(3, 2), 3)).toEqual([
      '..###..',
      '.#####.',
      '##...##',
      '##...##',
      '##...##',
      '.#####.',
      '..###..',
    ]);
  });

  it('fills a disc row by row', () => {
    expect(picture(discPixels(2), 2)).toEqual(['.###.', '#####', '#####', '#####', '.###.']);
    expect(discPixels(0)).toEqual([[0, 0]]);
  });
});

describe('arcs', () => {
  it("keeps the circle's pixels inside the sweep, clockwise from east with y down", () => {
    // East to south: the bottom-right quarter.
    const q = arcPixels(3, 1, 0, Math.PI / 2);
    expect(picture(q, 3)).toEqual([
      '.......',
      '.......',
      '.......',
      '......#',
      '......#',
      '.....#.',
      '...##..',
    ]);
    // Across the east seam: from −45° to +45° has pixels either side of the x axis.
    const seam = arcPixels(4, 1, -Math.PI / 4, Math.PI / 4);
    expect(seam.some(([, y]) => y < 0) && seam.some(([, y]) => y > 0)).toBe(true);
    expect(seam.every(([x]) => x > 0)).toBe(true);
    // A full turn is the whole circle; no sweep is nothing; thickness goes inwards.
    expect(keys(arcPixels(3, 1, 0, Math.PI * 2))).toEqual(keys(circlePixels(3)));
    expect(arcPixels(3, 1, 1, 1)).toEqual([]);
    expect(keys(arcPixels(3, 2, 0, Math.PI * 2))).toEqual(keys(circlePixels(3, 2)));
  });

  it('outlines a set with the pixels within the width round it, none of the set itself', () => {
    const dot: Px[] = [[0, 0]];
    expect(picture(outlinePixels(dot, 1), 1)).toEqual(['###', '#.#', '###']);
    expect(outlinePixels(dot, 2)).toHaveLength(24);
    const arc = arcPixels(6, 3, 0, Math.PI / 2);
    const rim = outlinePixels(arc, 2);
    const inArc = new Set(arc.map(key));
    expect(rim.every((p) => !inArc.has(key(p)))).toBe(true);
    expect(unique(rim)).toBe(true);
  });
});

describe('checkers, dashes, dithers and the plus', () => {
  it('keeps every other pixel of a set, the phase picking which', () => {
    const box: Px[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) box.push([x, y]);
    expect(
      picture(checker(box), 3)
        .slice(3)
        .map((r) => r.slice(3)),
    ).toEqual(['#.#.', '.#.#', '#.#.', '.#.#']);
    expect(
      picture(checker(box, 1), 3)
        .slice(3)
        .map((r) => r.slice(3)),
    ).toEqual(['.#.#', '#.#.', '.#.#', '#.#.']);
    expect(checker(box)).toHaveLength(8);
    expect(checker(box, 1)).toHaveLength(8);
    expect(keys([...checker(box), ...checker(box, 1)])).toEqual(keys(box));
  });

  it("breaks a circle into dashes by angle: whole at 1, half at 0.5, gone at 0, every pixel's fate fixed", () => {
    const c = circlePixels(12);
    expect(dashed(c, 1)).toEqual(c);
    expect(dashed(c, 0)).toEqual([]);
    const half = dashed(c, 0.5);
    expect(half.length).toBeGreaterThan(c.length * 0.4);
    expect(half.length).toBeLessThan(c.length * 0.6);
    // Eight runs round the circle: the kept pixels change from kept to dropped DASH_COUNT times.
    const kept = new Set(half.map(key));
    let runs = 0;
    for (let i = 0; i < c.length; i++) {
      const a = kept.has(key(c[i] as Px));
      const b = kept.has(key(c[(i + 1) % c.length] as Px));
      if (a && !b) runs++;
    }
    expect(runs).toBe(DASH_COUNT);
    // Monotonic: what 0.3 keeps, 0.6 keeps too.
    const small = new Set(dashed(c, 0.3).map(key));
    const larger = new Set(dashed(c, 0.6).map(key));
    for (const k of small) expect(larger.has(k)).toBe(true);
    // A 2 px ring dashes both of its rings together.
    const thick = dashed(circlePixels(8, 2), 0.5);
    expect(thick.some(([x, y]) => Math.round(Math.hypot(x, y)) === 8)).toBe(true);
    expect(thick.some(([x, y]) => Math.round(Math.hypot(x, y)) === 7)).toBe(true);
  });

  it('dithers from every 4th pixel (level 4) to every other pixel (level 8) with the Bayer 4 × 4 matrix', () => {
    const box: Px[] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) box.push([x, y]);
    expect(
      picture(dithered(box, 4), 3)
        .slice(3)
        .map((r) => r.slice(3)),
    ).toEqual(['#.#.', '....', '#.#.', '....']);
    expect(
      picture(dithered(box, 8), 3)
        .slice(3)
        .map((r) => r.slice(3)),
    ).toEqual(['#.#.', '.#.#', '#.#.', '.#.#']);
    expect(dithered(box, 16)).toHaveLength(16);
    expect(dithered(box, 0)).toHaveLength(0);
    for (let level = 1; level <= 16; level++) expect(dithered(box, level)).toHaveLength(level);
    expect(bayerLevel(0, 0)).toBe(0);
    expect(bayerLevel(1, 1)).toBe(4);
    expect(bayerLevel(-1, -1)).toBe(bayerLevel(3, 3));
    // The origin shifts the pattern, not the set.
    expect(dithered(box, 4, 1, 0)).toHaveLength(4);
    expect(keys(dithered(box, 4, 1, 0))).not.toEqual(keys(dithered(box, 4)));
  });

  it('makes the 5 px plus: 9 pixels, the centre and two out along each axis', () => {
    expect(picture(plusPixels(), 2)).toEqual(['..#..', '..#..', '#####', '..#..', '..#..']);
    expect(plusPixels()).toHaveLength(9);
    expect(plusPixels(1)).toEqual([[0, 0]]);
  });
});
