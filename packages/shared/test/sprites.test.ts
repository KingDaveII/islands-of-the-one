import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLAY_TONES,
  HUSK_ANIMS,
  hexOf,
  isKindledSheet,
  KINDLED_ANIMS,
  kindledAnimKey,
  kindledFrameName,
  paletteData,
  SPRITE_FACINGS,
  SPRITE_SHEET_NAMES,
  spriteSheets,
  type SpriteSheet,
} from '../src/index.js';
import { decodePng } from './png.js';

/**
 * Every animated sheet in packages/shared/assets/sprites against its PNG
 * (docs/design/sprites.md §6): the image matches `meta`, frames sit on the
 * cell grid, every anim frame exists and every frame is used, Kindled sheets
 * carry the whole animation × facing matrix, the anchor is the origin, every
 * opaque pixel is a palette token (telegraph colours only in telegraph
 * frames, pure white nowhere) and the palette swaps are valid.
 */
const SHEETS: [string, SpriteSheet][] = SPRITE_SHEET_NAMES.map((name) => [name, spriteSheets[name]]);

const assetUrl = (image: string): URL => new URL(`../assets/sprites/${image}`, import.meta.url);

const PALETTE = new Set(Object.values(paletteData.tokens).map((h) => h.toLowerCase()));
const TELEGRAPH = new Set(paletteData.signals.telegraph.map((h) => h.toLowerCase()));
const WHITE = paletteData.signals.hit.toLowerCase();

