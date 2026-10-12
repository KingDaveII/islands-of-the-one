import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  controllerGlyphsSheet,
  hookbladeFxSheet,
  sheetCellNamed,
  type CellSheet,
  type SheetCell,
} from '../src/index.js';
import { decodePng } from './png.js';

/**
 * Every cell sheet in packages/shared/assets against its PNG: the image
 * exists, cells lie inside it and don't overlap, every cell has ink, names are
 * unique, and the pixels are only white or transparent (the sheets are tinted
 * at draw time).
 */
const SHEETS: [string, CellSheet][] = [
  ['controller-glyphs', controllerGlyphsSheet],
  ['hookblade-fx', hookbladeFxSheet],
];

const assetUrl = (image: string): URL => new URL(`../assets/${image}`, import.meta.url);

const overlaps = (a: SheetCell, b: SheetCell): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe.each(SHEETS)('the %s sheet', (_name, sheet) => {
  const file = assetUrl(sheet.image);

  it('has its image next to it', () => {
    expect(existsSync(file), sheet.image).toBe(true);
  });

  const png = decodePng(readFileSync(file));
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

  it('is white on transparent only (tinted at draw time)', () => {
    for (let i = 0; i < png.width * png.height; i++) {
      const [r, g, b, a] = [0, 1, 2, 3].map((k) => png.rgba[i * 4 + k] ?? 0);
      const pixel = `pixel ${i % png.width},${Math.floor(i / png.width)}`;
      expect(a === 0 || a === 255, pixel).toBe(true);
      if (a === 255) expect([r, g, b], pixel).toEqual([255, 255, 255]);
    }
  });
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
