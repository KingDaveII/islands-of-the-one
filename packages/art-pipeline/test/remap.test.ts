import { describe, expect, it } from 'vitest';
import { PipelineError } from '../src/errors.js';
import { hexAt } from '../src/image.js';
import { parseRecipe, type Recipe } from '../src/recipe.js';
import { appliesTo, applyRemap, faceBox, type FrameRef, type RemapRule } from '../src/remap.js';
import { C, art, figure, tempRoot, writeImg } from './helpers.js';

const BLADE = '#bebfc2';
const BLADE_2 = '#c0bebd'; // 0.68 ΔE from BLADE
const CLOTH = '#7c7166'; // snaps to unwritten-sail: the skin
const CLOTH_2 = '#7a6f64'; // 0.69 ΔE from CLOTH
const FRECKLE_OFF = '#f0b45c'; // a generator's freckle, off-palette, snaps to spark-amber

const WALK_S_2: FrameRef = { name: 'walk_S_2', anim: 'walk', facing: 'S' };
const FILE = 'art/sheets/kindled-test.json';

/** A typed rule from its JSON, through the guard on a recipe that builds idle S, walk S and SE, and light_1 E. */
const root = tempRoot();
writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
const src = { src: 'art/clean/fig.png', frames: [0] };
const recipeJson = (remap: unknown, extra: Record<string, unknown> = {}) => ({
  sheet: 'kindled-test',
  kind: 'kindled',
  outline: 'player',
  draft: true,
  anims: {
    idle: { facings: { S: src } },
    walk: { facings: { S: { ...src, frames: [0, 0, 0] }, SE: src } },
    light_1: { facings: { E: src } },
  },
  remap,
  ...extra,
});
const rules = (...json: unknown[]): RemapRule[] => parseRecipe(recipeJson(json), FILE, root).remap;
const problems = (json: unknown): readonly string[] => {
  try {
    parseRecipe(
      json,
      (json as { sheet?: string }).sheet === 'husk-test' ? 'art/sheets/husk-test.json' : FILE,
      root,
    );
  } catch (e) {
    if (e instanceof PipelineError) return e.problems;
    throw e;
  }
  return [];
};

const legend = { b: BLADE, c: BLADE_2, k: CLOTH, l: CLOTH_2, f: FRECKLE_OFF, i: C['watcher-iron'] };

describe('remap matches', () => {
  it('"from" takes exact colours and "near" every colour within its ΔE; a pixel takes the first rule that matches', () => {
    const img = art(['bck'], legend);
    const r = rules(
      { from: [BLADE], to: 'husk-shell' },
      { near: BLADE, within: 2, to: 'watcher-stone' },
    );
    const out = applyRemap(img, r, WALK_S_2, FILE);
    expect([0, 1, 2].map((x) => hexAt(out.img, x, 0))).toEqual([
      C['husk-shell'], // both rules match; the first wins
      C['watcher-stone'], // only "near" matches
      CLOTH, // neither
    ]);
    expect(out.taken).toEqual([1, 1]);
    // In the other order "near" takes both.
    const swapped = applyRemap(img, [...r].reverse(), WALK_S_2, FILE);
    expect(swapped.taken).toEqual([2, 0]);
    expect(hexAt(img, 0, 0)).toBe(BLADE);
  });

  it('a "near" distance is inclusive and in the ΔE units the report prints', () => {
    const img = art(['bc'], legend);
    const taken = (within: number): number[] =>
      applyRemap(img, rules({ near: BLADE, within, to: 'husk-shell' }), WALK_S_2, FILE).taken;
    expect(taken(0.67)).toEqual([1]); // BLADE itself
    expect(taken(0.69)).toEqual([2]); // and BLADE_2, 0.68 away
  });
});

describe('remap scopes', () => {
  const img = art(['bb'], legend);
  const frames: FrameRef[] = [
    { name: 'idle_S_0', anim: 'idle', facing: 'S' },
    { name: 'walk_S_2', anim: 'walk', facing: 'S' },
    { name: 'walk_SE_0', anim: 'walk', facing: 'SE' },
    { name: 'light_1_E_0', anim: 'light_1', facing: 'E' },
  ];
  const where = (rule: Record<string, unknown>): string[] => {
    const [r] = rules({ from: [BLADE], to: 'husk-shell', ...rule });
    if (!r) throw new Error('no rule');
    return frames
      .filter((f) => {
        const hit = applyRemap(img, [r], f, FILE).taken[0] === 2;
        expect(hit, f.name).toBe(appliesTo(r, f));
        return hit;
      })
      .map((f) => f.name);
  };

  it('applies everywhere without a scope; anims, facings and frames narrow it, together', () => {
    expect(where({})).toEqual(['idle_S_0', 'walk_S_2', 'walk_SE_0', 'light_1_E_0']);
    expect(where({ anims: ['walk', 'light_1'] })).toEqual(['walk_S_2', 'walk_SE_0', 'light_1_E_0']);
    expect(where({ facings: ['SE', 'E'] })).toEqual(['walk_SE_0', 'light_1_E_0']);
    expect(where({ frames: ['walk_S_2'] })).toEqual(['walk_S_2']);
    expect(where({ anims: ['walk'], facings: ['SE', 'E'] })).toEqual(['walk_SE_0']);
    expect(where({ anims: ['idle'], frames: ['walk_S_2'] })).toEqual([]);
  });
});

