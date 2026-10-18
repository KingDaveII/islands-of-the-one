import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  itemIconsSheet,
  ITEMS,
  controllerGlyphsSheet,
  ENGINE_SHEET_DEFAULTS,
  engineSheetMeta,
  hookbladeFxSheet,
  paletteData,
  sheetCellNamed,
  type CellSheet,
  type HookbladeFxSheet,
  type SheetCell,
} from '../src/index.js';
import fixtureJson from './fixtures/hookblade-fixture.json' with { type: 'json' };
import { decodePng } from './png.js';
import { engineColourProblems, type Rgba } from './sheetChecks.js';

/**
 * Every cell sheet in packages/shared/assets against its PNG: the image
 * exists, cells lie inside it and don't overlap, every cell has ink, names are
 * unique, and the colours follow the sheet's `meta.tinted` (sprites.md "Engine
 * sheets"): a tinted sheet (the controller glyphs, M1's hookblade-fx) is
 * only white or transparent, an untinted one keeps to the v2 sprite colours.
 * The hookblade fixture (test/fixtures, a B sheet drawn in its own colours)
 * runs through the same checks.
 */
const fixtureSheet: HookbladeFxSheet = fixtureJson;
const SHEETS: [string, CellSheet & { meta?: { tinted?: boolean } }, (image: string) => URL][] = [
  [
    'controller-glyphs',
    controllerGlyphsSheet,
    (image) => new URL(`../assets/${image}`, import.meta.url),
  ],
  ['hookblade-fx', hookbladeFxSheet, (image) => new URL(`../assets/${image}`, import.meta.url)],
  ['item-icons', itemIconsSheet, (image) => new URL(`../assets/${image}`, import.meta.url)],
  ['hookblade-fixture', fixtureSheet, (image) => new URL(`./fixtures/${image}`, import.meta.url)],
];

/** What breaks a tinted sheet's colours: any opaque pixel that is not pure white, or a soft alpha. */
function tintedColourProblems(png: Rgba): string[] {
  const out: string[] = [];
  for (let i = 0; i < png.width * png.height; i++) {
    const [r, g, b, a] = [0, 1, 2, 3].map((k) => png.rgba[i * 4 + k] ?? 0);
    if (a === 0) continue;
    if (a !== 255 || r !== 255 || g !== 255 || b !== 255)
      out.push(`pixel ${i % png.width},${Math.floor(i / png.width)}`);
  }
  return out;
}

