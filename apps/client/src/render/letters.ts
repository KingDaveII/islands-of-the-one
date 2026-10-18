import { oldLettersSheet as sheet, shapeLetters, SHEET_CELLS, type ShapedLetters } from '@iot/shared';
import sheetUrl from '@iot/shared/assets/old-letters-8px.png';
import { css, Palette } from '../palette.js';

/**
 * Old Letters as pixel glyphs. The sheet (packages/shared/assets, spec in
 * docs/design/letters.md) is white on transparent; `shapeLetters` from
 * @iot/shared lays a string out right to left with final forms at word ends,
 * and this module stamps the glyphs, tinted per letter state, onto a 2D canvas
 * on whole pixels. Nothing here decides gameplay: states come from the sim.
 */
export type LetterState = 'lit' | 'dim' | 'dark' | 'ember' | 'gold';
export const LETTER_STATES: readonly LetterState[] = ['lit', 'dim', 'dark', 'ember', 'gold'];
/** One color per state; `gold` is a full Writ's (ART 2026-10-18: choir-gold, steady, never flickering). */
export const STATE_COLOR: Readonly<Record<LetterState, number>> = {
  lit: Palette.writLit,
  dim: Palette.writDim,
  dark: Palette.writDark,
  ember: Palette.writEmber,
  gold: Palette.writGold,
};

/** The sheet's ink, one byte per image pixel (1 = ink), row-major. */
export interface LetterSheet {
  width: number;
  height: number;
  ink: Uint8Array;
}

/** Builds the ink mask from RGBA pixels (alpha above half = ink). */
export function sheetFromPixels(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): LetterSheet {
  // The letters, the final forms and the divider's cell after them (ART #99).
  if (width !== sheet.cell * SHEET_CELLS || height !== sheet.height) {
    throw new Error(`letter sheet is ${width}x${height}, expected ${sheet.cell * SHEET_CELLS}x${sheet.height}`);
  }
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) ink[i] = (rgba[i * 4 + 3] ?? 0) > 127 ? 1 : 0;
  return { width, height, ink };
}

/** Loads the sheet image and reads its pixels (browser only). */
export async function loadLetterSheet(url: string = sheetUrl): Promise<LetterSheet> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error(`could not load the letter sheet from ${url}`));
    };
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D canvas');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return sheetFromPixels(data, canvas.width, canvas.height);
}

export interface LetterOptions {
  /** State for every letter without one in `states`. Default lit. */
  state?: LetterState;
  /** Per-letter states, by letter index (spaces excluded). */
  states?: readonly (LetterState | undefined)[];
}

/** A rendered string: `px` holds 0 (empty) or 1 + the index of the pixel's state in LETTER_STATES. */
export interface LetterRaster {
  width: number;
  height: number;
  px: Uint8Array;
  shape: ShapedLetters;
}

export function rasterize(
  ink: LetterSheet,
  text: string,
  options: LetterOptions = {},
): LetterRaster {
  const shape = shapeLetters(text);
  const px = new Uint8Array(shape.width * shape.height);
  const stamp = (cell: number, x0: number, w: number, code: number): void => {
    for (let y = 0; y < shape.height; y++) {
      const row = y * ink.width + cell * sheet.cell;
      for (let x = 0; x < w; x++) {
        if (ink.ink[row + x]) px[y * shape.width + x0 + x] = code;
      }
    }
  };
  for (const g of shape.glyphs) {
    const state = options.states?.[g.index] ?? options.state ?? 'lit';
    stamp(g.cell, g.x, g.width, 1 + LETTER_STATES.indexOf(state));
  }
  // A plot sentence's divider (ART's cell after the letters), in the letters' default state colour.
  for (const d of shape.dividers) stamp(d.cell, d.x, d.width, 1 + LETTER_STATES.indexOf(options.state ?? 'lit'));
  return { width: shape.width, height: shape.height, px, shape };
}

/**
 * Draws `text` with its left edge at (x, y) (top-left of the 8 px line), each
 * glyph pixel as a `scale` × `scale` block. Returns the raster for its width.
 */
export function drawLetters(
  ctx: CanvasRenderingContext2D,
  ink: LetterSheet,
  text: string,
  x: number,
  y: number,
  options: LetterOptions & { scale?: number } = {},
): LetterRaster {
  const r = rasterize(ink, text, options);
  const s = options.scale ?? 1;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (const [i, state] of LETTER_STATES.entries()) {
    ctx.fillStyle = css(STATE_COLOR[state]);
    for (let row = 0; row < r.height; row++) {
      // Runs of same-state pixels become one rect.
      for (let col = 0; col < r.width;) {
        if (r.px[row * r.width + col] !== i + 1) {
          col++;
          continue;
        }
        let end = col;
        while (end < r.width && r.px[row * r.width + end] === i + 1) end++;
        ctx.fillRect(x0 + col * s, y0 + row * s, (end - col) * s, s);
        col = end;
      }
    }
  }
  return r;
}

/** What `plotLetters` draws into: a Phaser Graphics (fillStyle + fillRect), typed without Phaser so node tests can pass a stub. */
export interface LetterGraphics {
  fillStyle(color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, w: number, h: number): unknown;
}

/**
 * `drawLetters` for a Phaser Graphics on the UI camera (the HUD, the Writ
 * panel, the Name screen's tablet): the same whole-pixel runs in the state
 * colours, `scale` × `scale` blocks, the text's left edge at (x, y).
 */
export function plotLetters(
  g: LetterGraphics,
  ink: LetterSheet,
  text: string,
  x: number,
  y: number,
  options: LetterOptions & { scale?: number } = {},
): LetterRaster {
  const r = rasterize(ink, text, options);
  const s = options.scale ?? 1;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (const [i, state] of LETTER_STATES.entries()) {
    g.fillStyle(STATE_COLOR[state], 1);
    for (let row = 0; row < r.height; row++) {
      for (let col = 0; col < r.width; ) {
        if (r.px[row * r.width + col] !== i + 1) {
          col++;
          continue;
        }
        let end = col;
        while (end < r.width && r.px[row * r.width + end] === i + 1) end++;
        g.fillRect(x0 + col * s, y0 + row * s, (end - col) * s, s);
        col = end;
      }
    }
  }
  return r;
}