describe('remap exclude: "face"', () => {
  // Cloth grey all round; three freckles (one off-palette, as a generator draws them) in the middle.
  const rows = [
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkfkkkfkkkk',
    'kkkkkkfkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
    'kkkkkkkkkkkkk',
  ];
  const withFace = art(rows, { ...legend, f: FRECKLE_OFF });
  const backView = art(
    rows.map((r) => r.replaceAll('f', 'k')),
    legend,
  );
  const [rule] = rules({ from: [CLOTH], to: 'watcher-stone', exclude: 'face' });

  it("finds the face: the freckles' bounding box grown by 3 px (none in a back view)", () => {
    expect(faceBox(withFace)).toEqual([1, 1, 11, 8]);
    expect(faceBox(backView)).toBeNull();
  });

  it('skips the face in a frame with freckles, and excludes nothing in a frame without', () => {
    if (!rule) throw new Error('no rule');
    const front = applyRemap(withFace, [rule], WALK_S_2, FILE);
    expect(hexAt(front.img, 1, 1)).toBe(CLOTH); // the face's corner stays for the skin
    expect(hexAt(front.img, 11, 8)).toBe(CLOTH);
    expect(hexAt(front.img, 0, 0)).toBe(C['watcher-stone']);
    expect(hexAt(front.img, 12, 9)).toBe(C['watcher-stone']);
    expect(hexAt(front.img, 4, 4)).toBe(FRECKLE_OFF); // never a cloth colour to begin with
    expect(front.taken).toEqual([13 * 10 - 11 * 8]);
    const back = applyRemap(backView, [rule], WALK_S_2, FILE);
    expect(back.taken).toEqual([13 * 10]);
  });
});

describe('remap box, as a scope and as an exclusion', () => {
  // A cloth sleeve in CLOTH ending in a hand drawn in the same grey (columns 4–5 of rows 2–3), and a face.
  const img = art(
    [
      'kkkkkk......',
      'kkkkkk......',
      'kkkkkk......',
      'kkkkkk......',
      '.......lllll',
      '.......lflll',
      '.......lllll',
    ],
    legend,
  );
  const HAND = [4, 2, 5, 3];
  const after = (...json: unknown[]): string[] => {
    const out = applyRemap(img, rules(...json), WALK_S_2, FILE).img;
    return [hexAt(out, 4, 2), hexAt(out, 0, 0), hexAt(out, 7, 4), hexAt(out, 11, 6)];
  };
  const STONE = C['watcher-stone'];
  const SAIL = C['unwritten-sail'];

  it('"box" keeps a rule inside its rectangles (one, or a list)', () => {
    expect(after({ from: [CLOTH], to: 'unwritten-sail', box: HAND })).toEqual([
      SAIL,
      CLOTH,
      CLOTH_2,
      CLOTH_2,
    ]);
    expect(after({ from: [CLOTH], to: 'unwritten-sail', box: [HAND, [0, 0, 0, 0]] })).toEqual([
      SAIL,
      SAIL,
      CLOTH_2,
      CLOTH_2,
    ]);
    // The hand to the skin first, then the rest of the grey to the cloth.
    expect(
      after(
        { from: [CLOTH], to: 'unwritten-sail', frames: ['walk_S_2'], box: HAND },
        { near: CLOTH, within: 1, to: 'watcher-stone' },
      ),
    ).toEqual([SAIL, STONE, STONE, STONE]);
  });

  it('"exclude" skips its rectangles, alone or with "face"', () => {
    expect(after({ near: CLOTH, within: 1, to: 'watcher-stone', exclude: [HAND] })).toEqual([
      CLOTH,
      STONE,
      STONE,
      STONE,
    ]);
    expect(after({ near: CLOTH, within: 1, to: 'watcher-stone', exclude: HAND })).toEqual([
      CLOTH,
      STONE,
      STONE,
      STONE,
    ]);
    // The face (the freckle at (8, 5) grown by 3: [5, 2, 11, 8]) covers the second patch; the hand box covers (4, 2).
    expect(after({ near: CLOTH, within: 1, to: 'watcher-stone', exclude: ['face', HAND] })).toEqual(
      [CLOTH, STONE, CLOTH_2, CLOTH_2],
    );
    expect(after({ near: CLOTH, within: 1, to: 'watcher-stone', exclude: 'face' })).toEqual([
      STONE,
      STONE,
      CLOTH_2,
      CLOTH_2,
    ]);
  });

  it('fails when a rectangle reaches outside the source frame, naming the field', () => {
    expect(() =>
      applyRemap(
        img,
        rules({ from: [CLOTH], to: 'watcher-stone', box: [10, 0, 12, 1] }),
        WALK_S_2,
        FILE,
      ),
    ).toThrow(
      'art/sheets/kindled-test.json: remap[0].box [10, 0, 12, 1] reaches outside the 12×7 source frame of walk_S_2',
    );
    expect(() =>
      applyRemap(
        img,
        rules({ from: [CLOTH], to: 'watcher-stone', exclude: ['face', [0, 6, 1, 7]] }),
        WALK_S_2,
        FILE,
      ),
    ).toThrow(
      'art/sheets/kindled-test.json: remap[0].exclude [0, 6, 1, 7] reaches outside the 12×7 source frame of walk_S_2',
    );
  });
});

