import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FINAL_FORMS, LETTER_COUNT, OLD_LETTERS, oldLettersSheet as sheet } from '../src/index.js';
import { decodePng } from './png.js';

const png = decodePng(readFileSync(new URL(`../assets/${sheet.image}`, import.meta.url)));

/** Ink columns of a cell (columns with at least one opaque pixel). */
function inkColumns(cell: number): number[] {
  const cols: number[] = [];
  for (let x = 0; x < sheet.cell; x++) {
    for (let y = 0; y < sheet.height; y++) {
      const i = (y * png.width + cell * sheet.cell + x) * 4 + 3;
      if ((png.rgba[i] ?? 0) > 127) {
        cols.push(x);
        break;
      }
    }
  }
  return cols;
}

describe('the Old Letters sheet', () => {
  it('is one row of 7 px cells, 8 px tall, in chars order', () => {
    expect(sheet.chars).toHaveLength(27);
    expect(new Set(sheet.chars).size).toBe(27);
    expect(sheet.widths).toHaveLength(27);
    // the letters' cells, then the divider's (sheet.divider.cell)
    expect(sheet.divider.cell).toBe(sheet.chars.length);
    expect(png.width).toBe(sheet.cell * (sheet.chars.length + 1));
    expect(png.width).toBe(196);
    expect(png.height).toBe(sheet.height);
    expect(png.height).toBe(8);
  });

  it('lists the 22 letters in alphabet order, then the five final forms', () => {
    const finals = new Set(Object.values(FINAL_FORMS));
    const alphabet: string[] = [];
    for (let cp = 0x5d0; cp <= 0x5ea; cp++) {
      const ch = String.fromCodePoint(cp);
      if (!finals.has(ch)) alphabet.push(ch);
    }
    expect(OLD_LETTERS).toEqual(alphabet);
    expect(OLD_LETTERS).toHaveLength(LETTER_COUNT);
    expect(sheet.chars.slice(LETTER_COUNT)).toEqual(Object.values(FINAL_FORMS));
    for (const base of Object.keys(FINAL_FORMS)) expect(OLD_LETTERS).toContain(base);
  });

  it('glyphs are white on transparent, start at column 0 and match `widths` (2-6 px)', () => {
    for (let i = 0; i < png.width * png.height; i++) {
      const a = png.rgba[i * 4 + 3] ?? 0;
      expect(a === 0 || a === 255).toBe(true);
      if (a === 255)
        expect([png.rgba[i * 4], png.rgba[i * 4 + 1], png.rgba[i * 4 + 2]]).toEqual([
          255, 255, 255,
        ]);
    }
    for (const [cell, char] of sheet.chars.entries()) {
      const cols = inkColumns(cell);
      const width = sheet.widths[cell];
      expect(cols[0], char).toBe(0);
      expect(cols[cols.length - 1], char).toBe((width ?? 0) - 1);
      expect(width, char).toBeGreaterThanOrEqual(2);
      expect(width, char).toBeLessThanOrEqual(6);
      expect(width, char).toBeLessThan(sheet.cell);
    }
  });

  it('every glyph has ink in the body rows', () => {
    const top = sheet.bodyRows[0] ?? 0;
    const bottom = sheet.bodyRows[1] ?? 0;
    for (const [cell, char] of sheet.chars.entries()) {
      let ink = 0;
      for (let y = top; y <= bottom; y++) {
        for (let x = 0; x < sheet.cell; x++)
          ink += (png.rgba[(y * png.width + cell * sheet.cell + x) * 4 + 3] ?? 0) > 127 ? 1 : 0;
      }
      expect(ink, char).toBeGreaterThan(0);
    }
  });
});

describe('the divider', () => {
  it('is one dot at mid-height in the cell after the letters (Lore §4.5)', () => {
    const { cell, width, row, char } = sheet.divider;
    expect(sheet.chars).not.toContain(char);
    expect(width).toBe(1);
    expect(row).toBeGreaterThanOrEqual(sheet.bodyRows[0] ?? 0);
    expect(row).toBeLessThanOrEqual(sheet.bodyRows[1] ?? 0);
    const ink: [number, number][] = [];
    for (let y = 0; y < sheet.height; y++) {
      for (let x = 0; x < sheet.cell; x++) {
        if ((png.rgba[(y * png.width + cell * sheet.cell + x) * 4 + 3] ?? 0) > 127)
          ink.push([x, y]);
      }
    }
    expect(ink).toEqual([[0, row]]);
  });
});