describe.each(SHEETS)('the %s sprite sheet', (name, sheet) => {
  const file = assetUrl(sheet.meta.image);
  const { cell, origin } = sheet.meta;
  const frames = Object.entries(sheet.frames);

  it('has its image next to it, of the size in meta, a whole number of cells', () => {
    expect(existsSync(file), sheet.meta.image).toBe(true);
    expect(sheet.meta.image).toBe(`${name}.png`);
    expect(cell.w).toBeGreaterThan(0);
    expect(cell.h).toBeGreaterThan(0);
  });

  let png: ReturnType<typeof decodePng> = { width: 0, height: 0, rgba: new Uint8Array(0) };
  beforeAll(() => {
    png = decodePng(readFileSync(file));
  });

  it("the PNG's size equals meta.size and is a multiple of the cell", () => {
    expect([png.width, png.height]).toEqual([sheet.meta.size.w, sheet.meta.size.h]);
    expect(png.width % cell.w).toBe(0);
    expect(png.height % cell.h).toBe(0);
  });

  it('every frame lies inside the PNG on the cell grid, untrimmed and unrotated, the cell in size', () => {
    expect(frames.length).toBeGreaterThan(0);
    for (const [frameName, f] of frames) {
      expect([f.frame.w, f.frame.h], frameName).toEqual([cell.w, cell.h]);
      expect(f.frame.x % cell.w, frameName).toBe(0);
      expect(f.frame.y % cell.h, frameName).toBe(0);
      expect(f.frame.x + f.frame.w, frameName).toBeLessThanOrEqual(png.width);
      expect(f.frame.y + f.frame.h, frameName).toBeLessThanOrEqual(png.height);
      expect(f.rotated, frameName).toBe(false);
      expect(f.trimmed, frameName).toBe(false);
      expect(f.sourceSize, frameName).toEqual({ w: cell.w, h: cell.h });
    }
  });

  it('no two frames share a cell', () => {
    const cells = frames.map(([, f]) => `${f.frame.x},${f.frame.y}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('every anim frame exists and every frame belongs to at least one anim', () => {
    const used = new Set<string>();
    for (const [anim, def] of Object.entries(sheet.anims)) {
      expect(def.frames.length, anim).toBeGreaterThan(0);
      expect(def.frameRate, anim).toBeGreaterThanOrEqual(0);
      expect([-1, 0], anim).toContain(def.repeat);
      for (const frame of def.frames) {
        expect(sheet.frames[frame], `${anim}: ${frame}`).toBeDefined();
        used.add(frame);
      }
    }
    for (const [frameName] of frames) expect(used.has(frameName), `${frameName} is in no anim`).toBe(true);
  });

  it('anchor = origin / cell', () => {
    expect(origin.x).toBeGreaterThanOrEqual(0);
    expect(origin.y).toBeGreaterThanOrEqual(0);
    expect(origin.x).toBeLessThan(cell.w);
    expect(origin.y).toBeLessThan(cell.h);
    for (const [frameName, f] of frames) {
      expect(f.anchor.x, frameName).toBeCloseTo(origin.x / cell.w, 6);
      expect(f.anchor.y, frameName).toBeCloseTo(origin.y / cell.h, 6);
    }
  });

  it('colours come only from the palette: telegraph colours only in telegraph frames, #FFFFFF nowhere', () => {
    // Which cell each pixel belongs to, by frame name.
    const cellOf = new Map<string, string>();
    for (const [frameName, f] of frames) cellOf.set(`${f.frame.x},${f.frame.y}`, frameName);
    const offPalette = new Set<string>();
    const telegraphOutside = new Set<string>();
    let white = 0;
    let semi = 0;
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const i = (y * png.width + x) * 4;
        const a = png.rgba[i + 3] ?? 0;
        if (a === 0) continue;
        if (a !== 255) semi++;
        const hex = hexOf(png.rgba[i] ?? 0, png.rgba[i + 1] ?? 0, png.rgba[i + 2] ?? 0);
        if (hex === WHITE) white++;
        if (!PALETTE.has(hex)) offPalette.add(hex);
        if (TELEGRAPH.has(hex)) {
          const frameName = cellOf.get(`${x - (x % cell.w)},${y - (y % cell.h)}`) ?? '(no frame)';
          if (!frameName.startsWith('telegraph_')) telegraphOutside.add(frameName);
        }
      }
    }
    expect(semi, 'semi-transparent pixels').toBe(0);
    expect([...offPalette], 'colours outside the palette').toEqual([]);
    expect(white, 'pure white pixels').toBe(0);
    expect([...telegraphOutside], 'telegraph colours outside telegraph frames').toEqual([]);
  });

  it('every frame has ink', () => {
    for (const [frameName, f] of frames) {
      let ink = 0;
      for (let y = f.frame.y; y < f.frame.y + f.frame.h; y++) {
        for (let x = f.frame.x; x < f.frame.x + f.frame.w; x++) {
          if ((png.rgba[(y * png.width + x) * 4 + 3] ?? 0) > 0) ink++;
        }
      }
      expect(ink, frameName).toBeGreaterThan(0);
    }
  });

  if (isKindledSheet(name)) {
    it('lists the 8 facings in sheet order and carries every M1 animation for every facing it lists', () => {
      expect(sheet.meta.facings).toEqual([...SPRITE_FACINGS]);
      for (const a of KINDLED_ANIMS) {
        for (const facing of a.facings) {
          const key = kindledAnimKey(a.name, facing);
          const def = sheet.anims[key];
          expect(def, key).toBeDefined();
          if (!def) continue;
          expect(def.frames, key).toEqual(Array.from({ length: a.frames }, (_, i) => kindledFrameName(a.name, facing, i)));
          expect(def.repeat, key).toBe(a.loop ? -1 : 0);
          expect(def.hold ?? false, key).toBe(a.hold);
          if (a.fps > 0) expect(def.frameRate, key).toBe(a.fps);
        }
      }
    });

    it('is drawn in one clay tone and swaps to the other tones with hex values that occur in the PNG', () => {
      const palette = sheet.palette;
      expect(palette).toBeDefined();
      if (!palette) return;
      expect(palette.drawn).toBe(paletteData.clay.drawn);
      const present = new Set<string>();
      for (let i = 0; i < png.width * png.height; i++) {
        if ((png.rgba[i * 4 + 3] ?? 0) === 0) continue;
        present.add(hexOf(png.rgba[i * 4] ?? 0, png.rgba[i * 4 + 1] ?? 0, png.rgba[i * 4 + 2] ?? 0));
      }
      const tones = Object.keys(palette.swaps);
      expect(tones.length).toBeGreaterThan(0);
      for (const tone of tones) {
        expect(CLAY_TONES, tone).toContain(tone);
        expect(tone, 'the drawn tone swaps to nothing').not.toBe(palette.drawn);
        for (const [from, to] of Object.entries(palette.swaps[tone] ?? {})) {
          expect(present.has(from.toLowerCase()), `${tone}: ${from} is not in the PNG`).toBe(true);
          expect(PALETTE.has(to.toLowerCase()), `${tone}: ${to} is not a palette token`).toBe(true);
        }
      }
    });
  } else {
    it('is a Husk sheet: no facings, no palette block, pre-tinted telegraph frames', () => {
      expect(sheet.meta.facings).toBeUndefined();
      expect(sheet.palette).toBeUndefined();
      const kind = name.replace('husk-', '') as keyof typeof HUSK_ANIMS;
      expect(Object.keys(sheet.anims)).toEqual([...HUSK_ANIMS[kind]]);
      const telegraph = sheet.anims.telegraph;
      expect(telegraph?.hold).toBe(true);
      let tinted = 0;
      for (const frame of telegraph?.frames ?? []) {
        const f = sheet.frames[frame];
        if (!f) continue;
        for (let y = f.frame.y; y < f.frame.y + f.frame.h; y++) {
          for (let x = f.frame.x; x < f.frame.x + f.frame.w; x++) {
            const i = (y * png.width + x) * 4;
            if ((png.rgba[i + 3] ?? 0) === 0) continue;
            if (TELEGRAPH.has(hexOf(png.rgba[i] ?? 0, png.rgba[i + 1] ?? 0, png.rgba[i + 2] ?? 0))) tinted++;
          }
        }
      }
      expect(tinted).toBeGreaterThan(0);
    });
  }
});

describe('the sprite sheet table', () => {
  it('names the cell grid and origin of each M1 sheet (sprites.md §2)', () => {
    expect(spriteSheets['kindled-ash'].meta.cell).toEqual({ w: 48, h: 40 });
    expect(spriteSheets['kindled-ash'].meta.origin).toEqual({ x: 24, y: 36 });
    expect(spriteSheets['husk-peeling'].meta.cell).toEqual({ w: 24, h: 24 });
    expect(spriteSheets['husk-peeling'].meta.origin).toEqual({ x: 12, y: 18 });
    expect(spriteSheets['husk-nutshell'].meta.cell).toEqual({ w: 40, h: 40 });
    expect(spriteSheets['husk-nutshell'].meta.origin).toEqual({ x: 20, y: 34 });
  });

  it('marks the generated sheets as placeholders', () => {
    for (const name of SPRITE_SHEET_NAMES) expect(spriteSheets[name].meta.app).toBe('placeholder');
  });
});