const overlaps = (a: SheetCell, b: SheetCell): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each(SHEETS)('the %s sheet', (_name, sheet, url) => {
  const file = url(sheet.image);

  it('has its image next to it', () => {
    expect(existsSync(file), sheet.image).toBe(true);
  });

  let png: ReturnType<typeof decodePng> = { width: 0, height: 0, rgba: new Uint8Array(0) };
  beforeAll(() => {
    png = decodePng(readFileSync(file));
  });
  const alpha = (x: number, y: number): number => png.rgba[(y * png.width + x) * 4 + 3] ?? 0;

  it('lists at least one cell, every one with a positive size inside the PNG', () => {
    expect(sheet.cells.length).toBeGreaterThan(0);
    for (const c of sheet.cells) {
      expect(c.w, c.name).toBeGreaterThan(0);
      expect(c.h, c.name).toBeGreaterThan(0);
      expect(c.x, c.name).toBeGreaterThanOrEqual(0);
      expect(c.y, c.name).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w, c.name).toBeLessThanOrEqual(png.width);
      expect(c.y + c.h, c.name).toBeLessThanOrEqual(png.height);
    }
  });

  it('has no two cells overlapping', () => {
    for (let i = 0; i < sheet.cells.length; i++) {
      for (let j = i + 1; j < sheet.cells.length; j++) {
        const a = sheet.cells[i] as SheetCell;
        const b = sheet.cells[j] as SheetCell;
        expect(overlaps(a, b), `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it('has at least one opaque pixel in every cell', () => {
    for (const c of sheet.cells) {
      let ink = 0;
      for (let y = c.y; y < c.y + c.h; y++) {
        for (let x = c.x; x < c.x + c.w; x++) if (alpha(x, y) > 127) ink++;
      }
      expect(ink, c.name).toBeGreaterThan(0);
    }
  });

  it('names every cell once', () => {
    const names = sheet.cells.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(sheetCellNamed(sheet, name)?.name).toBe(name);
  });

  const tinted = sheet.meta?.tinted ?? ENGINE_SHEET_DEFAULTS.tinted;
  it(
    tinted
      ? 'is white on transparent only (tinted at draw time)'
      : 'keeps to the v2 sprite colours (drawn untinted)',
    () => {
      expect(tinted ? tintedColourProblems(png) : engineColourProblems(png)).toEqual([]);
    },
  );
});

describe('the controller glyphs sheet', () => {
  it('is a grid of 12 px cells', () => {
    expect(controllerGlyphsSheet.cell).toBe(12);
    for (const c of controllerGlyphsSheet.cells) {
      expect([c.w, c.h], c.name).toEqual([12, 12]);
      expect(c.x % 12, c.name).toBe(0);
      expect(c.y % 12, c.name).toBe(0);
    }
  });
});

describe('the hookblade-fx sheet', () => {
  const has = (name: string): boolean => sheetCellNamed(hookbladeFxSheet, name) !== undefined;

  it('names existing cells from its anims, chain and hook blocks', () => {
    for (const [anim, def] of Object.entries(hookbladeFxSheet.anims)) {
      expect(def.frames.length, anim).toBeGreaterThan(0);
      for (const frame of def.frames) expect(has(frame), `${anim}: ${frame}`).toBe(true);
    }
    const { chain, hook } = hookbladeFxSheet;
    expect(has(chain.link), chain.link).toBe(true);
    expect(has(chain.taut), chain.taut).toBe(true);
    expect(chain.spacing).toBeGreaterThan(0);
    expect(has(hook.flight), hook.flight).toBe(true);
    expect(has(hook.set), hook.set).toBe(true);
    const flight = sheetCellNamed(hookbladeFxSheet, hook.flight) as SheetCell;
    const [ox, oy] = hook.origin;
    expect(ox).toBeGreaterThanOrEqual(0);
    expect(oy).toBeGreaterThanOrEqual(0);
    expect(ox).toBeLessThan(flight.w);
    expect(oy).toBeLessThan(flight.h);
  });
});

describe('engine sheet meta (sprites.md "Engine sheets")', () => {
  it('reads a sheet without meta as version 1, drawn at 2, tinted; the shipped hookblade-fx is the B redraw', () => {
    expect(ENGINE_SHEET_DEFAULTS).toEqual({ version: '1', pixelScale: 2, tinted: true });
    expect(engineSheetMeta({})).toEqual(ENGINE_SHEET_DEFAULTS);
    expect(hookbladeFxSheet.meta).toEqual({ version: '2', pixelScale: 1, tinted: false });
    expect(engineSheetMeta(hookbladeFxSheet)).toEqual({
      version: '2',
      pixelScale: 1,
      tinted: false,
    });
    expect(engineSheetMeta({ meta: { tinted: false } })).toEqual({
      version: '1',
      pixelScale: 2,
      tinted: false,
    });
  });

  it("reads the fixture as ART's B redraw: version 2, at 1, untinted", () => {
    expect(engineSheetMeta(fixtureSheet)).toEqual({ version: '2', pixelScale: 1, tinted: false });
  });

  describe('checks the colours by meta.tinted', () => {
    let fixture: Rgba = { width: 0, height: 0, rgba: new Uint8Array(0) };
    let shipped: Rgba = fixture;
    let glyphs: Rgba = fixture;
    beforeAll(() => {
      fixture = decodePng(
        readFileSync(new URL(`./fixtures/${fixtureSheet.image}`, import.meta.url)),
      );
      shipped = decodePng(
        readFileSync(new URL(`../assets/${hookbladeFxSheet.image}`, import.meta.url)),
      );
      glyphs = decodePng(
        readFileSync(new URL(`../assets/${controllerGlyphsSheet.image}`, import.meta.url)),
      );
    });
    const paint = (img: Rgba, x: number, y: number, hex: string): Rgba => {
      const out = { ...img, rgba: img.rgba.slice() };
      const v = parseInt(hex.slice(1), 16);
      out.rgba.set([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 255], (y * img.width + x) * 4);
      return out;
    };

    it('tinted: white shapes pass, a coloured sheet fails', () => {
      expect(tintedColourProblems(glyphs)).toEqual([]);
      expect(tintedColourProblems(fixture).length).toBeGreaterThan(0);
      expect(tintedColourProblems(shipped).length).toBeGreaterThan(0);
    });

    it('untinted: the whitelist passes; pure white, spark-glow, a telegraph colour or an off-palette colour fails', () => {
      expect(engineColourProblems(fixture)).toEqual([]);
      expect(engineColourProblems(shipped)).toEqual([]);
      expect(engineColourProblems(glyphs)).toEqual(['colours never allowed in a sheet: #ffffff']);
      const broken = [
        paletteData.tokens['spark-glow'],
        paletteData.tokens['signal-telegraph'],
        '#123456',
      ].reduce((img, hex, i) => paint(img, 7 + i, 0, hex), fixture);
      expect(engineColourProblems(broken)).toEqual([
        'colours outside the whitelist: #123456',
        'colours never allowed in a sheet: #ffe7a3',
        'telegraph colours (only Husk telegraph frames may use them): #e0457b',
      ]);
    });
  });
});

describe('the item icons (ART, #77)', () => {
  it('has one 16 px cell per item in items.json, named by its id, and no other', () => {
    expect(itemIconsSheet.cells.map((c) => c.name).sort()).toEqual(ITEMS.map((i) => i.id).sort());
    for (const c of itemIconsSheet.cells) expect([c.name, c.w, c.h]).toEqual([c.name, 16, 16]);
    expect(engineSheetMeta(itemIconsSheet).tinted).toBe(false);
  });
});
