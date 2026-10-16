import { GifWriter } from 'omggif';
import { describe, expect, it } from 'vitest';
import { PipelineError } from '../src/errors.js';
import { blank, hexAt, setPixel } from '../src/image.js';
import { checkAlpha, downscale, splitGif, SourceReader } from '../src/source.js';
import { C, art, tempRoot, writeImg } from './helpers.js';

const fails = (fn: () => unknown, message: string | RegExp): void => {
  expect(fn).toThrow(PipelineError);
  expect(fn).toThrow(message);
};

describe('step 1, read', () => {
  it('fails on any alpha other than 0 or 255, naming the frame and the pixel', () => {
    const img = art(['ab', 'ba'], { a: C['watcher-iron'], b: C['watcher-stone'] });
    expect(checkAlpha(img, 'walk_S_0')).toBe(img);
    img.data[(1 * 2 + 0) * 4 + 3] = 128;
    fails(
      () => checkAlpha(img, 'walk_S_0'),
      'walk_S_0: pixel (0, 1) has alpha 128; only 0 or 255 are allowed',
    );
  });

  it('reduces a ×k delivery only when every k×k block is one colour', () => {
    const big = art(['aabb', 'aabb', 'cc..', 'cc..'], {
      a: C['watcher-iron'],
      b: C['watcher-stone'],
      c: C['dream-night'],
    });
    const small = downscale(big, 2, 'f');
    expect([small.w, small.h]).toEqual([2, 2]);
    expect(hexAt(small, 0, 0)).toBe(C['watcher-iron']);
    expect(hexAt(small, 1, 0)).toBe(C['watcher-stone']);
    expect(hexAt(small, 0, 1)).toBe(C['dream-night']);
    expect(small.data[(1 * 2 + 1) * 4 + 3]).toBe(0);
    setPixel(big, 3, 1, C['dream-night']);
    fails(
      () => downscale(big, 2, 'idle_S_0'),
      'idle_S_0: the 2×2 block at (2, 0) is not one colour, so it cannot be reduced by 2',
    );
    fails(() => downscale(blank(5, 4), 2, 'f'), 'f: 5×4 is not a multiple of the downscale 2');
  });

  it('reads a downscaled source through the reader, with the recipe frame in messages', () => {
    const root = tempRoot();
    const big = art(['aa..', 'aa..'], { a: C['watcher-iron'] });
    writeImg(root, 'art/clean/x4/frame-0.png', big);
    const img = new SourceReader(root).read('art/clean/x4', 0, 2, 'idle_0');
    expect([img.w, img.h]).toEqual([2, 1]);
    const soft = art(['a'], { a: C['watcher-iron'] });
    soft.data[3] = 7;
    writeImg(root, 'art/clean/soft.png', soft);
    fails(
      () => new SourceReader(root).read('art/clean/soft.png', 0, undefined, 'idle_0'),
      'idle_0 (art/clean/soft.png frame 0): pixel (0, 0) has alpha 7',
    );
  });

  /** A 2×1 GIF: frames given as colour indices (0 transparent) with delays in centiseconds. */
  function gif(frames: { px: [number, number]; delay: number; disposal?: number }[]): Uint8Array {
    const buf = Buffer.alloc(1024);
    const w = new GifWriter(buf, 2, 1, {
      palette: [0x000000, 0x4a4e57, 0x7d8794, 0x1c2147],
      loop: 0,
    });
    for (const f of frames)
      w.addFrame(0, 0, 2, 1, f.px, { delay: f.delay, transparent: 0, disposal: f.disposal ?? 1 });
    return buf.subarray(0, w.end());
  }

  it('splits a GIF, a frame held n times the shortest delay becoming n frames', () => {
    const frames = splitGif(
      gif([
        { px: [1, 0], delay: 10 },
        { px: [0, 2], delay: 30, disposal: 2 },
        { px: [3, 0], delay: 10 },
      ]),
      'walk.gif',
    );
    expect(frames).toHaveLength(5);
    const at = (i: number, x: number): string | null => {
      const f = frames[i];
      if (!f) return null;
      return f.data[x * 4 + 3] ? hexAt(f, x, 0) : null;
    };
    expect([at(0, 0), at(0, 1)]).toEqual([C['watcher-iron'], null]);
    // Disposal 1 keeps frame 0 under frame 1; frame 1 is held three times.
    for (const i of [1, 2, 3])
      expect([at(i, 0), at(i, 1)]).toEqual([C['watcher-iron'], C['watcher-stone']]);
    // Frame 1's disposal 2 clears its rectangle before frame 2.
    expect([at(4, 0), at(4, 1)]).toEqual([C['dream-night'], null]);
  });

  it('fails on a GIF delay that is not a whole multiple of the shortest', () => {
    const bytes = gif([
      { px: [1, 0], delay: 10 },
      { px: [2, 0], delay: 15 },
    ]);
    fails(
      () => splitGif(bytes, 'walk.gif'),
      'walk.gif: GIF frame 1 lasts 15 cs, not a whole multiple of the shortest (10 cs)',
    );
  });
});
