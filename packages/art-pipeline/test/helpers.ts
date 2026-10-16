import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { paletteData } from '@iot/shared';
import { blank, setPixel, type Img } from '../src/image.js';
import { encodePng } from '../src/png.js';

/** Small synthetic frames and a throwaway repo root for the pipeline's tests. */

export const C = Object.fromEntries(
  Object.entries(paletteData.tokens).map(([k, v]) => [k, v.toLowerCase()]),
) as Record<keyof typeof paletteData.tokens, string>;

/** A fresh directory standing in for the repo root. */
export function tempRoot(): string {
  return mkdtempSync(join(tmpdir(), 'art-pipeline-'));
}

export function writeFile(root: string, rel: string, bytes: Uint8Array | string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
}

export function writeImg(root: string, rel: string, img: Img): void {
  writeFile(root, rel, encodePng(img));
}

/** An image from rows of characters, one per pixel, through a legend ('.' is transparent). */
export function art(rows: readonly string[], legend: Record<string, string>): Img {
  const img = blank(rows[0]?.length ?? 0, rows.length);
  rows.forEach((row, y) => {
    Array.from(row).forEach((ch, x) => {
      if (ch === '.') return;
      const hex = legend[ch];
      if (!hex) throw new Error(`no colour for ${ch}`);
      setPixel(img, x, y, hex);
    });
  });
  return img;
}

export function rect(img: Img, x0: number, y0: number, w: number, h: number, hex: string): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(img, x, y, hex);
}

/**
 * A little Kindled on a 64×64 canvas, soles on row 53, in the spirit of
 * packages/shared/test/fixtures/kindled-fixture.py: a skin-and-shade head with
 * three freckles, soot cloth, a belt in `belt`, boots in watcher-iron and a
 * 1 px dream-night outline. Returns the image and where the belt is.
 */
export function figure(
  belt: string,
  opts: { bootsBelow?: number } = {},
): { img: Img; beltBox: [[number, number], [number, number]] } {
  const img = blank(64, 64);
  rect(img, 27, 10, 10, 11, C['unwritten-sail']); // head
  rect(img, 35, 12, 2, 8, C['unwritten-tar']); // face shade
  rect(img, 30, 14, 1, 2, C['dream-night']); // eyes
  rect(img, 33, 14, 1, 2, C['dream-night']);
  for (const [x, y] of [
    [29, 17],
    [31, 18],
    [34, 17],
  ] as const)
    rect(img, x, y, 1, 1, C['spark-amber']);
  rect(img, 25, 21, 14, 12, C['watcher-stone']); // body
  rect(img, 36, 21, 3, 12, C['watcher-iron']);
  rect(img, 22, 22, 3, 10, C['watcher-stone']); // arms
  rect(img, 39, 22, 3, 10, C['watcher-iron']);
  rect(img, 22, 32, 3, 2, C['unwritten-sail']); // hands
  rect(img, 39, 32, 3, 1, C['unwritten-sail']);
  rect(img, 39, 33, 3, 1, C['unwritten-tar']);
  rect(img, 26, 33, 12, 2, belt); // the belt, apart from the hands
  rect(img, 26, 35, 12, 7, C['watcher-stone']);
  rect(img, 27, 42, 4, 8, C['watcher-iron']); // legs
  rect(img, 33, 42, 4, 8, C['watcher-iron']);
  const bootsTo = 53 + (opts.bootsBelow ?? 0);
  rect(img, 26, 50, 5, bootsTo - 49, C['watcher-iron']); // boots, soles on row 53
  rect(img, 33, 50, 5, bootsTo - 49, C['watcher-iron']);
  const solid = img.data.slice();
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < 64 && y < 64 && (solid[(y * 64 + x) * 4 + 3] ?? 0) > 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (opaque(x, y) || y > bootsTo) continue;
      if (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1))
        setPixel(img, x, y, C['dream-night']);
    }
  }
  return {
    img,
    beltBox: [
      [26, 33],
      [37, 34],
    ],
  };
}

export function writeRecipe(root: string, recipe: Record<string, unknown>): void {
  writeFile(
    root,
    `art/sheets/${String(recipe.sheet)}.json`,
    `${JSON.stringify(recipe, null, 2)}\n`,
  );
}
