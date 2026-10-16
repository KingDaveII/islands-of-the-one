import { describe, expect, it } from 'vitest';
import { nearest, WHITELIST } from '../src/colour.js';
import { SPRITE_CANVAS, SPRITE_CELLS } from '@iot/shared';
import { PipelineError } from '../src/errors.js';
import { blank, hexAt, opaqueAt, opaqueRows } from '../src/image.js';
import {
  applyFixes,
  checkReserved,
  despeckle,
  outline,
  place,
  skinMask,
  snap,
} from '../src/steps.js';
import { C, art, figure, rect } from './helpers.js';

const fails = (fn: () => unknown, message: string | RegExp): void => {
  expect(fn).toThrow(PipelineError);
  expect(fn).toThrow(message);
};

describe('step 3, fixes', () => {
  it('sets a colour or clears a pixel, and nothing else', () => {
    const img = art(['ab'], { a: C['watcher-iron'], b: C['watcher-stone'] });
    const out = applyFixes(
      img,
      [
        [0, 0, C['dream-night']],
        [1, 0, null],
      ],
      'walk_S_1',
    );
    expect(hexAt(out, 0, 0)).toBe(C['dream-night']);
    expect(opaqueAt(out, 1, 0)).toBe(false);
    expect(hexAt(img, 0, 0)).toBe(C['watcher-iron']);
    fails(
      () => applyFixes(img, [[2, 0, null]], 'walk_S_1'),
      'walk_S_1: the fix at (2, 0) is outside the 2×1 source frame',
    );
  });
});

describe('step 4, reserved colours', () => {
  it('fails on a pixel nearest to #FFFFFF or #FFE7A3, naming the frame and pixel', () => {
    fails(() => {
      checkReserved(art(['.a'], { a: '#fefefe' }), 'idle_S_0');
    }, 'idle_S_0: pixel (1, 0) is #fefefe, nearest to the reserved signal-hit #ffffff');
    fails(() => {
      checkReserved(art(['a'], { a: '#ffe8a0' }), 'walk_E_2');
    }, 'walk_E_2: pixel (0, 0) is #ffe8a0, nearest to the reserved spark-glow #ffe7a3');
  });

  it('allows the telegraph colours only in telegraph frames', () => {
    const pink = art(['a'], { a: '#e0467a' });
    fails(() => {
      checkReserved(pink, 'lunge_0');
    }, 'lunge_0: pixel (0, 0) is #e0467a, nearest to the reserved signal-telegraph #e0457b, which only telegraph frames may use');
    expect(() => {
      checkReserved(pink, 'telegraph_1');
    }).not.toThrow();
  });

  it('passes the whitelist', () => {
    expect(() => {
      checkReserved(figure(C['watcher-iron']).img, 'idle_S_0');
    }).not.toThrow();
  });
});

describe('step 5, snap', () => {
  it('moves off-palette pixels to the nearest whitelist colour and reports the count and the largest ΔE', () => {
    const img = art(['abc'], { a: C['watcher-iron'], b: '#4b4f58', c: '#7e8895' });
    const out = snap(img, 'idle_S_0');
    expect([hexAt(out.img, 0, 0), hexAt(out.img, 1, 0), hexAt(out.img, 2, 0)]).toEqual([
      C['watcher-iron'],
      C['watcher-iron'],
      C['watcher-stone'],
    ]);
    expect(out.offPalette).toBe(2);
    expect(out.maxDeltaE).toBeGreaterThan(0);
    expect(out.maxDeltaE).toBeLessThan(2);
  });

  it('takes the earlier token in palette.json on a tie', () => {
    // #04592e is exactly as far (to 1/10 000 ΔE) from watcher-iron as from unwritten-tar.
    const tied = nearest('#04592e', [C['watcher-iron'], C['unwritten-tar']]);
    const reversed = nearest('#04592e', [C['unwritten-tar'], C['watcher-iron']]);
    expect(tied.dE).toBeCloseTo(reversed.dE, 3);
    expect(tied.hex).toBe(C['watcher-iron']);
    expect(reversed.hex).toBe(C['unwritten-tar']);
    // watcher-iron comes first in palette.json, so the snap picks it.
    expect(WHITELIST.indexOf(C['watcher-iron'])).toBeLessThan(
      WHITELIST.indexOf(C['unwritten-tar']),
    );
    expect(hexAt(snap(art(['a'], { a: '#04592e' }), 'idle_S_0').img, 0, 0)).toBe(C['watcher-iron']);
  });

  it('keeps the telegraph colours in telegraph frames only', () => {
    const pink = art(['a'], { a: C['signal-telegraph'] });
    expect(hexAt(snap(pink, 'telegraph_0').img, 0, 0)).toBe(C['signal-telegraph']);
    expect(hexAt(snap(pink, 'lunge_0').img, 0, 0)).not.toBe(C['signal-telegraph']);
  });
});

