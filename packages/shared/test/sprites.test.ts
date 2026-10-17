import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLAY_TONES,
  framePoint,
  hexOf,
  KINDLED_POINT_ANIMS,
  KINDLED_POINTS,
  spritePointsFor,
  kindledAnimKey,
  kindledFrameName,
  HUSK_TABLES,
  ANIMS_AWAITING_ART,
  KINDLED_ANIMS,
  NPC_ANIMS,
  paletteData,
  CHEST_ANIMS,
  CHEST_CLOSED,
  CHEST_SHEET,
  propAnimSpec,
  propFrameName,
  propFrameRangeProblem,
  propIdleSpec,
  propRecipeAnims,
  propTableFor,
  PROP_IDLE,
  PROP_TABLES,
  REQUIRED_MILESTONE,
  isRequiredAnim,
  optionalReason,
  skinMaskName,
  SPRITE_CANVAS,
  SPRITE_CELLS,
  SPRITE_FACINGS,
  SPRITE_SHEET_NAMES,
  SPRITE_SHEET_VERSION,
  SPRITE_WHITELIST,
  spriteCellSpecFor,
  spriteSheetSpec,
  type SpriteAnimSpec,
  spriteSheets,
  WORLD_PX_PER_UNIT,
  type SpriteSheet,
  caveTileSheet,
  CAVE_TILE_SHEET,
  isTileSheetName,
  type TileSheet,
} from '../src/index.js';
import fixtureSheet from './fixtures/kindled-fixture.json' with { type: 'json' };
import chestFixture from './fixtures/prop-chest.json' with { type: 'json' };
import { decodePng } from './png.js';
import { pointProblems, tableProblems, V1_RETIRED, v2Problems, type Rgba } from './sheetChecks.js';
import { tileSheetProblems } from './tileChecks.js';

/**
 * Every animated sheet in packages/shared/assets/sprites against its PNG
 * (docs/design/sprites.md §6): the image matches `meta`, frames sit on the
 * cell grid, every anim frame exists and every frame is used, Kindled sheets
 * carry their table's animation × facing matrix up to REQUIRED_MILESTONE (later rows
 * absent or complete), the anchor is the origin, every
 * opaque pixel is a palette token (telegraph colours only in telegraph
 * frames, pure white nowhere) and the palette swaps are valid. Every sheet
 * follows the v2 contract (sheetChecks.ts): version "2" (a v1 sheet, M1's
 * art at 2×, is retired and rejected), its kind's cell and origin, pixelScale
 * 1, nothing clipped at a cell's edge, the colour whitelist, and its skin
 * mask. The v2 fixture in test/fixtures runs through the same checks.
 */
