import { readFileSync } from 'node:fs';
import { PIECE_SHADOWS, PIECE_SHEETS, pieceAnim, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import channelJson from '../../../../packages/shared/assets/sprites/prop-clay-channel.json' with { type: 'json' };
import jarsJson from '../../../../packages/shared/assets/sprites/prop-seed-jars.json' with { type: 'json' };
import floorJson from '../../../../packages/shared/assets/sprites/prop-threshing-floor.json' with { type: 'json' };
import { decodePng } from '../../../../packages/shared/test/png.js';
import {
  checkerMask,
  maskTop,
  opaqueMask,
  outlineMask,
  OUTLINE_PX,
  pieceSheetName,
  RISE_STEP_PX,
  riseCrop,
  riseSteps,
  unionMask,
  type Mask,
} from './pieceArt.js';
import { propShadowSize, type Rgba } from './propShadow.js';

const SHEETS: Record<string, SpriteSheet> = {
  'prop-clay-channel': channelJson,
  'prop-seed-jars': jarsJson,
  'prop-threshing-floor': floorJson,
};
const png = (name: string): Rgba => {
  const d = decodePng(readFileSync(new URL(`../../../../packages/shared/assets/sprites/${name}.png`, import.meta.url)));
  return { width: d.width, height: d.height, data: d.rgba };
};

/** A mask from rows of '#' (opaque) and '.' (clear). */
function mask(rows: string[]): Mask {
  const w = rows[0]?.length ?? 0;
  const bits = new Uint8Array(w * rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) bits[y * w + x] = r.charAt(x) === '#' ? 1 : 0;
  });
  return { w, h: rows.length, bits };
}
const rows = (m: Mask): string[] =>
  Array.from({ length: m.h }, (_, y) => Array.from({ length: m.w }, (_, x) => (m.bits[y * m.w + x] ? '#' : '.')).join(''));
const count = (m: Mask): number => m.bits.reduce((n, b) => n + b, 0);

describe('the pieces drawn from their sheets (pieceArt.ts, ART #107)', () => {
  it('names each piece its sheet, and nothing for an unknown piece', () => {
    expect(pieceSheetName('seed-jars')).toBe('prop-seed-jars');
    expect(pieceSheetName('clay-channel')).toBe('prop-clay-channel');
    expect(pieceSheetName('threshing-floor')).toBe('prop-threshing-floor');
    expect(pieceSheetName('toString')).toBeUndefined();
    expect(pieceSheetName('weapon-rack')).toBeUndefined();
  });

  it('reads the opaque pixels of one frame of a sheet', () => {
    const data = new Uint8Array(4 * 2 * 4);
    data[(1 * 4 + 2) * 4 + 3] = 255; // (2, 1)
    data[(0 * 4 + 1) * 4 + 3] = 1; // (1, 0): any alpha counts
    expect(rows(opaqueMask({ width: 4, height: 2, data }, { x: 1, y: 0, w: 2, h: 2 }))).toEqual(['#.', '.#']);
  });

  it('checkers every other opaque pixel where x + y is even, so the ghost and the dim hold still in the world', () => {
    expect(rows(checkerMask(mask(['####', '##..', '.###'])))).toEqual(['#.#.', '.#..', '..#.']);
  });

  it('outlines the silhouette 2 px out, never over its own pixels', () => {
    const m = mask(['#']);
    const ring = outlineMask(m);
    expect(OUTLINE_PX).toBe(2);
    expect(rows(ring)).toEqual(['#####', '#####', '##.##', '#####', '#####']);
    // An L: the ring follows the shape, not the bounding box.
    const l = outlineMask(mask(['#....', '#....', '#####']), 1);
    expect(rows(l)).toEqual(['###....', '#.#....', '#.#####', '#.....#', '#######']);
  });

  it('unites a row’s frames, so an animated piece’s outline holds still', () => {
    expect(rows(unionMask([mask(['#.', '..']), mask(['..', '.#'])]))).toEqual(['#.', '.#']);
    expect(unionMask([]).w).toBe(0);
  });

  it('rises a tile at a time from the base line, the rows under it with the first step', () => {
    const art = { originY: 96, cellH: 104, top: 10 };
    expect(RISE_STEP_PX).toBe(32);
    expect(riseSteps(art)).toBe(3);
    expect(riseCrop(art, 0)).toEqual({ y: 104, h: 0 });
    expect(riseCrop(art, 1)).toEqual({ y: 64, h: 40 });
    expect(riseCrop(art, 2)).toEqual({ y: 32, h: 72 });
    expect(riseCrop(art, 3)).toEqual({ y: 0, h: 104 });
    // A flat piece rises in one step.
    expect(riseSteps({ originY: 96, cellH: 104, top: 80 })).toBe(1);
    expect(maskTop(mask(['..', '.#']))).toBe(1);
    expect(maskTop(mask(['..']))).toBe(1);
  });

  it.each(Object.values(PIECE_SHEETS))('%s: every row has art, its outline clears the cell and the turned row lies across', (name) => {
    const sheet = SHEETS[name];
    if (!sheet) throw new Error(`no sheet ${name}`);
    const img = png(name);
    const { cell, origin } = sheet.meta;
    for (const [anim, def] of Object.entries(sheet.anims)) {
      const masks = def.frames.map((f) => {
        const frame = sheet.frames[f]?.frame;
        if (!frame) throw new Error(`no frame ${f}`);
        return opaqueMask(img, frame);
      });
      const union = unionMask(masks);
      expect(count(union), `${name}/${anim} has pixels`).toBeGreaterThan(0);
      // The outline is padded by its width: the frame's own pixels sit at (2, 2) in it, and it never covers them.
      const ring = outlineMask(union);
      expect([ring.w, ring.h]).toEqual([cell.w + 2 * OUTLINE_PX, cell.h + 2 * OUTLINE_PX]);
      for (let y = 0; y < cell.h; y++)
        for (let x = 0; x < cell.w; x++)
          if (union.bits[y * cell.w + x]) expect(ring.bits[(y + OUTLINE_PX) * ring.w + x + OUTLINE_PX]).toBe(0);
      // The rise ends on the whole frame, and its first step already shows the base line.
      const art = { originY: origin.y, cellH: cell.h, top: maskTop(union) };
      expect(riseCrop(art, riseSteps(art))).toEqual({ y: 0, h: cell.h });
      expect(riseCrop(art, 1).y).toBeLessThan(origin.y);
    }
    // A turned piece shows its turned row at 90 and 270 (`pieceAnim`).
    const turned = Boolean(sheet.anims.idle_turned);
    expect(pieceAnim(90, turned)).toBe(turned ? 'idle_turned' : 'idle');
    expect(pieceAnim(180, turned)).toBe('idle');
  });

  it('gives the seed jars a grounding shadow from their pixels, and only them', () => {
    expect(Object.entries(PIECE_SHADOWS).filter(([, s]) => s).map(([id]) => id)).toEqual(['seed-jars']);
    const img = png('prop-seed-jars');
    for (const anim of ['idle', 'idle_turned']) {
      const frame = jarsJson.frames[`${anim}_0` as keyof typeof jarsJson.frames].frame;
      const sh = propShadowSize(img, frame);
      expect(sh.w, anim).toBeGreaterThan(0);
      expect(sh.w, anim).toBeLessThanOrEqual(jarsJson.meta.cell.w + 4);
    }
  });
});