describe('step 6, outline by role', () => {
  const legend = {
    d: C['dream-night'],
    h: C['hollow-deep'],
    s: C['sleeper-night'],
    i: C['watcher-iron'],
  };
  const img = art(['.....', '.dhs.', '.ddi.', '.shd.', '.....'], legend);

  it('the player: edge pixels in dream-night, hollow-deep or sleeper-night become dream-night', () => {
    const out = outline(img, 'player');
    for (const [x, y] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 3],
      [2, 3],
      [3, 3],
      [1, 2],
    ] as const)
      expect(hexAt(out.img, x, y)).toBe(C['dream-night']);
    expect(hexAt(out.img, 3, 2)).toBe(C['watcher-iron']);
    expect(out.gaps).toBe(1);
  });

  it('everyone else: hollow-deep, with interior dream-night reported and left alone', () => {
    const out = outline(img, 'other');
    expect(hexAt(out.img, 1, 1)).toBe(C['hollow-deep']);
    expect(hexAt(out.img, 3, 1)).toBe(C['hollow-deep']);
    expect(hexAt(out.img, 2, 2)).toBe(C['dream-night']);
    expect(out.interiorDreamNight).toBe(1);
    expect(out.gaps).toBe(1);
  });

  it('counts the image border as transparency', () => {
    const full = art(['dd', 'dd'], legend);
    expect(hexAt(outline(full, 'other').img, 0, 0)).toBe(C['hollow-deep']);
  });
});

describe('step 7, place in the cell', () => {
  const canvas = SPRITE_CANVAS;
  const k = SPRITE_CELLS.kindled;
  const other = SPRITE_CELLS.other;

  it('centres by the canvas, never the bounding box: a blade on one side does not move the body', () => {
    const { img } = figure(C['watcher-iron']);
    const withBlade = figure(C['watcher-iron']).img;
    rect(withBlade, 2, 40, 18, 2, C['watcher-stone']);
    const a = place(img, k, 'frame', null, 'idle_S_0', canvas);
    const b = place(withBlade, k, 'frame', null, 'idle_S_0', canvas);
    expect([a.dx, a.dy]).toEqual([24, 10]);
    expect([b.dx, b.dy]).toEqual([24, 10]);
    // An 80 px frame is centred too: 56 - 40.
    expect(place(blank(80, 80), k, 'canvas', null, 'w', canvas).dx).toBe(16);
  });

  it('"frame" puts each frame\'s lowest opaque row on the soles row and reports the drift', () => {
    const { img } = figure(C['watcher-iron'], { bootsBelow: 2 });
    const p = place(img, other, 'frame', null, 'idle_S_0', canvas);
    expect(opaqueRows(p.img)?.bottom).toBe(53);
    expect(p.shift).toBe(-2);
    const k2 = place(img, k, 'frame', null, 'idle_S_0', canvas);
    expect(opaqueRows(k2.img)?.bottom).toBe(63);
  });

  it("{ ref } uses one source frame's soles for every frame, so a blade below the feet stays below", () => {
    const { img } = figure(C['watcher-iron']);
    rect(img, 40, 54, 2, 3, C['watcher-stone']); // a blade tip below the soles
    const p = place(img, k, { ref: 0 }, 53, 'light_1_E_0', canvas);
    expect(p.dy).toBe(10);
    expect(opaqueRows(p.img)?.bottom).toBe(66);
    expect(p.shift).toBe(0);
  });

  it('"canvas" trusts row 53 (row 53 of a centred 64 px canvas in a bigger frame)', () => {
    const { img } = figure(C['watcher-iron'], { bootsBelow: 1 });
    expect(place(img, k, 'canvas', null, 'f', canvas).dy).toBe(10);
    expect(place(blank(80, 80), k, 'canvas', null, 'f', canvas).dy).toBe(63 - 61);
  });

  it('never crops: anything outside the cell or on its outer ring fails, naming the frame', () => {
    const { img } = figure(C['watcher-iron']);
    rect(img, 30, 0, 2, 2, C['watcher-stone']); // the top of a raised blade
    fails(
      () => place(img, other, { ref: 0 }, 40, 'heavy_thrust_N_1', canvas),
      /^heavy_thrust_N_1: placed at \(0, 13\) in the 64×64 cell, source pixels .* would fall outside it or on its outer 1 px ring; nothing is cropped$/,
    );
  });
});