describe('the remap guard', () => {
  const at = (msg: string): string => `${FILE}: ${msg}`;
  const fails = (remap: unknown, ...messages: string[]): void => {
    expect(problems(recipeJson(remap))).toEqual(messages.map(at));
  };

  it('accepts the documented shape and lowercases colours', () => {
    const r: Recipe = parseRecipe(
      recipeJson([
        { from: ['#BEBFC2', '#c0bebd'], to: 'husk-shell' },
        {
          near: '#b5b6b5',
          within: 4,
          to: 'watcher-stone',
          anims: ['walk', 'light_1'],
          facings: ['SE', 'E'],
        },
        { near: '#7c7166', within: 3, to: 'watcher-iron', exclude: 'face' },
        {
          near: '#6e6357',
          within: 3,
          to: 'watcher-bronze',
          frames: ['light_1_E_0'],
          exclude: [[30, 36, 34, 40]],
        },
        { from: ['#959ca7'], to: 'watcher-stone', frames: ['walk_S_2'], box: [38, 28, 46, 44] },
      ]),
      FILE,
      root,
    );
    expect(r.remap).toEqual([
      { from: ['#bebfc2', '#c0bebd'], to: 'husk-shell', hex: C['husk-shell'] },
      {
        near: { hex: '#b5b6b5', within: 4 },
        to: 'watcher-stone',
        hex: C['watcher-stone'],
        anims: ['walk', 'light_1'],
        facings: ['SE', 'E'],
      },
      {
        near: { hex: '#7c7166', within: 3 },
        to: 'watcher-iron',
        hex: C['watcher-iron'],
        exclude: { face: true, boxes: [] },
      },
      {
        near: { hex: '#6e6357', within: 3 },
        to: 'watcher-bronze',
        hex: C['watcher-bronze'],
        frames: ['light_1_E_0'],
        exclude: { face: false, boxes: [[30, 36, 34, 40]] },
      },
      {
        from: ['#959ca7'],
        to: 'watcher-stone',
        hex: C['watcher-stone'],
        frames: ['walk_S_2'],
        box: [[38, 28, 46, 44]],
      },
    ]);
  });

  it('fails a rule that is not a list of objects, or has an unknown key', () => {
    fails({ from: [BLADE], to: 'husk-shell' }, 'remap must be a list of rules');
    fails(['husk-shell'], 'remap[0] must be an object');
    fails(
      [{ from: [BLADE], to: 'husk-shell', colour: BLADE }],
      'remap[0].colour is not a remap field',
    );
  });

  it('fails without "from" or "near", or with both, and on bad colours or distances', () => {
    fails([{ to: 'husk-shell' }], 'remap[0] needs "from" (exact colours) or "near" with "within"');
    fails(
      [{ from: [BLADE], near: BLADE, within: 2, to: 'husk-shell' }],
      'remap[0] has both "from" and "near"; a rule matches by one or the other',
      'remap[0].within goes with "near", not "from"',
    );
    fails(
      [{ from: [], to: 'husk-shell' }],
      'remap[0].from must be a non-empty list of "#rrggbb" colours',
    );
    fails(
      [{ from: [BLADE, '#bebfc'], to: 'husk-shell' }],
      'remap[0].from[1] is "#bebfc", not a "#rrggbb" colour',
    );
    fails(
      [{ near: 'grey', within: 2, to: 'husk-shell' }],
      'remap[0].near is "grey", not a "#rrggbb" colour',
    );
    fails(
      [{ near: BLADE, to: 'husk-shell' }],
      'remap[0].within is missing: "near" needs a distance (ΔE)',
    );
    fails(
      [{ near: BLADE, within: 0, to: 'husk-shell' }],
      'remap[0].within must be a number above 0 (ΔE, as the report prints it)',
    );
    fails(
      [{ near: BLADE, within: '3', to: 'husk-shell' }],
      'remap[0].within must be a number above 0 (ΔE, as the report prints it)',
    );
  });

  it('fails a "to" that is a hex, unknown, reserved, or a telegraph colour outside telegraph frames', () => {
    fails([{ from: [BLADE] }], 'remap[0].to must name a whitelist token, like "watcher-stone"');
    fails(
      [{ from: [BLADE], to: '#e8e2d6' }],
      'remap[0].to is "#e8e2d6", which is not a palette token (name a whitelist token, not a hex)',
    );
    fails(
      [{ from: [BLADE], to: 'steel' }],
      'remap[0].to is "steel", which is not a palette token (name a whitelist token, not a hex)',
    );
    fails(
      [{ from: [BLADE], to: 'spark-glow' }],
      'remap[0].to is "spark-glow", a reserved colour no sheet may use',
    );
    fails(
      [{ from: [BLADE], to: 'signal-hit' }],
      'remap[0].to is "signal-hit", a reserved colour no sheet may use',
    );
    fails(
      [{ from: [BLADE], to: 'signal-telegraph' }],
      'remap[0].to is "signal-telegraph", which only telegraph* frames may use, but the rule also applies to idle_S_0; narrow it with "anims" or "frames"',
    );
  });

  it('allows the telegraph colours in a rule scoped to telegraph frames', () => {
    writeImg(root, 'art/clean/shell.png', figure(C['watcher-iron']).img);
    const husk = (remap: unknown) => ({
      sheet: 'husk-test',
      kind: 'husk',
      outline: 'other',
      draft: true,
      anims: {
        idle: { src: 'art/clean/shell.png', frames: [0] },
        telegraph: { src: 'art/clean/shell.png', frames: [0, 0] },
      },
      remap,
    });
    expect(
      problems(husk([{ from: [BLADE], to: 'signal-telegraph', anims: ['telegraph'] }])),
    ).toEqual([]);
    expect(
      problems(husk([{ from: [BLADE], to: 'signal-telegraph-dark', frames: ['telegraph_1'] }])),
    ).toEqual([]);
    expect(problems(husk([{ from: [BLADE], to: 'husk-shell', facings: ['S'] }]))).toEqual([
      'art/sheets/husk-test.json: remap[0].facings is only for kinds with facings (kindled, npc)',
    ]);
  });

  it('fails an unknown anim, facing or frame, naming the field', () => {
    fails(
      [{ from: [BLADE], to: 'husk-shell', anims: ['dodge'] }],
      'remap[0].anims[0] is "dodge", which is not an animation of this recipe',
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', anims: [] }],
      'remap[0].anims must be a non-empty list of animation names',
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', facings: ['S', 'south'] }],
      'remap[0].facings[1] is "south", which is not a facing (S, SE, E, NE, N, NW, W, SW)',
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', frames: ['walk_S_3'] }],
      'remap[0].frames[0] names "walk_S_3", which is not a frame this recipe builds',
    );
  });

  it('fails a malformed box or exclude', () => {
    const rect = '[x0, y0, x1, y1] (whole numbers from 0, x0 ≤ x1, y0 ≤ y1)';
    fails(
      [{ from: [BLADE], to: 'husk-shell', box: [1, 2, 3] }],
      `remap[0].box must be ${rect} or a non-empty list of them`,
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', box: [5, 2, 3, 4] }],
      `remap[0].box must be ${rect} or a non-empty list of them`,
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', box: [] }],
      `remap[0].box must be ${rect} or a non-empty list of them`,
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', exclude: 'hands' }],
      `remap[0].exclude must be "face", ${rect}, or a non-empty list of them`,
    );
    fails(
      [{ from: [BLADE], to: 'husk-shell', exclude: ['face', [1, 2]] }],
      `remap[0].exclude must be "face", ${rect}, or a non-empty list of them`,
    );
  });
});
