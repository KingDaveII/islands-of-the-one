import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLAY_TONES,
  hexOf,
  isV2Sheet,
  kindledAnimKey,
  kindledFrameName,
  LEGACY_PIXEL_SCALE,
  HUSK_TABLES,
  ANIMS_AWAITING_ART,
  KINDLED_ANIMS,
  NPC_ANIMS,
  paletteData,
  propIdleSpec,
  PROP_IDLE,
  REQUIRED_MILESTONE,
  isRequiredAnim,
  sheetPixelScale,
  skinMaskName,
  SPRITE_CANVAS,
  SPRITE_CELLS,
  SPRITE_FACINGS,
  SPRITE_SHEET_NAMES,
  SPRITE_WHITELIST,
  spriteCellSpecFor,
  spriteSheetSpec,
  type SpriteAnimSpec,
  spriteSheets,
  WORLD_PX_PER_UNIT,
  type SpriteSheet,
} from '../src/index.js';
import fixtureSheet from './fixtures/kindled-fixture.json' with { type: 'json' };
import { decodePng } from './png.js';
import { tableProblems, v2Problems, type Rgba } from './sheetChecks.js';

/**
 * Every animated sheet in packages/shared/assets/sprites against its PNG
 * (docs/design/sprites.md §6): the image matches `meta`, frames sit on the
 * cell grid, every anim frame exists and every frame is used, Kindled sheets
 * carry their table's animation × facing matrix up to REQUIRED_MILESTONE (later rows
 * absent or complete), the anchor is the origin, every
 * opaque pixel is a palette token (telegraph colours only in telegraph
 * frames, pure white nowhere) and the palette swaps are valid. A v2 sheet
 * also follows the v2 contract (sheetChecks.ts): its kind's cell and origin,
 * pixelScale 1, nothing clipped at a cell's edge, the colour whitelist, and
 * its skin mask. The v2 fixture in test/fixtures runs through the same checks.
 */
const SPRITE_DIR = new URL('../assets/sprites/', import.meta.url);
const ON_DISK = readdirSync(SPRITE_DIR).sort();
/** Every sheet on disk, by its JSON (masks, `*.skin.png`, belong to a sheet and are checked with it). */
const SHEETS: [string, SpriteSheet][] = ON_DISK.filter((f) => f.endsWith('.json')).map((f) => [
  f.slice(0, -'.json'.length),
  JSON.parse(readFileSync(new URL(f, SPRITE_DIR), 'utf8')) as SpriteSheet,
]);

const assetUrl = (image: string): URL => new URL(image, SPRITE_DIR);

describe('the sheets on disk (packages/shared/assets/sprites)', () => {
  it('pair every JSON with a PNG and every PNG with a JSON; each mask is named by its sheet', () => {
    const json = new Set(ON_DISK.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)));
    const masks = ON_DISK.filter((f) => f.endsWith('.skin.png'));
    const png = new Set(ON_DISK.filter((f) => f.endsWith('.png') && !f.endsWith('.skin.png')).map((f) => f.slice(0, -4)));
    expect(
      [...json].filter((n) => !png.has(n)),
      'JSON with no PNG',
    ).toEqual([]);
    expect(
      [...png].filter((n) => !json.has(n)),
      'PNG with no JSON',
    ).toEqual([]);
    const named = new Set(SHEETS.map(([, s]) => s.palette?.mask).filter((m): m is string => m !== undefined));
    expect(
      masks.filter((m) => !named.has(m)),
      'masks no sheet names',
    ).toEqual([]);
    expect(
      ON_DISK.filter((f) => !f.endsWith('.json') && !f.endsWith('.png')),
      'other files',
    ).toEqual([]);
  });

  it('name a known kind each (kindled-, husk-, npc-, prop-)', () => {
    for (const [name] of SHEETS) expect(() => spriteSheetSpec(name), name).not.toThrow();
  });

  it("hold every sheet the client loads (SPRITE_SHEET_NAMES), as the client's import has it", () => {
    const disk = new Map(SHEETS);
    for (const name of SPRITE_SHEET_NAMES) {
      expect(disk.has(name), `${name} is not on disk`).toBe(true);
      expect(spriteSheets[name], name).toEqual(disk.get(name));
    }
  });
});
const fixtureUrl = (image: string): URL => new URL(`./fixtures/${image}`, import.meta.url);