describe('step 8, despeckle', () => {
  it('a single pixel ringed by one other opaque colour takes it; anything else stays', () => {
    const img = art(['aaa..', 'aba..', 'aaa..', 'abc..'], {
      a: C['watcher-iron'],
      b: C['watcher-stone'],
      c: C['dream-night'],
    });
    const out = despeckle(img);
    expect(hexAt(out.img, 1, 1)).toBe(C['watcher-iron']);
    expect(hexAt(out.img, 1, 3)).toBe(C['watcher-stone']);
    expect(out.changed).toBe(1);
  });
});

describe('step 9, the skin mask', () => {
  const cell = (belt: string) =>
    place(
      outline(figure(belt).img, 'player').img,
      SPRITE_CELLS.kindled,
      'frame',
      null,
      'idle_S_0',
      SPRITE_CANVAS,
    );

  it('masks the face, the shade side and both hands; a watcher-iron belt is not skin and not a problem', () => {
    const p = cell(C['watcher-iron']);
    const m = skinMask(p.img, 'idle_S_0', p.dx, p.dy, [], []);
    expect(m.problems).toEqual([]);
    expect(m.masked).toBe(10 * 11 - 4 - 3 + 6 + 6); // the head less its eyes and freckles, both hands
    expect(opaqueAt(m.mask, 35 + p.dx, 12 + p.dy)).toBe(true); // face shade
    expect(opaqueAt(m.mask, 39 + p.dx, 32 + p.dy)).toBe(true); // the shade hand
    expect(opaqueAt(m.mask, 29 + p.dx, 17 + p.dy)).toBe(false); // freckles and eyes never
    expect(opaqueAt(m.mask, 30 + p.dx, 14 + p.dy)).toBe(false);
  });

  it('a belt in unwritten-tar is a problem, named by frame, box (source pixels) and size', () => {
    const p = cell(C['unwritten-tar']);
    const m = skinMask(p.img, 'idle_S_0', p.dx, p.dy, [], []);
    expect(m.problems).toEqual([
      {
        frame: 'idle_S_0',
        box: [
          [26, 33],
          [37, 34],
        ],
        pixels: 24,
      },
    ]);
    expect(opaqueAt(m.mask, 30 + p.dx, 33 + p.dy)).toBe(false);
  });

  it('skin.add marks the region as skin; skin.remove takes pixels out of the mask', () => {
    const p = cell(C['unwritten-tar']);
    const added = skinMask(p.img, 'idle_S_0', p.dx, p.dy, [[30, 33]], []);
    expect(added.problems).toEqual([]);
    expect(opaqueAt(added.mask, 26 + p.dx, 34 + p.dy)).toBe(true);
    const removed = skinMask(
      p.img,
      'idle_S_0',
      p.dx,
      p.dy,
      [],
      [
        [
          [26, 33],
          [37, 34],
        ],
        [22, 32],
      ],
    );
    expect(removed.problems).toEqual([]);
    expect(opaqueAt(removed.mask, 22 + p.dx, 32 + p.dy)).toBe(false);
    expect(opaqueAt(removed.mask, 23 + p.dx, 32 + p.dy)).toBe(true);
  });

  it('a region with no unwritten-sail that touches a freckle is skin', () => {
    const p = cell(C['watcher-iron']);
    const img = p.img;
    const m0 = skinMask(img, 'f', p.dx, p.dy, [], []).masked;
    // A tar pixel beside a freckle, away from the head: skin.
    rect(img, 45 + p.dx, 40 + p.dy, 1, 1, C['unwritten-tar']);
    rect(img, 46 + p.dx, 40 + p.dy, 1, 1, C['spark-amber']);
    const m = skinMask(img, 'f', p.dx, p.dy, [], []);
    expect(m.problems).toEqual([]);
    expect(m.masked).toBe(m0 + 1);
  });

  it('skin.add on a pixel that is not a skin colour fails', () => {
    const p = cell(C['watcher-iron']);
    fails(
      () => skinMask(p.img, 'idle_S_0', p.dx, p.dy, [[30, 33]], []),
      'idle_S_0: skin.add marks (30, 33), which is not unwritten-sail or unwritten-tar',
    );
  });
});
