import { oldLettersSheet as sheet, shapeLetters, type ShapedLetters } from '@iot/shared';
import sheetUrl from '@iot/shared/assets/old-letters-8px.png';
import { css, Palette } from '../palette.js';

/**
 * Old Letters as pixel glyphs. The sheet (packages/shared/assets, spec in
 * docs/design/letters.md) is white on transparent; `shapeLetters` from
 * @iot/shared lays a string out right to left with final forms at word ends,
 * and this module stamps the glyphs, tinted per letter state, onto a 2D canvas
 * on whole pixels. Nothing here decides gameplay: states come from the sim.
 */
export type LetterState = 'lit' | 'dim' | 'dark' | 'ember';
export const LETTER_STATES: readonly LetterState[] = ['lit', 'dim', 'dark', 'ember'];
export const STATE_COLOR: Readonly<Record<LetterState, number>> = {
  lit: Palette.writLit,
  dim: Palette.writDim,
  dark: Palette.writDark,
  ember: Palette.writEmber,
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
  if (width !== sheet.cell * sheet.chars.length || height !== sheet.height) {
    throw new Error(
      `letter sheet is ${width}x${height}, expected ${sheet.cell * sheet.chars.length}x${sheet.height}`,
    );
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
  for (const g of shape.glyphs) {
    const state = options.states?.[g.index] ?? options.state ?? 'lit';
    const code = 1 + LETTER_STATES.indexOf(state);
    for (let y = 0; y < shape.height; y++) {
      const row = y * ink.width + g.cell * sheet.cell;
      for (let x = 0; x < g.width; x++) {
        if (ink.ink[row + x]) px[y * shape.width + g.x + x] = code;
      }
    }
  }
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
