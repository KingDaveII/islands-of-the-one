import { DIVIDER_CELL, DIVIDER_ROW, lettersFromPositions, oldLettersSheet as sheet, PLOT_DIVIDER, SHEET_CELLS, sheetCell } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { css } from '../palette.js';
import {
  drawLetters,
  LETTER_STATES,
  rasterize,
  sheetFromPixels,
  STATE_COLOR,
  type LetterSheet,
} from './letters.js';

/** A stand-in sheet: every glyph is a solid block of its ink width over the body rows; the divider's cell its one dot. */
function blockSheet(): LetterSheet {
  const width = sheet.cell * SHEET_CELLS;
  const rgba = new Uint8Array(width * sheet.height * 4);
  const top = sheet.bodyRows[0] ?? 0;
  const bottom = sheet.bodyRows[1] ?? 0;
  for (const [cell, w] of sheet.widths.entries()) {
    for (let y = top; y <= bottom; y++) {
      for (let x = 0; x < w; x++) rgba[(y * width + cell * sheet.cell + x) * 4 + 3] = 255;
    }
  }
  rgba[(DIVIDER_ROW * width + DIVIDER_CELL * sheet.cell) * 4 + 3] = 255;
  return sheetFromPixels(rgba, width, sheet.height);
}

const ink = blockSheet();
const w = (char: string): number => sheet.widths[sheetCell(char)] as number;
const alef = 'א';
const mem = 'מ';
const tav = 'ת';

describe('sheetFromPixels', () => {
  it('reads alpha into an ink mask and checks the sheet size', () => {
    expect(ink.ink.reduce((a, b) => a + b, 0)).toBe(sheet.widths.reduce((a, b) => a + b, 0) * 5 + 1);
    expect(() => sheetFromPixels(new Uint8Array(16), 2, 2)).toThrow(/expected 196x8/);
  });
});

describe('rasterize', () => {
  it('stamps glyphs right to left, 1 px apart, in the lit state by default', () => {
    const r = rasterize(ink, `${alef}${mem}${tav}`);
    expect(r.width).toBe(w(alef) + w(mem) + w(tav) + 2);
    expect(r.height).toBe(8);
    const row = (y: number): number[] => [...r.px.subarray(y * r.width, (y + 1) * r.width)];
    expect(row(0).every((v) => v === 0)).toBe(true); // ascender row empty
    expect(row(7).every((v) => v === 0)).toBe(true); // descender row empty
    // Body row: tav at the left, a gap, mem, a gap, alef at the right.
    const expected = [
      ...Array<number>(w(tav)).fill(1),
      0,
      ...Array<number>(w(mem)).fill(1),
      0,
      ...Array<number>(w(alef)).fill(1),
    ];
    expect(row(2)).toEqual(expected);
  });

  it('tints per letter: the aleph dark leaves mem-tav lit', () => {
    const r = rasterize(ink, `${alef}${mem}${tav}`, { states: ['dark'] });
    const dark = 1 + LETTER_STATES.indexOf('dark');
    const row = [...r.px.subarray(4 * r.width, 5 * r.width)];
    expect(row.slice(r.width - w(alef))).toEqual(Array<number>(w(alef)).fill(dark));
    expect(row.slice(0, w(tav))).toEqual(Array<number>(w(tav)).fill(1));
    const ember = rasterize(ink, `${mem}${tav}`, { state: 'ember' });
    expect(new Set(ember.px.filter((v) => v !== 0))).toEqual(
      new Set([1 + LETTER_STATES.indexOf('ember')]),
    );
  });

  it("stamps a plot sentence's divider from ART's cell, one dot on its row in the default state, centred in the word space", () => {
    const r = rasterize(ink, `${alef} ${PLOT_DIVIDER} ${mem}`, { state: 'ember' });
    const plain = rasterize(ink, `${alef} ${mem}`, { state: 'ember' });
    expect(r.width).toBe(plain.width);
    const d = r.shape.dividers[0];
    if (!d) throw new Error('no divider placed');
    const code = 1 + LETTER_STATES.indexOf('ember');
    expect(r.px[DIVIDER_ROW * r.width + d.x]).toBe(code);
    expect(plain.px[DIVIDER_ROW * plain.width + d.x]).toBe(0);
    // Only that one pixel differs from the plain two words.
    let differ = 0;
    for (let i = 0; i < r.px.length; i++) if (r.px[i] !== plain.px[i]) differ++;
    expect(differ).toBe(1);
  });

  it('uses the final form at the end of a word', () => {
    const r = rasterize(ink, `${alef}${mem} ${alef}`);
    const finalMem = sheet.finals['מ'];
    expect(r.shape.glyphs[1]?.cell).toBe(sheetCell(finalMem));
    expect(r.width).toBe(w(alef) + w(finalMem) + 1 + sheet.space + w(alef));
    expect(rasterize(ink, lettersFromPositions([0, 12]), {}).shape.glyphs[1]?.cell).toBe(
      sheetCell(finalMem),
    );
  });
});

describe('drawLetters', () => {
  it('fills whole-pixel rects in the state colors, scaled', () => {
    const rects: { style: string; x: number; y: number; w: number; h: number }[] = [];
    let fillStyle = '';
    const ctx = {
      set fillStyle(v: string) {
        fillStyle = v;
      },
      fillRect(x: number, y: number, rw: number, h: number) {
        rects.push({ style: fillStyle, x, y, w: rw, h });
      },
    } as unknown as CanvasRenderingContext2D;
    const r = drawLetters(ctx, ink, `${mem}${tav}`, 10, 20, {
      scale: 3,
      states: [undefined, 'dim'],
    });
    // One rect per glyph per body row (5 rows), each the glyph's width.
    expect(rects).toHaveLength(10);
    const dim = rects.filter((q) => q.style === css(STATE_COLOR.dim));
    const lit = rects.filter((q) => q.style === css(STATE_COLOR.lit));
    expect(dim).toHaveLength(5);
    expect(lit).toHaveLength(5);
    expect(dim[0]).toEqual({
      style: css(STATE_COLOR.dim),
      x: 10,
      y: 20 + 2 * 3,
      w: w(tav) * 3,
      h: 3,
    });
    expect(lit[0]).toEqual({
      style: css(STATE_COLOR.lit),
      x: 10 + (r.width - w(mem)) * 3,
      y: 26,
      w: w(mem) * 3,
      h: 3,
    });
  });
});