const PALETTE = new Set(Object.values(paletteData.tokens).map((h) => h.toLowerCase()));
const TELEGRAPH = new Set(paletteData.signals.telegraph.map((h) => h.toLowerCase()));
const WHITE = paletteData.signals.hit.toLowerCase();

describe.each(SHEETS)('the %s sprite sheet', (name, sheet) => {
  sheetSuite(name, sheet, assetUrl, true);
});

describe('the v2 fixture sheet (test/fixtures/kindled-fixture)', () => {
  const sheet: SpriteSheet = fixtureSheet;
  it('is a v2 Kindled sheet', () => {
    expect(isV2Sheet(sheet)).toBe(true);
    expect(sheetPixelScale(sheet)).toBe(1);
  });
  sheetSuite('kindled-fixture', sheet, fixtureUrl, false);
});

/** The checks of §6 for one sheet; `shipped` sheets also carry their table up to REQUIRED_MILESTONE (tableProblems). */
function sheetSuite(name: string, sheet: SpriteSheet, url: (image: string) => URL, shipped: boolean): void {
  const file = url(sheet.meta.image);
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

  const kind = spriteSheetSpec(name);

  if (shipped) {
    it(`carries its ${kind.kind} table up to ${REQUIRED_MILESTONE}: every animation, facing and frame, with its rate, loop and hold`, () => {
      expect(sheet.meta.facings).toEqual(kind.facings ? [...SPRITE_FACINGS] : undefined);
      const table = kind.anims ?? (kind.kind === 'prop' ? propTable(sheet) : null);
      expect(table, `no animation table for ${name} in the contract`).not.toBeNull();
      if (!table) return;
      expect(tableProblems(name, sheet, table)).toEqual([]);
    });
  }

  if (kind.palette) {
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
    it(`is a ${kind.kind} sheet: no palette block and no mask`, () => {
      expect(sheet.palette).toBeUndefined();
    });
  }

  if (kind.kind === 'husk' && sheet.anims.telegraph) {
    it('has pre-tinted telegraph frames', () => {
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

  if (isV2Sheet(sheet)) {
    it('follows the v2 contract: cell, origin, pixelScale, nothing clipped, the whitelist, the skin mask', () => {
      const maskFile = sheet.palette?.mask ? url(sheet.palette.mask) : null;
      if (maskFile) expect(existsSync(maskFile), sheet.palette?.mask).toBe(true);
      const mask = maskFile && existsSync(maskFile) ? decodePng(readFileSync(maskFile)) : null;
      expect(v2Problems(name, sheet, png, mask)).toEqual([]);
    });
  } else {
    it('is a v1 sheet: version "1", no pixelScale, drawn at the legacy 2×', () => {
      expect(sheet.meta.version).toBe('1');
      expect(sheet.meta.pixelScale).toBeUndefined();
      expect(sheet.palette?.mask).toBeUndefined();
      expect(sheetPixelScale(sheet)).toBe(LEGACY_PIXEL_SCALE);
    });
  }
}

describe('the palette', () => {
  it("holds the design system's 32 raw colours, each once, and the drawn clay tone's values among them", () => {
    const entries = Object.entries(paletteData.tokens);
    expect(entries).toHaveLength(32);
    const hexes = entries.map(([, h]) => h.toLowerCase());
    expect(new Set(hexes).size).toBe(32);
    for (const [name, hex] of entries) expect(hex, name).toMatch(/^#[0-9a-f]{6}$/);
    expect(paletteData.signals.hit).toBe(paletteData.tokens['signal-hit']);
    expect(paletteData.signals.telegraph).toEqual([paletteData.tokens['signal-telegraph'], paletteData.tokens['signal-telegraph-dark']]);
    const tones: Record<string, { skin: string; shade: string }> = paletteData.clay.tones;
    for (const [tone, t] of Object.entries(tones)) {
      expect(PALETTE.has(t.skin), `${tone} skin`).toBe(true);
      expect(PALETTE.has(t.shade), `${tone} shade`).toBe(true);
    }
    expect(tones[paletteData.clay.drawn]?.skin).toBe(paletteData.tokens['unwritten-sail']);
  });
});

describe('the v2 contract (sprites.md §2, §5)', () => {
  it('draws the world at 2× and M1 art at 2×', () => {
    expect(WORLD_PX_PER_UNIT).toBe(2);
    expect(LEGACY_PIXEL_SCALE).toBe(2);
  });

  it('puts the 64×64 canvas in each cell with the soles on the row above the origin', () => {
    expect(SPRITE_CANVAS).toEqual({ w: 64, h: 64, soleRow: 53 });
    expect(SPRITE_CELLS.kindled).toEqual({
      cell: { w: 96, h: 80 },
      origin: { x: 48, y: 64 },
      canvasAt: { x: 16, y: 10 },
    });
    expect(SPRITE_CELLS.other).toEqual({
      cell: { w: 64, h: 64 },
      origin: { x: 32, y: 54 },
      canvasAt: { x: 0, y: 0 },
    });
    for (const spec of Object.values(SPRITE_CELLS)) {
      // Canvas row 53 is the cell row just above the origin; the canvas is centred horizontally.
      expect(spec.canvasAt.y + SPRITE_CANVAS.soleRow).toBe(spec.origin.y - 1);
      expect(spec.canvasAt.x * 2 + SPRITE_CANVAS.w).toBe(spec.cell.w);
      expect(spec.origin.x).toBe(spec.cell.w / 2);
    }
    expect(spriteCellSpecFor('kindled-ash')).toBe(SPRITE_CELLS.kindled);
    expect(spriteCellSpecFor('husk-peeling')).toBe(SPRITE_CELLS.other);
    expect(spriteCellSpecFor('npc-tally')).toBe(SPRITE_CELLS.other);
    expect(skinMaskName('kindled-ash')).toBe('kindled-ash.skin.png');
  });

  it("derives the 28-colour whitelist from palette.json: the style sheet's list", () => {
    // art/anchors/style-sheet.md, "Whitelist (28)".
    const styleSheet =
      '#F4EFE6 #D9D2E9 #A99FC4 #5B5478 #2A2540 #F2B65A #C9733A #4A4E57 #7D8794 #3E5C7A #A8743A #C79A3E #8A6420 #E9E4D4 ' +
      '#2F7F7A #C98F78 #9C5B4A #E3C29E #24305A #E8E2D6 #FFF4C7 #8C7F6E #5E5448 #FBF8F0 #D8B24A #F07A3A #B5402E #1C2147';
    expect(SPRITE_WHITELIST).toHaveLength(28);
    expect([...SPRITE_WHITELIST].sort()).toEqual(styleSheet.toLowerCase().split(' ').sort());
    for (const banned of ['#ffffff', '#ffe7a3', ...paletteData.signals.telegraph]) expect(SPRITE_WHITELIST).not.toContain(banned);
  });

  describe('the checks catch a broken v2 sheet', () => {
    const sheet: SpriteSheet = fixtureSheet;
    let png: Rgba = { width: 0, height: 0, rgba: new Uint8Array(0) };
    let mask: Rgba = png;
    beforeAll(() => {
      png = decodePng(readFileSync(fixtureUrl(sheet.meta.image)));
      mask = decodePng(readFileSync(fixtureUrl(sheet.palette?.mask ?? '')));
    });
    const copy = (img: Rgba): Rgba => ({ ...img, rgba: img.rgba.slice() });
    const paint = (img: Rgba, x: number, y: number, hex: string, a = 255): void => {
      const i = (y * img.width + x) * 4;
      const v = parseInt(hex.slice(1), 16);
      img.rgba.set([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, a], i);
    };
    /** The first opaque pixel of a colour in the sheet. */
    const find = (hex: string): [number, number] => {
      for (let i = 0; i < png.width * png.height; i++) {
        if ((png.rgba[i * 4 + 3] ?? 0) === 0) continue;
        if (hexOf(png.rgba[i * 4] ?? 0, png.rgba[i * 4 + 1] ?? 0, png.rgba[i * 4 + 2] ?? 0) === hex)
          return [i % png.width, Math.floor(i / png.width)];
      }
      throw new Error(`no ${hex}`);
    };

    it('passes as drawn', () => {
      expect(v2Problems('kindled-fixture', sheet, png, mask)).toEqual([]);
    });

    it('a wrong cell, origin or pixel scale for the kind', () => {
      const husk = v2Problems('husk-fixture', sheet, png, mask);
      expect(husk.some((p) => p.startsWith('cell 96×80'))).toBe(true);
      expect(husk.some((p) => p.startsWith('origin (48, 64)'))).toBe(true);
      const scaled = { ...sheet, meta: { ...sheet.meta, pixelScale: 2 } };
      expect(v2Problems('kindled-fixture', scaled, png, mask)).toEqual(['meta.pixelScale is 2, not 1']);
    });

    it('a palette block on a sheet that is not Kindled', () => {
      expect(v2Problems('npc-fixture', sheet, png, mask)).toContain('a palette block on a npc sheet (only Kindled sheets have one)');
    });

    it('a pixel on a cell edge', () => {
      const p = copy(png);
      paint(p, 96 + 95, 40, paletteData.tokens['dream-night']);
      expect(v2Problems('kindled-fixture', sheet, p, mask)).toEqual(['opaque pixels on the outer 1 px ring (clipped?): idle_S_1']);
    });

    it('spark-glow, pure white, an off-palette colour, a telegraph colour outside a telegraph frame', () => {
      const p = copy(png);
      paint(p, 40, 40, paletteData.tokens['spark-glow']);
      paint(p, 41, 40, paletteData.signals.hit);
      paint(p, 42, 40, '#123456');
      paint(p, 43, 40, paletteData.tokens['signal-telegraph']);
      const problems = v2Problems('kindled-fixture', sheet, p, mask);
      expect(problems).toContain('colours outside the whitelist: #123456');
      expect(problems).toContain('colours never allowed in a sheet: #ffe7a3, #ffffff');
      expect(problems).toContain('telegraph colours outside telegraph frames: idle_S_0');
    });

    it('a mask that is missing, the wrong size, over a non-key colour, or leaves a key uncovered', () => {
      expect(v2Problems('kindled-fixture', sheet, png, null)).toEqual(['no skin mask']);
      expect(v2Problems('kindled-fixture', sheet, png, { width: 1, height: 1, rgba: new Uint8Array(4) })).toEqual(['mask 1×1, sheet 192×80']);
      const over = copy(mask);
      const [ex, ey] = find(paletteData.tokens['dream-night']);
      paint(over, ex, ey, '#ffffff');
      expect(v2Problems('kindled-fixture', sheet, png, over)).toEqual(['1 masked pixels are not a swap-key colour']);
      // Clear the mask over every shade pixel: the shade key is no longer covered.
      const bare = copy(mask);
      const shade = paletteData.clay.tones['clay-grey-ochre'].shade;
      for (let i = 0; i < png.width * png.height; i++) {
        if (hexOf(png.rgba[i * 4] ?? 0, png.rgba[i * 4 + 1] ?? 0, png.rgba[i * 4 + 2] ?? 0) === shade) bare.rgba[i * 4 + 3] = 0;
      }
      expect(v2Problems('kindled-fixture', sheet, png, bare)).toEqual([`swap keys with no masked pixel: ${shade}`]);
    });

    // The fixture's belt and boots are deliberately the skin-shade colour, unlike ART's sheets (which keep
    // skin colours for skin only), to prove the masked swap leaves non-skin pixels alone.
    it('leaves the belt and boots out of the mask though they share the skin shade', () => {
      const shade = paletteData.clay.tones['clay-grey-ochre'].shade;
      let masked = 0;
      let unmasked = 0;
      for (let i = 0; i < png.width * png.height; i++) {
        if ((png.rgba[i * 4 + 3] ?? 0) === 0) continue;
        if (hexOf(png.rgba[i * 4] ?? 0, png.rgba[i * 4 + 1] ?? 0, png.rgba[i * 4 + 2] ?? 0) !== shade) continue;
        if ((mask.rgba[i * 4 + 3] ?? 0) > 0) masked++;
        else unmasked++;
      }
      expect(masked).toBeGreaterThan(0);
      expect(unmasked).toBeGreaterThan(0);
    });
  });
});

describe('which kind a sheet is (spriteSheetSpec)', () => {
  it('maps each prefix to its kind, cell and table', () => {
    expect(spriteSheetSpec('kindled-ash')).toEqual({
      kind: 'kindled',
      cell: SPRITE_CELLS.kindled,
      anims: KINDLED_ANIMS,
      facings: true,
      palette: true,
    });
    expect(spriteSheetSpec('husk-peeling')).toEqual({
      kind: 'husk',
      cell: SPRITE_CELLS.other,
      anims: HUSK_TABLES.peeling,
      facings: false,
      palette: false,
    });
    expect(spriteSheetSpec('husk-nutshell').anims).toBe(HUSK_TABLES.nutshell);
    expect(spriteSheetSpec('npc-tally')).toEqual({
      kind: 'npc',
      cell: SPRITE_CELLS.other,
      anims: NPC_ANIMS,
      facings: true,
      palette: false,
    });
    expect(spriteSheetSpec('prop-clay-jar')).toEqual({
      kind: 'prop',
      cell: SPRITE_CELLS.other,
      anims: null,
      facings: false,
      palette: false,
    });
    // A Husk the contract has no table for yet.
    expect(spriteSheetSpec('husk-rind-eel').anims).toBeNull();
  });

  it('fails on an unknown prefix', () => {
    for (const name of ['peeling', 'enemy-peeling', 'kindled-', 'Kindled-ash', 'npctally']) {
      expect(() => spriteSheetSpec(name), name).toThrow(/has no known kind/);
    }
  });

  it('holds the Husk tables of sprites.md §4, without facings', () => {
    const rows = (t: readonly SpriteAnimSpec[]): [string, number, number, boolean, boolean][] =>
      t.map((a) => [a.name, a.frames, a.fps, a.loop, a.hold]);
    expect(rows(HUSK_TABLES.peeling)).toEqual([
      ['spawn', 4, 0, false, false],
      ['idle', 2, 3, true, false],
      ['telegraph', 2, 8, false, true],
      ['lunge', 3, 15, false, false],
      ['hit', 1, 0, false, true],
      ['chipped', 1, 0, false, true],
      ['death', 4, 10, false, true],
      ['drop', 1, 0, false, true],
    ]);
    expect(rows(HUSK_TABLES.nutshell)).toEqual([
      ['spawn', 4, 0, false, false],
      ['idle', 2, 2, true, false],
      ['walk', 4, 6, true, false],
      ['telegraph', 2, 8, false, true],
      ['slam', 2, 0, false, true],
      ['hit', 1, 0, false, true],
      ['chipped_outer', 1, 0, false, true],
      ['chipped_inner', 1, 0, false, true],
      ['regrow', 3, 6, false, true],
      ['death', 4, 10, false, true],
      ['drop', 1, 0, false, true],
    ]);
    for (const a of [...HUSK_TABLES.peeling, ...HUSK_TABLES.nutshell]) expect(a.facings).toEqual([]);
  });

  it('gives NPCs idle and walk in 8 facings, and props an idle of 1 to 8 frames', () => {
    expect(NPC_ANIMS.map((a) => [a.name, a.frames, a.fps, a.loop, a.hold, a.facings])).toEqual([
      ['idle', 2, 2, true, false, SPRITE_FACINGS],
      ['walk', 6, 10, true, false, SPRITE_FACINGS],
    ]);
    expect(PROP_IDLE).toEqual({ name: 'idle', minFrames: 1, maxFrames: 8, defaultFps: 8 });
    expect(propIdleSpec(4)).toEqual({
      name: 'idle',
      frames: 4,
      fps: 8,
      loop: true,
      hold: false,
      facings: [],
      milestone: 'M1',
    });
    expect(propIdleSpec(1, 0)).toEqual({
      name: 'idle',
      frames: 1,
      fps: 0,
      loop: false,
      hold: true,
      facings: [],
      milestone: 'M1',
    });
  });
});

describe('optional animations (milestones)', () => {
  /** A Kindled sheet's anims block carrying `rows` of the table, every facing and frame, as the pipeline writes it. */
  const animsOf = (rows: readonly SpriteAnimSpec[]): SpriteSheet['anims'] =>
    Object.fromEntries(
      rows.flatMap((a) =>
        a.facings.map((f) => [
          kindledAnimKey(a.name, f),
          {
            frames: Array.from({ length: a.frames }, (_, n) => kindledFrameName(a.name, f, n)),
            frameRate: a.fps,
            repeat: a.loop ? -1 : 0,
            ...(a.hold ? { hold: true } : {}),
          },
        ]),
      ),
    );
  const sheetWith = (anims: SpriteSheet['anims']): SpriteSheet => ({ ...fixtureSheet, anims });
  const m1 = KINDLED_ANIMS.filter(isRequiredAnim);

  it('makes carry and sit M2 and everything else M1, and requires M1 except what awaits art', () => {
    expect(REQUIRED_MILESTONE).toBe('M1');
    expect(KINDLED_ANIMS.filter((a) => a.milestone === 'M2').map((a) => a.name)).toEqual(['carry_idle', 'carry_walk', 'sit']);
    expect(ANIMS_AWAITING_ART).toEqual(['run']);
    expect(m1.map((a) => a.name)).toEqual(
      KINDLED_ANIMS.map((a) => a.name).filter((n) => !['carry_idle', 'carry_walk', 'sit', 'run'].includes(n)),
    );
    for (const a of [...HUSK_TABLES.peeling, ...HUSK_TABLES.nutshell, ...NPC_ANIMS]) expect(a.milestone, a.name).toBe('M1');
  });

  it('passes a finished Kindled sheet without carry and sit, and one with them', () => {
    expect(tableProblems('kindled-test', sheetWith(animsOf(m1)), KINDLED_ANIMS)).toEqual([]);
    expect(tableProblems('kindled-test', sheetWith(animsOf(KINDLED_ANIMS)), KINDLED_ANIMS)).toEqual([]);
  });

  it('fails an optional animation that is present but incomplete, and a missing required one', () => {
    const anims = animsOf(KINDLED_ANIMS);
    delete anims.sit_E;
    const walk = anims.carry_walk_N;
    if (walk) walk.frames = walk.frames.slice(0, 5);
    delete anims.dodge_SW;
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual([
      'dodge_SW is missing',
      'carry_walk_N has frames carry_walk_N_0, carry_walk_N_1, carry_walk_N_2, carry_walk_N_3, carry_walk_N_4; ' +
        'the table says carry_walk_N_0, carry_walk_N_1, carry_walk_N_2, carry_walk_N_3, carry_walk_N_4, carry_walk_N_5',
      'sit_E is missing (sit is optional until M2, but complete once present; required: M1)',
    ]);
  });

  it('has run in the Kindled table (6 frames, 8 facings, looping, M1), optional while it awaits art', () => {
    expect(KINDLED_ANIMS.find((a) => a.name === 'run')).toEqual({
      name: 'run',
      frames: 6,
      fps: 10,
      loop: true,
      hold: false,
      facings: SPRITE_FACINGS,
      milestone: 'M1',
    });
    expect(isRequiredAnim({ name: 'run', milestone: 'M1' })).toBe(false);
    expect(isRequiredAnim({ name: 'walk', milestone: 'M1' })).toBe(true);
    // Without run, and with every facing of it, the sheet passes; with run started but not finished, it fails.
    const withRun = KINDLED_ANIMS.filter((a) => isRequiredAnim(a) || a.name === 'run');
    expect(tableProblems('kindled-test', sheetWith(animsOf(withRun)), KINDLED_ANIMS)).toEqual([]);
    const anims = animsOf(withRun);
    delete anims.run_NW;
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual([
      'run_NW is missing (run is awaiting art, but complete once present; required: M1)',
    ]);
  });

  it('fails animations outside the table', () => {
    const anims = { ...animsOf(m1), sit_W: { frames: ['idle_S_0'], frameRate: 0, repeat: 0 } };
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual(['animations outside the table: sit_W']);
  });
});

describe('the sprite sheet table', () => {
  // M1's v1 cells (sprites.md §2); a sheet that has turned v2 is checked by v2Problems instead.
  const M1_CELLS: Record<string, { cell: { w: number; h: number }; origin: { x: number; y: number } }> = {
    'kindled-ash': { cell: { w: 48, h: 40 }, origin: { x: 24, y: 36 } },
    'husk-peeling': { cell: { w: 24, h: 24 }, origin: { x: 12, y: 18 } },
    'husk-nutshell': { cell: { w: 40, h: 40 }, origin: { x: 20, y: 34 } },
  };

  it('names the cell grid and origin of each M1 sheet still on v1 (sprites.md §2)', () => {
    for (const [name, sheet] of SHEETS) {
      if (isV2Sheet(sheet)) continue;
      const m1 = M1_CELLS[name];
      expect(m1, `${name} is a v1 sheet that M1 never had`).toBeDefined();
      expect({ cell: sheet.meta.cell, origin: sheet.meta.origin }, name).toEqual(m1);
    }
  });

  it('marks v1 sheets as placeholders and v2 sheets as built by the art pipeline', () => {
    for (const [name, sheet] of SHEETS) {
      expect(sheet.meta.app, name).toBe(isV2Sheet(sheet) ? 'iot-art-pipeline' : 'placeholder');
    }
  });
});

/** A prop's table from its own `idle`: 1 to 8 frames at the sheet's rate (sprites.md §4). */
function propTable(sheet: SpriteSheet): SpriteAnimSpec[] | null {
  const idle = sheet.anims[PROP_IDLE.name];
  if (!idle) return null;
  const n = idle.frames.length;
  if (n < PROP_IDLE.minFrames || n > PROP_IDLE.maxFrames) return null;
  return [propIdleSpec(n, idle.frameRate)];
}