const SPRITE_DIR = new URL('../assets/sprites/', import.meta.url);
const ON_DISK = readdirSync(SPRITE_DIR).sort();
/** Every sheet on disk, by its JSON (masks, `*.skin.png`, belong to a sheet and are checked with it). */
const ALL_SHEETS: [string, unknown][] = ON_DISK.filter((f) => f.endsWith('.json')).map((f) => [
  f.slice(0, -'.json'.length),
  JSON.parse(readFileSync(new URL(f, SPRITE_DIR), 'utf8')) as unknown,
]);
/** The animated sheets; tile sheets (`tiles-<set>`) have pieces of several sizes and their own checks (tileChecks.ts). */
const SHEETS = ALL_SHEETS.filter(([name]) => !isTileSheetName(name)) as [string, SpriteSheet][];
const TILE_SHEETS = ALL_SHEETS.filter(([name]) => isTileSheetName(name)) as [string, TileSheet][];

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

  it('name a known kind each (kindled-, husk-, npc-, prop-, tiles-)', () => {
    for (const [name] of ALL_SHEETS) expect(() => spriteSheetSpec(name), name).not.toThrow();
  });

  it("hold every sheet the client loads (SPRITE_SHEET_NAMES), as the client's import has it", () => {
    const disk = new Map(SHEETS);
    for (const name of SPRITE_SHEET_NAMES) {
      expect(disk.has(name), `${name} is not on disk`).toBe(true);
      expect(spriteSheets[name], name).toEqual(disk.get(name));
    }
    // The chest is one of them (G1.5g): the engine draws every chest from it, with no fallback.
    expect(SPRITE_SHEET_NAMES).toContain(CHEST_SHEET);
  });

  it("hold the tile sheet the client draws every room from (tiles-cave), as the client's import has it", () => {
    const disk = new Map(TILE_SHEETS);
    expect(disk.has(CAVE_TILE_SHEET), `${CAVE_TILE_SHEET} is not on disk`).toBe(true);
    expect(caveTileSheet).toEqual(disk.get(CAVE_TILE_SHEET));
  });

  it('are all v2 sheets built by the art pipeline: v1 sprite sheets are retired', () => {
    for (const [name, sheet] of ALL_SHEETS as [string, SpriteSheet][]) {
      expect(sheet.meta.version, `${name}: ${V1_RETIRED}`).toBe(SPRITE_SHEET_VERSION);
      expect(sheet.meta.app, name).toBe('iot-art-pipeline');
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

for (const [name, sheet] of TILE_SHEETS) {
  describe(`the ${name} tile sheet`, () => {
    it('follows the tile contract (sprites.md "Tiles", §6) and was built by the art pipeline', () => {
      const png = decodePng(readFileSync(assetUrl(sheet.meta.image)));
      expect(tileSheetProblems(name, sheet, png)).toEqual([]);
      expect(sheet.meta.app).toBe('iot-art-pipeline');
    });
  });
}

describe('the v2 fixture sheet (test/fixtures/kindled-fixture)', () => {
  const sheet: SpriteSheet = fixtureSheet;
  it('is a v2 Kindled sheet', () => {
    expect(sheet.meta.version).toBe(SPRITE_SHEET_VERSION);
    expect(sheet.meta.pixelScale).toBe(1);
  });
  sheetSuite('kindled-fixture', sheet, fixtureUrl, false);
});

describe('the chest fixture sheet (test/fixtures/prop-chest)', () => {
  const sheet: SpriteSheet = chestFixture;
  it('is a v2 prop sheet with the chest table: closed (2 frames), opening (4), open (1)', () => {
    expect(sheet.meta.version).toBe(SPRITE_SHEET_VERSION);
    expect(Object.keys(sheet.anims)).toEqual([...CHEST_ANIMS]);
    expect(sheet.anims.closed?.frames).toEqual(['closed_0', 'closed_1']);
  });
  // Shipped: the fixture carries the whole table, like ART's finished sheet must.
  sheetSuite(CHEST_SHEET, sheet, fixtureUrl, true);
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
      const table = kind.kind === 'prop' ? propTable(name, sheet) : kind.anims;
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

  it(`is a v2 sheet (${V1_RETIRED})`, () => {
    expect(sheet.meta.version, V1_RETIRED).toBe(SPRITE_SHEET_VERSION);
  });

  it('follows the v2 contract: cell, origin, pixelScale, nothing clipped, the whitelist, the skin mask', () => {
    const maskFile = sheet.palette ? url(sheet.palette.mask) : null;
    if (maskFile) expect(existsSync(maskFile), sheet.palette?.mask).toBe(true);
    const mask = maskFile && existsSync(maskFile) ? decodePng(readFileSync(maskFile)) : null;
    expect(v2Problems(name, sheet, png, mask)).toEqual([]);
  });

  it(`carries its points: known names, only where allowed, inside the cell${shipped ? ', every required one' : ''}`, () => {
    expect(pointProblems(name, sheet, shipped)).toEqual([]);
  });
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
  it('draws the world at 2× and every sprite sheet at 1 world px per sheet px', () => {
    expect(WORLD_PX_PER_UNIT).toBe(2);
    expect(SPRITE_SHEET_VERSION).toBe('2');
    for (const [name, sheet] of SHEETS) expect(sheet.meta.pixelScale, name).toBe(1);
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

    it('a v1 sheet: version "1" is retired, whatever else it gets right', () => {
      const v1 = { ...sheet, meta: { ...sheet.meta, version: '1' } };
      expect(v2Problems('kindled-fixture', v1, png, mask)).toEqual([`meta.version is 1, not "2": ${V1_RETIRED}`]);
      // Its points follow the same rules as any other sheet's: no v1 rules remain.
      expect(pointProblems('kindled-fixture', v1, false)).toEqual([]);
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

describe('points (sprites.md §5)', () => {
  it('names tip and hand, required on heavy_charge and the four haul animations of a Kindled sheet', () => {
    expect(KINDLED_POINTS).toEqual(['tip', 'hand']);
    expect(KINDLED_POINT_ANIMS).toEqual({
      tip: ['heavy_charge'],
      hand: ['haul_throw', 'haul_pull', 'haul_slide', 'haul_recover'],
    });
    expect(spritePointsFor('kindled-ash', 'heavy_charge')).toEqual(['tip']);
    expect(spritePointsFor('kindled-ash', 'haul_slide')).toEqual(['hand']);
    expect(spritePointsFor('kindled-ash', 'heavy_thrust')).toEqual([]);
    expect(spritePointsFor('husk-peeling', 'heavy_charge')).toEqual([]);
    for (const anims of Object.values(KINDLED_POINT_ANIMS)) {
      for (const a of anims) expect(KINDLED_ANIMS.map((r) => r.name)).toContain(a);
    }
  });

  /** The fixture's cells as a sheet with heavy_charge_S (2 frames) and haul_throw_W (1 frame), points as given. */
  const cell = fixtureSheet.frames.idle_S_0;
  const withPoints = (points: Record<string, Record<string, number[]> | undefined>): SpriteSheet => {
    const frame = (x: number, p: Record<string, number[]> | undefined) => ({
      ...cell,
      frame: { ...cell.frame, x },
      ...(p ? { points: p } : {}),
    });
    return {
      ...fixtureSheet,
      frames: {
        heavy_charge_S_0: frame(0, points.heavy_charge_S_0),
        heavy_charge_S_1: frame(96, points.heavy_charge_S_1),
        haul_throw_W_0: frame(192, points.haul_throw_W_0),
        idle_S_0: frame(288, points.idle_S_0),
      },
      anims: {
        heavy_charge_S: { frames: ['heavy_charge_S_0', 'heavy_charge_S_1'], frameRate: 12, repeat: 0, hold: true },
        haul_throw_W: { frames: ['haul_throw_W_0'], frameRate: 15, repeat: 0, hold: true },
        idle_S: { frames: ['idle_S_0'], frameRate: 2, repeat: -1 },
      },
    };
  };
  const good = {
    heavy_charge_S_0: { tip: [30, 40] },
    heavy_charge_S_1: { tip: [29, 41] },
    haul_throw_W_0: { hand: [60, 37] },
  };

  it('passes a sheet with every required point', () => {
    expect(pointProblems('kindled-test', withPoints(good))).toEqual([]);
  });

  it('fails a missing required point on a finished sheet only', () => {
    const sheet = withPoints({ ...good, heavy_charge_S_1: undefined, haul_throw_W_0: { tip: [40, 40] } });
    expect(pointProblems('kindled-test', sheet)).toEqual([
      'haul_throw_W_0: a tip point, but its animation carries hand',
      'heavy_charge_S_1 has no tip point',
      'haul_throw_W_0 has no hand point',
    ]);
    expect(pointProblems('kindled-test', sheet, false)).toEqual(['haul_throw_W_0: a tip point, but its animation carries hand']);
  });

  it('fails an unknown name and a point on a frame that may not carry one', () => {
    const sheet = withPoints({ ...good, heavy_charge_S_0: { tip: [30, 40], hilt: [20, 20] }, idle_S_0: { hand: [30, 30] } });
    expect(pointProblems('kindled-test', sheet)).toEqual([
      'heavy_charge_S_0: unknown point "hilt"',
      'idle_S_0: a hand point, but its animation carries no points',
    ]);
  });

  it('fails a point outside the cell or on its outer 1 px ring, or not two whole numbers', () => {
    const sheet = withPoints({
      heavy_charge_S_0: { tip: [95, 40] },
      heavy_charge_S_1: { tip: [12, 0] },
      haul_throw_W_0: { hand: [96.5, 3] },
    });
    expect(pointProblems('kindled-test', sheet)).toEqual([
      'heavy_charge_S_0: tip at (95, 40) is outside the 96×80 cell or on its outer 1 px ring',
      'heavy_charge_S_1: tip at (12, 0) is outside the 96×80 cell or on its outer 1 px ring',
      'haul_throw_W_0: hand is [96.5,3], not [x, y] in whole pixels',
    ]);
    expect(pointProblems('kindled-test', withPoints({ ...good, heavy_charge_S_0: { tip: [94, 78] } }))).toEqual([]);
  });

  it('reads a point as { x, y } in the cell, null where a frame has none', () => {
    const sheet = withPoints(good);
    expect(framePoint(sheet, 'heavy_charge_S_1', 'tip')).toEqual({ x: 29, y: 41 });
    expect(framePoint(sheet, 'heavy_charge_S_1', 'hand')).toBeNull();
    expect(framePoint(sheet, 'idle_S_0', 'tip')).toBeNull();
    expect(framePoint(sheet, 'no_such_frame', 'tip')).toBeNull();
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
    // The chest, the first prop with a table of its own (G1.5f); a prop named like a table's key is one too.
    expect(spriteSheetSpec('prop-chest')).toEqual({
      kind: 'prop',
      cell: SPRITE_CELLS.other,
      anims: PROP_TABLES.chest,
      facings: false,
      palette: false,
    });
    expect(CHEST_SHEET).toBe('prop-chest');
    for (const name of ['prop-chests', 'prop-chest-old', 'prop-constructor', 'prop-toString'])
      expect(spriteSheetSpec(name).anims, name).toBeNull();
  });

  it('holds the chest table of sprites.md §4: closed 1 or 2 frames at the recipe\'s rate, opening 4 at 12, open held', () => {
    const rows = (t: readonly SpriteAnimSpec[]): [string, number, number, boolean, boolean][] =>
      t.map((a) => [a.name, a.frames, a.fps, a.loop, a.hold]);
    expect(rows(PROP_TABLES.chest)).toEqual([
      ['closed', 2, 8, true, false],
      ['opening', 4, 12, false, true],
      ['open', 1, 0, false, true],
    ]);
    expect(PROP_TABLES.chest.map((a) => a.name)).toEqual([...CHEST_ANIMS]);
    for (const a of PROP_TABLES.chest) {
      expect(a.facings, a.name).toEqual([]);
      expect(a.milestone, a.name).toBe('M1');
      expect(isRequiredAnim(a), a.name).toBe(true);
    }
    expect(PROP_TABLES.chest[0]?.fromRecipe).toBe(CHEST_CLOSED);
    expect(CHEST_CLOSED).toEqual({ name: 'closed', minFrames: 1, maxFrames: 2, defaultFps: 8 });
    expect(PROP_TABLES.chest.slice(1).map((a) => a.fromRecipe)).toEqual([undefined, undefined]);
    expect(propRecipeAnims('prop-chest')).toEqual([CHEST_CLOSED]);
    expect(propRecipeAnims('prop-jar')).toEqual([PROP_IDLE]);
    expect(propRecipeAnims('husk-peeling')).toEqual([]);
    expect(propFrameName('opening', 3)).toBe('opening_3');
  });

  it('resolves a prop table to what the recipe or the sheet gives its recipe-rated rows (propTableFor)', () => {
    // The chest's closed at 2 frames and 2 fps (the glint), or 1 frame, still; opening and open as the table has them.
    const glint = propTableFor('prop-chest', (a) => (a === 'closed' ? { frames: 2, fps: 2 } : undefined));
    expect(glint?.map((a) => [a.name, a.frames, a.fps, a.loop, a.hold])).toEqual([
      ['closed', 2, 2, true, false],
      ['opening', 4, 12, false, true],
      ['open', 1, 0, false, true],
    ]);
    expect(glint?.[0]?.fromRecipe).toBe(CHEST_CLOSED);
    const still = propTableFor('prop-chest', (a) => (a === 'closed' ? { frames: 1 } : undefined));
    expect(still?.[0]).toEqual({ ...propAnimSpec(CHEST_CLOSED, 1), fps: 8 });
    expect(still?.[0]).toMatchObject({ frames: 1, loop: false, hold: true });
    // Given nothing, closed keeps its most frames at the default rate; a count out of range stays for the checks.
    expect(propTableFor('prop-chest', () => undefined)).toEqual(PROP_TABLES.chest);
    expect(propTableFor('prop-chest', () => ({ frames: 3 }))?.[0]?.frames).toBe(3);
    expect(propFrameRangeProblem(CHEST_CLOSED, 3)).toBe("a prop's closed has 1 to 2 frames, not 3");
    expect(propFrameRangeProblem(CHEST_CLOSED, 2)).toBeNull();
    expect(propFrameRangeProblem(PROP_IDLE, 9)).toBe("a prop's idle has 1 to 8 frames, not 9");
    // A prop without a table still gets idle from the recipe, 1 to 8 frames.
    expect(propTableFor('prop-jar', () => ({ frames: 4, fps: 12 }))).toEqual([propIdleSpec(4, 12)]);
    expect(propTableFor('prop-jar', () => undefined)).toEqual([propIdleSpec(8)]);
    expect(propTableFor('husk-peeling', () => undefined)).toBeNull();
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
      fromRecipe: PROP_IDLE,
    });
    expect(propIdleSpec(1, 0)).toEqual({
      name: 'idle',
      frames: 1,
      fps: 0,
      loop: false,
      hold: true,
      facings: [],
      milestone: 'M1',
      fromRecipe: PROP_IDLE,
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

  it('makes carry and sit M2 and everything else M1, and requires every M1 row but the three awaiting art', () => {
    expect(REQUIRED_MILESTONE).toBe('M1');
    expect(KINDLED_ANIMS.filter((a) => a.milestone === 'M2').map((a) => a.name)).toEqual(['carry_idle', 'carry_walk', 'sit']);
    // The run transitions and run_back (M1 polish, ART 2026-10-17) are M1 rows optional until ART's frames land.
    expect(ANIMS_AWAITING_ART).toEqual(['run_start', 'run_stop', 'run_back']);
    expect(m1.map((a) => a.name)).toEqual(
      KINDLED_ANIMS.map((a) => a.name).filter(
        (n) => !['carry_idle', 'carry_walk', 'sit', 'run_start', 'run_stop', 'run_back'].includes(n),
      ),
    );
    for (const name of ANIMS_AWAITING_ART) {
      expect(isRequiredAnim({ name, milestone: 'M1' }), name).toBe(false);
      expect(optionalReason({ name, milestone: 'M1' }), name).toBe('awaiting art');
    }
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

  it('has run in the Kindled table (8 frames, 8 facings, looping, M1), required now that ART drew it', () => {
    expect(KINDLED_ANIMS.find((a) => a.name === 'run')).toEqual({
      name: 'run',
      frames: 8,
      fps: 16,
      loop: true,
      hold: false,
      facings: SPRITE_FACINGS,
      milestone: 'M1',
    });
    expect(isRequiredAnim({ name: 'run', milestone: 'M1' })).toBe(true);
    expect(isRequiredAnim({ name: 'walk', milestone: 'M1' })).toBe(true);
    // With every facing of run the sheet passes; with a facing missing, or no run at all, it fails.
    expect(tableProblems('kindled-test', sheetWith(animsOf(m1)), KINDLED_ANIMS)).toEqual([]);
    const anims = animsOf(m1);
    delete anims.run_NW;
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual(['run_NW is missing']);
    const noRun = animsOf(m1.filter((a) => a.name !== 'run'));
    expect(tableProblems('kindled-test', sheetWith(noRun), KINDLED_ANIMS)).toEqual(
      SPRITE_FACINGS.map((f) => `run_${f} is missing`),
    );
  });

  it('has the run transitions and run_back in the Kindled table (ART 2026-10-17): 8 facings, optional until drawn, complete when present', () => {
    const rows = KINDLED_ANIMS.filter((a) => ['run_start', 'run_stop', 'run_back'].includes(a.name));
    expect(rows.map((a) => [a.name, a.frames, a.fps, a.loop, a.hold, a.facings.length, a.milestone])).toEqual([
      ['run_start', 2, 20, false, false, 8, 'M1'],
      ['run_stop', 2, 20, false, false, 8, 'M1'],
      ['run_back', 4, 0, true, false, 8, 'M1'],
    ]);
    // A finished sheet passes without them, and with all of them; one facing of run_back alone fails.
    expect(tableProblems('kindled-test', sheetWith(animsOf(m1)), KINDLED_ANIMS)).toEqual([]);
    expect(tableProblems('kindled-test', sheetWith(animsOf([...m1, ...rows])), KINDLED_ANIMS)).toEqual([]);
    const anims = animsOf([...m1, ...rows]);
    delete anims.run_back_SW;
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual([
      'run_back_SW is missing (run_back is awaiting art, but complete once present; required: M1)',
    ]);
  });

  it('fails animations outside the table', () => {
    const anims = { ...animsOf(m1), sit_W: { frames: ['idle_S_0'], frameRate: 0, repeat: 0 } };
    expect(tableProblems('kindled-test', sheetWith(anims), KINDLED_ANIMS)).toEqual(['animations outside the table: sit_W']);
  });
});

describe('the chest table on a sheet (tableProblems on test/fixtures/prop-chest)', () => {
  const chest = (anims: SpriteSheet['anims']): SpriteSheet => ({ ...chestFixture, anims });
  const check = (sheet: SpriteSheet): string[] => tableProblems(CHEST_SHEET, sheet, propTable(CHEST_SHEET, sheet) ?? []);

  it('passes the fixture: a 2-frame closed looping at its own rate, opening once at 12 fps, open held', () => {
    expect(check(chestFixture)).toEqual([]);
  });

  it('passes a 1-frame closed, still and held, with no glint', () => {
    const still = chest({ ...chestFixture.anims, closed: { frames: ['closed_0'], frameRate: 0, repeat: 0, hold: true } });
    expect(check(still)).toEqual([]);
    const looping = chest({ ...chestFixture.anims, closed: { frames: ['closed_0'], frameRate: 8, repeat: -1 } });
    expect(check(looping)).toEqual(['closed has repeat -1; the table says 0', 'closed has hold false; the table says true']);
  });

  it('fails a 3-frame closed, a 2-frame closed that does not loop, and opening at the wrong count or rate', () => {
    const three = chest({ ...chestFixture.anims, closed: { frames: ['closed_0', 'closed_1', 'closed_0'], frameRate: 2, repeat: -1 } });
    expect(check(three)).toEqual(["closed has 3 frames; a prop's closed has 1 to 2 frames, not 3"]);
    const held = chest({ ...chestFixture.anims, closed: { frames: ['closed_0', 'closed_1'], frameRate: 2, repeat: 0, hold: true } });
    expect(check(held)).toEqual(['closed has repeat 0; the table says -1', 'closed has hold true; the table says false']);
    const slow = chest({
      ...chestFixture.anims,
      opening: { frames: ['opening_0', 'opening_1', 'opening_2'], frameRate: 8, repeat: 0, hold: true },
    });
    expect(check(slow)).toEqual([
      'opening has frames opening_0, opening_1, opening_2; the table says opening_0, opening_1, opening_2, opening_3',
      'opening runs at 8 fps; the table says 12',
    ]);
  });

  it('fails a finished chest without opening, or with an animation outside the table', () => {
    const rest = Object.fromEntries(Object.entries(chestFixture.anims).filter(([k]) => k !== 'opening'));
    expect(check(chest(rest))).toEqual(['opening is missing']);
    expect(check(chest({ ...chestFixture.anims, idle: { frames: ['closed_0'], frameRate: 8, repeat: -1 } }))).toEqual([
      'animations outside the table: idle',
    ]);
  });
});

/** A prop's table resolved from its own sheet: its recipe-rated rows (`idle`, the chest's `closed`) at the sheet's count and rate (sprites.md §4). */
function propTable(name: string, sheet: SpriteSheet): SpriteAnimSpec[] | null {
  return propTableFor(name, (anim) => {
    const def = sheet.anims[anim];
    return def ? { frames: def.frames.length, fps: def.frameRate } : undefined;
  });
}
