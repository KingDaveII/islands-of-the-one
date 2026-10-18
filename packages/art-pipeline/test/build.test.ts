import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KINDLED_ANIMS,
  KINDLED_SHEATHED_ANIMS,
  kindledAnimKey,
  HUSK_TABLES,
  kindledFrameName,
  propTableFor,
  isRequiredAnim,
  SPRITE_FACINGS,
  spritePointsFor,
  spriteSheetSpec,
  type SpriteAnimSpec,
  type SpriteSheet,
} from '@iot/shared';
import { pointProblems, tableProblems, v2Problems } from '../../shared/test/sheetChecks.js';
import { APP_ID, buildRecipe, pack, type BuiltAnim } from '../src/build.js';
import { PipelineError } from '../src/errors.js';
import { blank, blit, flipX, hexAt, opaqueAt, sameImg } from '../src/image.js';
import { animChecks, BOB_FLAG, POINT_MARK, POINTS_SCALE } from '../src/review.js';
import { decodePng } from '../src/png.js';
import { parseRecipe, type Recipe } from '../src/recipe.js';
import { buildAndWrite, checkAll } from '../src/sheets.js';
import { C, figure, rect, tempRoot, writeImg, writeRecipe } from './helpers.js';

/** A full Kindled recipe: every animation (of `rows`), facing and frame in the table, all from one figure. */
function fullKindled(
  src: string,
  extra: Record<string, unknown> = {},
  rows: readonly SpriteAnimSpec[] = KINDLED_ANIMS,
): Record<string, unknown> {
  const anims: Record<string, unknown> = {};
  for (const a of rows) {
    anims[a.name] = {
      facings: Object.fromEntries(
        a.facings.map((f) => [f, { src, frames: Array.from({ length: a.frames }, () => 0) }]),
      ),
    };
  }
  return {
    sheet: 'kindled-test',
    kind: 'kindled',
    outline: 'player',
    draft: false,
    anims,
    points: requiredPoints(rows),
    ...extra,
  };
}

/** Every point the table's rows require (sprites.md §5), at one pixel of the figure, for every facing and frame. */
function requiredPoints(rows: readonly SpriteAnimSpec[], at: [number, number] = [24, 33]) {
  const points: Record<string, Record<string, [number, number]>> = {};
  for (const a of rows) {
    for (const point of spritePointsFor('kindled-test', a.name)) {
      for (const f of a.facings) {
        for (let n = 0; n < a.frames; n++)
          (points[point] ??= {})[kindledFrameName(a.name, f, n)] = at;
      }
    }
  }
  return points;
}

function build(root: string, json: Record<string, unknown>) {
  const recipe: Recipe = parseRecipe(
    keepPointsOfAnims(json),
    `art/sheets/${String(json.sheet)}.json`,
    root,
  );
  return buildRecipe(recipe, root);
}

/** `fullKindled`'s stock points, trimmed to the animations a test keeps when it narrows `anims`. */
function keepPointsOfAnims(json: Record<string, unknown>): Record<string, unknown> {
  const points = json.points as Record<string, Record<string, unknown>> | undefined;
  const anims = Object.keys(json.anims ?? {});
  if (!points) return json;
  const kept = Object.fromEntries(
    Object.entries(points).map(([p, frames]) => [
      p,
      Object.fromEntries(
        Object.entries(frames).filter(([f]) =>
          anims.some((a) => new RegExp(`^${a}_[A-Z]+_\\d+$`).test(f)),
        ),
      ),
    ]),
  );
  return { ...json, points: kept };
}

const problemsOf = (fn: () => unknown): readonly string[] => {
  try {
    fn();
  } catch (e) {
    if (e instanceof PipelineError) return e.problems;
    throw e;
  }
  return [];
};

describe('a finished Kindled sheet', () => {
  const root = tempRoot();
  writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
  const result = build(root, fullKindled('art/clean/fig.png'));
  const out = (p: string): Buffer => {
    const b = result.outputs.get(p);
    if (!b) throw new Error(`no ${p}`);
    return b;
  };
  const sheet = JSON.parse(
    out('packages/shared/assets/sprites/kindled-test.json').toString(),
  ) as SpriteSheet;
  const png = decodePng(out('packages/shared/assets/sprites/kindled-test.png'));
  const mask = decodePng(out('packages/shared/assets/sprites/kindled-test.skin.png'));

  it('writes the PNG, the JSON, the mask and the review folder', () => {
    expect([...result.outputs.keys()].sort()).toEqual([
      'art/review/kindled-test/contact.png',
      'art/review/kindled-test/points.png',
      'art/review/kindled-test/report.json',
      'art/review/kindled-test/report.md',
      'art/review/kindled-test/tones.png',
      'packages/shared/assets/sprites/kindled-test.json',
      'packages/shared/assets/sprites/kindled-test.png',
      'packages/shared/assets/sprites/kindled-test.skin.png',
    ]);
  });

  it('passes the v2 checks of packages/shared/test (cell, origin, ring, whitelist, mask)', () => {
    expect(
      v2Problems(
        'kindled-test',
        sheet,
        { width: png.w, height: png.h, rgba: png.data },
        { width: mask.w, height: mask.h, rgba: mask.data },
      ),
    ).toEqual([]);
  });

  it('packs row-major in the contract order, at most 2048 wide, and lists every frame of the table', () => {
    const names = Object.keys(sheet.frames);
    const expected = KINDLED_ANIMS.flatMap((a) =>
      a.facings.flatMap((f) =>
        Array.from({ length: a.frames }, (_, n) => kindledFrameName(a.name, f, n)),
      ),
    );
    expect(names).toEqual(expected);
    expect(sheet.meta.size).toEqual({ w: 21 * 96, h: Math.ceil(expected.length / 21) * 80 });
    expect([png.w, png.h]).toEqual([sheet.meta.size.w, sheet.meta.size.h]);
    names.forEach((name, i) => {
      expect(sheet.frames[name]?.frame, name).toEqual({
        x: (i % 21) * 96,
        y: Math.floor(i / 21) * 80,
        w: 96,
        h: 80,
      });
    });
  });

  it('writes the v2 meta, the anims block from the table and the clay palette with its mask', () => {
    expect(sheet.meta).toEqual({
      image: 'kindled-test.png',
      size: sheet.meta.size,
      scale: '1',
      format: 'RGBA8888',
      app: APP_ID,
      version: '2',
      cell: { w: 96, h: 80 },
      origin: { x: 48, y: 64 },
      facings: [...SPRITE_FACINGS],
      pixelScale: 1,
    });
    for (const a of KINDLED_ANIMS) {
      for (const f of a.facings) {
        const def = sheet.anims[kindledAnimKey(a.name, f)];
        expect(def?.frames).toEqual(
          Array.from({ length: a.frames }, (_, n) => kindledFrameName(a.name, f, n)),
        );
        expect(def?.frameRate).toBe(a.fps);
        expect(def?.repeat).toBe(a.loop ? -1 : 0);
        expect(def?.hold ?? false).toBe(a.hold);
      }
    }
    expect(sheet.palette).toEqual({
      drawn: 'clay-grey-ochre',
      mask: 'kindled-test.skin.png',
      swaps: {
        'clay-pale': { '#8c7f6e': '#e8e2d6', '#5e5448': '#8c7f6e' },
        'clay-red': { '#8c7f6e': '#c98f78', '#5e5448': '#9c5b4a' },
        'clay-river-dark': { '#8c7f6e': '#5e5448', '#5e5448': '#2a2540' },
      },
    });
    for (const f of Object.values(sheet.frames)) expect(f.anchor).toEqual({ x: 0.5, y: 0.8 });
  });

  it('puts the canvas at (16, 10): the soles on cell row 63', () => {
    const f = sheet.frames.idle_S_0?.frame ?? { x: 0, y: 0 };
    expect(opaqueAt(png, f.x + 16 + 27, f.y + 10 + 53)).toBe(true);
    expect(opaqueAt(png, f.x + 16 + 27, f.y + 10 + 54)).toBe(false);
  });

  it('is the same bytes on a second build', () => {
    const again = build(root, fullKindled('art/clean/fig.png'));
    for (const [path, bytes] of result.outputs)
      expect(again.outputs.get(path)?.equals(bytes), path).toBe(true);
  });

  it('fails when an animation, facing or frame is missing', () => {
    const json = fullKindled('art/clean/fig.png');
    const anims = json.anims as Record<string, { facings: Record<string, { frames: number[] }> }>;
    delete anims.dodge;
    delete anims.walk?.facings.SW;
    anims.idle?.facings.S?.frames.pop();
    expect(problemsOf(() => build(root, json))).toEqual([
      'kindled-test: idle_S has 1 frames; the table says 2',
      'kindled-test: walk_SW is missing (a finished sheet carries every animation and facing)',
      ...SPRITE_FACINGS.map(
        (f) =>
          `kindled-test: dodge_${f} is missing (a finished sheet carries every animation and facing)`,
      ),
    ]);
  });

  it('builds a sheathed sheet (ART 2026-10-18) with its five roaming rows alone, carry and sit optional, on the shared sheet checks too', () => {
    const roaming = KINDLED_SHEATHED_ANIMS.filter(isRequiredAnim);
    expect(roaming.map((a) => a.name)).toEqual(['idle', 'walk', 'run', 'run_start', 'run_stop']);
    // The combat sheet has no optional rows left: carry and sit moved to the sheathed sheet.
    expect(KINDLED_ANIMS.filter((a) => !isRequiredAnim(a))).toEqual([]);
    const r = build(root, fullKindled('art/clean/fig.png', { sheet: 'kindled-test-sheathed' }, roaming));
    const json = JSON.parse(
      r.outputs.get('packages/shared/assets/sprites/kindled-test-sheathed.json')?.toString() ?? '{}',
    ) as SpriteSheet;
    const sheetPng = decodePng(
      r.outputs.get('packages/shared/assets/sprites/kindled-test-sheathed.png') ?? Buffer.alloc(0),
    );
    const sheetMask = decodePng(
      r.outputs.get('packages/shared/assets/sprites/kindled-test-sheathed.skin.png') ?? Buffer.alloc(0),
    );
    expect(Object.keys(json.anims).some((k) => k.startsWith('carry_') || k.startsWith('sit_'))).toBe(false);
    expect(tableProblems('kindled-test-sheathed', json, KINDLED_SHEATHED_ANIMS)).toEqual([]);
    expect(
      v2Problems(
        'kindled-test-sheathed',
        json,
        { width: sheetPng.w, height: sheetPng.h, rgba: sheetPng.data },
        { width: sheetMask.w, height: sheetMask.h, rgba: sheetMask.data },
      ),
    ).toEqual([]);
    expect(r.report.optional).toEqual(['carry_idle (M2)', 'carry_walk (M2)', 'sit (M2)']);
    // Without a roaming row it is not finished.
    expect(
      problemsOf(() =>
        build(root, fullKindled('art/clean/fig.png', { sheet: 'kindled-test-sheathed' }, roaming.filter((a) => a.name !== 'run_stop'))),
      ),
    ).toEqual(
      SPRITE_FACINGS.map(
        (f) => `kindled-test-sheathed: run_stop_${f} is missing (a finished sheet carries every animation and facing)`,
      ),
    );
  });

  it('builds a finished Kindled sheet with run, and fails one with run incomplete', () => {
    const rows = KINDLED_ANIMS.filter(isRequiredAnim);
    const r = build(root, fullKindled('art/clean/fig.png', {}, rows));
    const json = JSON.parse(
      r.outputs.get('packages/shared/assets/sprites/kindled-test.json')?.toString() ?? '{}',
    ) as SpriteSheet;
    expect(json.anims.run_NW?.frames).toHaveLength(8);
    expect(tableProblems('kindled-test', json, KINDLED_ANIMS)).toEqual([]);
    const partial = fullKindled('art/clean/fig.png', {}, rows);
    delete (partial.anims as Record<string, { facings: Record<string, unknown> }>).run?.facings.SW;
    expect(problemsOf(() => build(root, partial))).toEqual([
      'kindled-test: run_SW is missing (a finished sheet carries every animation and facing)',
    ]);
  });

  it('fails an optional animation that is there but incomplete (carry and sit, on the sheathed sheet)', () => {
    const json = fullKindled('art/clean/fig.png', { sheet: 'kindled-test-sheathed' }, KINDLED_SHEATHED_ANIMS);
    const anims = json.anims as Record<string, { facings: Record<string, { frames: number[] }> }>;
    delete anims.sit?.facings.E;
    delete anims.carry_idle;
    anims.carry_walk?.facings.N?.frames.pop();
    expect(problemsOf(() => build(root, json))).toEqual([
      'kindled-test-sheathed: carry_walk_N has 5 frames; the table says 6',
      'kindled-test-sheathed: sit_E is missing (sit is optional until M2, but a finished sheet that has it carries every facing)',
    ]);
  });

  it('fails a non-draft sheet the contract has no table for (a Husk not in HUSK_TABLES)', () => {
    writeImg(root, 'art/clean/shell.png', figure(C['watcher-iron']).img);
    const json = {
      sheet: 'husk-rind-eel',
      kind: 'husk',
      outline: 'other',
      draft: false,
      anims: { idle: { src: 'art/clean/shell.png', frames: [0] } },
    };
    expect(problemsOf(() => build(root, json))).toEqual([
      'husk-rind-eel: the sprite contract has no animation table (frame counts and rates) for this husk yet, so only a draft can be built',
    ]);
  });
});

describe('the mask rule on a hand-made figure', () => {
  const root = tempRoot();
  writeImg(root, 'art/clean/iron-belt.png', figure(C['watcher-iron']).img);
  writeImg(root, 'art/clean/tar-belt.png', figure(C['unwritten-tar']).img);
  const message =
    'idle_S_0: a region of 24 px in the skin colours at [[26, 33], [37, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; ' +
    'add it with skin.add if it is skin, or recolour it with fixes if not';

  it('a belt in watcher-iron passes', () => {
    // A draft of the same figure: the rule is the same, and a draft reports instead of failing.
    const json = {
      ...fullKindled('art/clean/iron-belt.png'),
      draft: true,
      anims: { idle: { facings: { S: { src: 'art/clean/iron-belt.png', frames: [0] } } } },
    };
    const r = build(root, json);
    expect(r.skinProblems).toEqual([]);
    expect(r.report.skinProblems).toEqual([]);
  });

  it('a belt in unwritten-tar fails the build, listing frame, box and size', () => {
    const p = problemsOf(() => build(root, fullKindled('art/clean/tar-belt.png')));
    expect(p).toContain(message);
    expect(p).toHaveLength(KINDLED_ANIMS.reduce((s, a) => s + a.frames * a.facings.length, 0));
  });

  it('in a draft the same list is reported instead', () => {
    const json = {
      ...fullKindled('art/clean/tar-belt.png'),
      draft: true,
      anims: { idle: { facings: { S: { src: 'art/clean/tar-belt.png', frames: [0] } } } },
    };
    const r = build(root, json);
    expect(r.report.skinProblems).toEqual([message]);
    expect(r.outputs.has('packages/shared/assets/sprites/kindled-test.png')).toBe(false);
    expect(r.outputs.get('art/review/kindled-test/report.md')?.toString()).toContain(
      `- ${message}`,
    );
  });

  it('skin.add resolves it (here for every frame), and the belt is then in the mask', () => {
    const json = fullKindled('art/clean/tar-belt.png');
    const frames = KINDLED_ANIMS.flatMap((a) =>
      a.facings.flatMap((f) =>
        Array.from({ length: a.frames }, (_, n) => kindledFrameName(a.name, f, n)),
      ),
    );
    json.skin = {
      add: Object.fromEntries(
        frames.map((f) => [
          f,
          [
            [
              [26, 33],
              [37, 34],
            ],
          ],
        ]),
      ),
    };
    const r = build(root, json);
    expect(r.skinProblems).toEqual([]);
    const mask = decodePng(
      r.outputs.get('packages/shared/assets/sprites/kindled-test.skin.png') ?? Buffer.alloc(0),
    );
    expect(opaqueAt(mask, 16 + 30, 10 + 33)).toBe(true);
  });

  it('a fixes recolour resolves it too', () => {
    const belt: [number, number, string][] = [];
    for (let y = 33; y <= 34; y++)
      for (let x = 26; x <= 37; x++) belt.push([x, y, C['watcher-iron']]);
    const json = {
      ...fullKindled('art/clean/tar-belt.png'),
      draft: true,
      anims: { idle: { facings: { S: { src: 'art/clean/tar-belt.png', frames: [0] } } } },
      fixes: [{ frame: 'idle_S_0', pixels: belt }],
    };
    const r = build(root, json);
    expect(r.skinProblems).toEqual([]);
    expect(hexAt(r.anims[0]?.frames[0]?.cell ?? blank(1, 1), 16 + 30, 10 + 33)).toBe(
      C['watcher-iron'],
    );
  });
});

describe('remap in a build', () => {
  const root = tempRoot();
  // A cloth belt in a generator grey that snaps to unwritten-tar, into the skin ramp.
  const GREY = '#6e6357';
  writeImg(root, 'art/clean/grey-belt.png', figure(GREY).img);
  const rescue = [{ from: [GREY], to: 'watcher-iron' }];
  const draft = (extra: Record<string, unknown>) => ({
    ...fullKindled('art/clean/grey-belt.png'),
    draft: true,
    anims: {
      idle: { facings: { S: { src: 'art/clean/grey-belt.png', frames: [0] } } },
      walk: { facings: { S: { src: 'art/clean/grey-belt.png', frames: [0, 0] } } },
    },
    ...extra,
  });

  it('rescues a grey that would snap into the skin ramp, so the skin-region check passes', () => {
    const without = problemsOf(() => build(root, fullKindled('art/clean/grey-belt.png')));
    expect(without).toContain(
      'idle_S_0: a region of 24 px in the skin colours at [[26, 33], [37, 34]] (source pixels) has no unwritten-sail pixel and touches no freckle; ' +
        'add it with skin.add if it is skin, or recolour it with fixes if not',
    );
    const r = build(root, fullKindled('art/clean/grey-belt.png', { remap: rescue }));
    expect(r.skinProblems).toEqual([]);
    expect(hexAt(r.anims[0]?.frames[0]?.cell ?? blank(1, 1), 16 + 30, 10 + 33)).toBe(
      C['watcher-iron'],
    );
  });

  it('reports the pixels each rule took per animation, and the top off-palette colours with their ramp', () => {
    const before = build(root, draft({}));
    expect(before.report.remap).toEqual([]);
    expect(before.report.snappedColours).toBe(1);
    expect(before.report.snapped).toEqual([
      {
        colour: GREY,
        pixels: 72,
        to: C['unwritten-tar'],
        deltaE: 5.45,
        materials: ['skin'],
        frames: ['idle_S_0', 'walk_S_0', 'walk_S_1'],
      },
    ]);
    const md = before.outputs.get('art/review/kindled-test/report.md')?.toString() ?? '';
    expect(md).toContain('## Off-palette colours the snap moved');
    expect(md).toContain(
      `| ${GREY} | 72 | unwritten-tar #5e5448 | 5.45 | skin | idle_S 0; walk_S 0 1 |`,
    );

    const after = build(
      root,
      draft({ remap: [...rescue, { from: [GREY], to: 'watcher-bronze', anims: ['walk'] }] }),
    );
    expect(after.report.snapped).toEqual([]);
    expect(after.report.remap).toEqual([
      {
        rule: 0,
        maps: `from ${GREY} → watcher-iron`,
        scope: 'everywhere',
        pixels: { idle: 24, walk: 48 },
        total: 72,
        stale: false,
      },
      {
        rule: 1,
        maps: `from ${GREY} → watcher-bronze`,
        scope: 'anims walk',
        pixels: { walk: 0 },
        total: 0,
        stale: true,
      },
    ]);
  });

  it('a stale rule (one that matches no pixel where it applies) fails a finished sheet and is reported in a draft', () => {
    const stale = { near: '#123456', within: 3, to: 'watcher-iron', facings: ['S'] };
    const message =
      'kindled-test: remap[1] (near #123456 within 3 → watcher-iron) matches no pixel in any frame it applies to; remove it, or fix its colours or scope';
    expect(
      problemsOf(() =>
        build(root, fullKindled('art/clean/grey-belt.png', { remap: [...rescue, stale] })),
      ),
    ).toEqual([message]);
    const r = build(root, draft({ remap: [...rescue, stale] }));
    expect(r.report.staleRemap).toEqual([message]);
    const md = r.outputs.get('art/review/kindled-test/report.md')?.toString() ?? '';
    expect(md).toContain(
      '- Remap rules: 2; stale (match no pixel in any frame they apply to): remap[1] (reported because this is a draft; a finished sheet fails on them).',
    );
    expect(md).toContain(`- ${message}`);
  });

  it('fails a rectangle outside the source frame, in a draft too', () => {
    const json = draft({ remap: [{ from: [GREY], to: 'watcher-iron', box: [60, 60, 64, 63] }] });
    expect(problemsOf(() => build(root, json))).toEqual([
      'art/sheets/kindled-test.json: remap[0].box [60, 60, 64, 63] reaches outside the 64×64 source frame of idle_S_0',
    ]);
  });
});

describe('mirrored sources (flipX)', () => {
  const root = tempRoot();
  // An asymmetric 68×68 frame (v3's action canvas): the figure, a blade to its right.
  const tumble = blank(68, 68);
  blit(tumble, figure(C['watcher-iron']).img, 2, 2);
  rect(tumble, 46, 32, 14, 2, C['watcher-stone']);
  writeImg(root, 'art/raw/tumble/west.png', tumble);
  writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
  const draft = (anims: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    ...fullKindled('art/clean/fig.png'),
    draft: true,
    anims,
    ...extra,
  });
  const src = 'art/raw/tumble/west.png';
  const r = build(
    root,
    draft({
      dodge: {
        facings: { W: { src, frames: [0] }, E: { src, frames: [0], flipX: true } },
      },
    }),
  );
  const frame = (name: string) => {
    const f = r.anims.flatMap((a) => a.frames).find((x) => x.name === name);
    if (!f) throw new Error(`no ${name}`);
    return f;
  };

  it('builds the mirror image, pixel for pixel, still centred on the canvas', () => {
    const e = frame('dodge_E_0');
    // Column floor(68 / 2) = 34 goes on the origin's column 48, so dx is 14 and x lands on 14 + x.
    expect([e.dx, e.dy]).toEqual([14, 8]);
    for (let y = 0; y < tumble.h; y++) {
      for (let x = 0; x < tumble.w; x++) {
        const cx = 14 + (67 - x);
        expect(opaqueAt(e.cell, cx, 8 + y), `${x}, ${y}`).toBe(opaqueAt(tumble, x, y));
        if (opaqueAt(tumble, x, y)) expect(hexAt(e.cell, cx, 8 + y)).toBe(hexAt(tumble, x, y));
      }
    }
    // The canvas centre stays on the origin, so the whole cell (and its mask) is the mirror of the unmirrored one.
    const w = frame('dodge_W_0');
    expect(sameImg(e.cell, flipX(w.cell))).toBe(true);
    expect(sameImg(e.mask ?? blank(1, 1), flipX(w.mask ?? blank(1, 1)))).toBe(true);
  });

  it('reads the same files unmirrored for another facing', () => {
    const w = frame('dodge_W_0');
    expect([w.dx, w.dy]).toEqual([14, 8]);
    expect(hexAt(w.cell, 14 + 50, 8 + 32)).toBe(C['watcher-stone']); // the blade, to the right
    expect(opaqueAt(w.cell, 14 + 17, 8 + 32)).toBe(false);
    expect(hexAt(frame('dodge_E_0').cell, 14 + 17, 8 + 32)).toBe(C['watcher-stone']); // and to the left
    expect(w.mirrored).toBe(false);
  });

  it('marks mirrored frames in the report', () => {
    const json = r.report.frames.map((f) => [f.name, f.source, f.mirrored]);
    expect(json).toEqual([
      ['dodge_E_0', `${src} 0`, true],
      ['dodge_W_0', `${src} 0`, undefined],
    ]);
    const md = r.outputs.get('art/review/kindled-test/report.md')?.toString() ?? '';
    expect(md).toContain(`| dodge_E_0 | mirrored from \`${src} 0\` |`);
    expect(md).toContain(`| dodge_W_0 | \`${src} 0\` |`);
  });

  it("applies fixes, remap boxes and skin areas in the mirrored frame's coordinates", () => {
    // Mirrored, the figure's stone arm is at x 39–41 and its sail hand at (39–41, 32–33).
    const m = build(
      root,
      draft(
        { idle: { facings: { E: { src: 'art/clean/fig.png', frames: [0], flipX: true } } } },
        {
          fixes: [{ frame: 'idle_E_0', pixels: [[40, 25, C['wheel-brass']]] }],
          remap: [
            {
              from: [C['watcher-stone']],
              to: 'husk-shell',
              frames: ['idle_E_0'],
              box: [39, 22, 41, 31],
            },
          ],
          skin: {
            remove: {
              idle_E_0: [
                [
                  [39, 32],
                  [41, 33],
                ],
              ],
            },
          },
        },
      ),
    );
    const f = m.anims[0]?.frames[0];
    if (!f) throw new Error('no idle_E_0');
    expect([f.dx, f.dy]).toEqual([16, 10]);
    expect(hexAt(f.cell, 16 + 40, 10 + 25)).toBe(C['wheel-brass']);
    expect(hexAt(f.cell, 16 + 39, 10 + 22)).toBe(C['husk-shell']);
    expect(hexAt(f.cell, 16 + 23, 10 + 25)).toBe(C['watcher-iron']); // the other arm, outside the box
    expect(m.remapCounts[0]?.get('idle')).toBe(29); // the arm's 30 pixels but the fixed one
    const mask = f.mask ?? blank(1, 1);
    expect(opaqueAt(mask, 16 + 40, 10 + 32)).toBe(false); // the removed hand
    expect(opaqueAt(mask, 16 + 23, 10 + 32)).toBe(true); // the other hand
  });
});

describe('points', () => {
  const root = tempRoot();
  // A 68×68 action frame with a blade to the right: frame 0 stands 4 rows low (its lowest row is 57),
  // frame 1 on the canvas (53), so "frame", "canvas" (row 55 of a 68 px frame) and { ref: 1 } differ.
  const low = blank(68, 68);
  blit(low, figure(C['watcher-iron']).img, 2, 4);
  rect(low, 46, 34, 14, 2, C['watcher-stone']);
  const high = blank(68, 68);
  blit(high, figure(C['watcher-iron']).img, 2, 0);
  writeImg(root, 'art/raw/act/east/frame-0.png', low);
  writeImg(root, 'art/raw/act/east/frame-1.png', high);
  writeImg(root, 'art/raw/act/other/frame-0.png', low);
  writeImg(root, 'art/raw/act/other/frame-1.png', high);
  writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
  const src = 'art/raw/act/east';
  const draft = (extra: Record<string, unknown>) => ({
    sheet: 'kindled-test',
    kind: 'kindled',
    outline: 'player',
    draft: true,
    anims: {
      heavy_charge: {
        ground: 'frame',
        facings: {
          E: { src, frames: [0, 0, 0] },
          W: { src, frames: [0, 0, 0], flipX: true },
        },
      },
      haul_pull: { ground: 'canvas', facings: { E: { src, frames: [0, 0] } } },
      haul_slide: {
        ground: { ref: 1 },
        facings: {
          E: { src, frames: [0, 0] },
          W: { src: 'art/raw/act/other', frames: [0, 0], flipX: true },
        },
      },
    },
    ...extra,
  });
  const points = {
    tip: {
      heavy_charge_E_0: [59, 35],
      heavy_charge_E_1: [58, 35],
      heavy_charge_E_2: [57, 35],
      heavy_charge_W_2: [10, 10],
    },
    hand: {
      haul_pull_E_0: [30, 30],
      haul_pull_E_1: [30, 31],
      haul_slide_E_0: [30, 30],
      haul_slide_E_1: [31, 30],
    },
  };
  const r = build(root, draft({ points }));
  const frame = (name: string) => {
    const f = r.anims.flatMap((a) => a.frames).find((x) => x.name === name);
    if (!f) throw new Error(`no ${name}`);
    return f;
  };

  it('moves each point with its frame: the horizontal centring and each ground mode', () => {
    // Column 34 of a 68 px frame goes on the origin's column 48: dx 14. The soles row is 63.
    expect([frame('heavy_charge_E_0').dx, frame('heavy_charge_E_0').dy]).toEqual([14, 6]); // "frame": 63 − 57
    expect(frame('heavy_charge_E_0').points.tip).toEqual({ x: 73, y: 41, source: [59, 35] });
    expect([frame('haul_pull_E_0').dx, frame('haul_pull_E_0').dy]).toEqual([14, 8]); // "canvas": 63 − 55
    expect(frame('haul_pull_E_1').points.hand).toEqual({ x: 44, y: 39, source: [30, 31] });
    expect([frame('haul_slide_E_0').dx, frame('haul_slide_E_0').dy]).toEqual([14, 10]); // ref 1: 63 − 53
    expect(frame('haul_slide_E_1').points.hand).toEqual({ x: 45, y: 40, source: [31, 30] });
    expect(frame('heavy_charge_E_0').points.hand).toBeUndefined();
  });

  it('gives a flipX facing its twin’s points, mirrored, unless it lists its own', () => {
    // Source column x of the twin is column 67 − x of the mirrored frame; in the cell that is 95 − x.
    expect(frame('heavy_charge_W_0').points.tip).toEqual({
      x: 22,
      y: 41,
      source: [8, 35],
      from: 'heavy_charge_E_0',
    });
    expect(frame('heavy_charge_W_1').points.tip).toEqual({
      x: 23,
      y: 41,
      source: [9, 35],
      from: 'heavy_charge_E_1',
    });
    expect(95 - (frame('heavy_charge_E_1').points.tip?.x ?? 0)).toBe(23);
    expect(frame('heavy_charge_W_2').points.tip).toEqual({ x: 24, y: 16, source: [10, 10] });
    // haul_slide W mirrors a file no facing reads unmirrored: no twin, nothing inherited.
    expect(frame('haul_slide_W_0').points).toEqual({});
  });

  it('reports the points per frame and, in a draft, the required ones missing', () => {
    expect(r.report.missingPoints).toEqual([
      'kindled-test: haul_slide_W_0 has no hand point (points.hand.haul_slide_W_0)',
      'kindled-test: haul_slide_W_1 has no hand point (points.hand.haul_slide_W_1)',
    ]);
    const json = r.report.frames.find((f) => f.name === 'heavy_charge_W_0');
    expect(json?.points).toEqual({
      tip: { at: [22, 41], source: [8, 35], mirroredFrom: 'heavy_charge_E_0' },
    });
    const md = r.outputs.get('art/review/kindled-test/report.md')?.toString() ?? '';
    expect(md).toContain(
      '- Points: 10 placed (2 mirrored from their twin); missing: 2 (reported because this is a draft;',
    );
    expect(md).toContain(
      '| heavy_charge_W_0 | tip | 22, 41 | 8, 35 | heavy_charge_E_0, mirrored |',
    );
    expect(md).toContain('| heavy_charge_W_2 | tip | 24, 16 | 10, 10 | recipe |');
    expect(md).toContain(
      '- kindled-test: haul_slide_W_0 has no hand point (points.hand.haul_slide_W_0)',
    );
  });

  it('writes points.png: the rows that carry points at 4×, a 1 px telegraph-pink cross round each point', () => {
    const bytes = r.outputs.get('art/review/kindled-test/points.png');
    expect(bytes).toBeDefined();
    const img = decodePng(bytes ?? Buffer.alloc(0));
    let pink = 0;
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++)
        if (opaqueAt(img, x, y) && hexAt(img, x, y) === POINT_MARK) pink++;
    // Four arms of one sheet pixel (4 px at 4×) per point; 10 points.
    expect(POINT_MARK).toBe('#e0457b');
    expect(pink).toBe(10 * 4 * POINTS_SCALE);
    // A recipe whose animations carry no points has no points.png.
    const idle = build(root, {
      ...draft({}),
      anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } } } },
    });
    expect([...idle.outputs.keys()].some((k) => k.endsWith('points.png'))).toBe(false);
  });

  it('fails a finished sheet on a missing required point', () => {
    expect(
      problemsOf(() => build(root, fullKindled('art/clean/fig.png', { points: {} }))),
    ).toContain('kindled-test: heavy_charge_S_0 has no tip point (points.tip.heavy_charge_S_0)');
  });

  it('writes the points into the finished sheet in cell pixels, and the sheet passes the §6 point checks', () => {
    const done = build(root, fullKindled('art/clean/fig.png'));
    const sheet = JSON.parse(
      done.outputs.get('packages/shared/assets/sprites/kindled-test.json')?.toString() ?? '{}',
    ) as SpriteSheet;
    // [24, 33] in a 64×64 source: dx 16, dy 10.
    expect(sheet.frames.heavy_charge_S_0?.points).toEqual({ tip: [40, 43] });
    expect(sheet.frames.haul_recover_SW_1?.points).toEqual({ hand: [40, 43] });
    expect(sheet.frames.idle_S_0?.points).toBeUndefined();
    expect(pointProblems('kindled-test', sheet)).toEqual([]);
  });

  it('fails a point outside the source frame, in a draft too', () => {
    expect(
      problemsOf(() => build(root, draft({ points: { tip: { heavy_charge_E_0: [68, 35] } } }))),
    ).toEqual([
      'art/sheets/kindled-test.json: points.tip.heavy_charge_E_0 [68, 35] is outside the 68×68 source frame',
    ]);
  });

  it('fails a point that lands outside the cell or on its outer 1 px ring', () => {
    const tall = blank(64, 90);
    blit(tall, figure(C['watcher-iron']).img, 0, 0);
    writeImg(root, 'art/raw/tall.png', tall);
    const json = {
      ...draft({}),
      anims: {
        heavy_charge: { ground: 'frame', facings: { S: { src: 'art/raw/tall.png', frames: [0] } } },
      },
      points: { tip: { heavy_charge_S_0: [5, 69] } },
    };
    expect(problemsOf(() => build(root, json))).toEqual([
      'heavy_charge_S_0: points.tip at source (5, 69) lands at (21, 79), outside the 96×80 cell or on its outer 1 px ring',
    ]);
  });
});

describe('the body bob flag', () => {
  /** A walk whose top row sits `tops` rows above the soles, frame by frame. */
  const walk = (tops: number[]): BuiltAnim => ({
    key: 'walk_S',
    anim: 'walk',
    facing: 'S',
    frames: tops.map((t, n) => {
      const cell = blank(96, 80);
      rect(cell, 42, 63 - t, 4, t + 1, C['watcher-iron']);
      return { name: `walk_S_${n}`, cell } as BuiltAnim['frames'][number];
    }),
  });

  it('allows 2 px at B and flags 3', () => {
    expect(BOB_FLAG).toBe(2);
    expect(animChecks(walk([45, 47, 46, 45, 47, 46]), 63, true).bob).toEqual({
      tops: [45, 47, 46, 45, 47, 46],
      range: 2,
      flag: false,
    });
    expect(animChecks(walk([45, 48, 46, 45, 47, 46]), 63, true).bob).toEqual({
      tops: [45, 48, 46, 45, 47, 46],
      range: 3,
      flag: true,
    });
  });
});

describe('packing', () => {
  it('fails when the frames do not fit in 2048×2048', () => {
    const cell = blank(96, 80);
    const frames = Array.from({ length: 21 * 26 }, (_, n) => ({
      name: `walk_S_${n}`,
      cell,
      mask: null,
    })) as unknown as BuiltAnim['frames'];
    const anims: BuiltAnim[] = [{ key: 'walk_S', anim: 'walk', facing: 'S', frames }];
    const recipe = { sheet: 'kindled-big', kind: 'kindled' } as Recipe;
    expect(problemsOf(() => pack(recipe, anims))).toEqual([
      'kindled-big: 546 frames of 96×80 need a 2016×2080 sheet; the most is 2048×2048',
    ]);
  });
});

describe('writing and checking', () => {
  it('a draft writes only its review folder; art:check passes, then fails on any hand edit or missing file', () => {
    const root = tempRoot();
    writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
    writeRecipe(root, {
      sheet: 'npc-test',
      kind: 'npc',
      outline: 'other',
      draft: true,
      anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } } } },
    });
    const r = buildAndWrite('npc-test', root);
    expect([...r.outputs.keys()].every((p) => p.startsWith('art/review/npc-test/'))).toBe(true);
    expect(existsSync(join(root, 'packages'))).toBe(false);
    expect(checkAll(root)).toEqual([]);
    const report = join(root, 'art/review/npc-test/report.md');
    writeFileSync(report, `${readFileSync(report, 'utf8')}edited\n`);
    expect(checkAll(root)).toEqual([
      'art/review/npc-test/report.md differs from what art/sheets/npc-test.json builds: run pnpm art:build npc-test (never edit a built file)',
    ]);
    rmSync(join(root, 'art/review/npc-test/contact.png'));
    expect(checkAll(root)).toContain(
      'art/review/npc-test/contact.png is missing: run pnpm art:build npc-test',
    );
  });

  it('art:check reports a recipe that no longer builds', () => {
    const root = tempRoot();
    writeRecipe(root, { sheet: 'npc-test', kind: 'npc', outline: 'other', draft: true, anims: {} });
    expect(checkAll(root)).toEqual([
      'npc-test: art/sheets/npc-test.json: anims must be an object with at least one animation',
    ]);
  });
});

/**
 * A finished sheet of every other kind, checked the way packages/shared's
 * sheet test checks a sheet on disk: the v2 contract (v2Problems) and the
 * sheet's table from spriteSheetSpec.
 */
describe('a finished Husk, NPC and prop sheet', () => {
  const root = tempRoot();
  const plain = figure(C['watcher-iron']).img;
  const tinted = figure(C['watcher-iron']).img;
  rect(tinted, 25, 21, 14, 12, C['signal-telegraph']);
  writeImg(root, 'art/clean/plain.png', plain);
  writeImg(root, 'art/clean/tinted.png', tinted);

  /** The sheet, PNG and mask a finished build wrote, and the problems the shared checks find in them. */
  function finished(json: Record<string, unknown>): {
    sheet: SpriteSheet;
    problems: string[];
    outputs: string[];
  } {
    const name = String(json.sheet);
    const r = build(root, json);
    const out = (p: string): Buffer | undefined =>
      r.outputs.get(`packages/shared/assets/sprites/${p}`);
    const sheet = JSON.parse(out(`${name}.json`)?.toString() ?? '{}') as SpriteSheet;
    const png = decodePng(out(`${name}.png`) ?? Buffer.alloc(0));
    const problems = v2Problems(name, sheet, { width: png.w, height: png.h, rgba: png.data }, null);
    const spec = spriteSheetSpec(name);
    const table =
      spec.kind === 'prop'
        ? (propTableFor(name, (a) => {
            const def = sheet.anims[a];
            return def ? { frames: def.frames.length, fps: def.frameRate } : undefined;
          }) ?? [])
        : (spec.anims ?? []);
    problems.push(...tableProblems(name, sheet, table));
    if (
      JSON.stringify(sheet.meta.facings) !==
      JSON.stringify(spec.facings ? [...SPRITE_FACINGS] : undefined)
    )
      problems.push('meta.facings');
    if (sheet.palette !== undefined) problems.push('a palette block');
    return { sheet, problems, outputs: [...r.outputs.keys()].sort() };
  }

  it('a Husk: its table, no facings, telegraph frames pre-tinted', () => {
    const anims: Record<string, unknown> = {};
    for (const a of HUSK_TABLES.peeling) {
      anims[a.name] = {
        src: a.name === 'telegraph' ? 'art/clean/tinted.png' : 'art/clean/plain.png',
        frames: Array.from({ length: a.frames }, () => 0),
      };
    }
    const r = finished({
      sheet: 'husk-peeling',
      kind: 'husk',
      outline: 'other',
      draft: false,
      anims,
    });
    expect(r.problems).toEqual([]);
    expect(r.sheet.frames.telegraph_0).toBeDefined();
    expect(r.outputs).not.toContain('packages/shared/assets/sprites/husk-peeling.skin.png');
  });

  it('an NPC: idle and walk in 8 facings, meta.facings, no palette or mask', () => {
    const facings = (n: number): Record<string, unknown> =>
      Object.fromEntries(
        SPRITE_FACINGS.map((f) => [
          f,
          { src: 'art/clean/plain.png', frames: Array.from({ length: n }, () => 0) },
        ]),
      );
    const r = finished({
      sheet: 'npc-test',
      kind: 'npc',
      outline: 'other',
      draft: false,
      anims: { idle: { facings: facings(2) }, walk: { facings: facings(6) } },
    });
    expect(r.problems).toEqual([]);
    expect(r.sheet.meta.facings).toEqual([...SPRITE_FACINGS]);
    expect(r.outputs).toEqual([
      'art/review/npc-test/contact.png',
      'art/review/npc-test/report.json',
      'art/review/npc-test/report.md',
      'packages/shared/assets/sprites/npc-test.json',
      'packages/shared/assets/sprites/npc-test.png',
    ]);
  });

  it('a finished NPC still needs both animations in all 8 facings', () => {
    const json = {
      sheet: 'npc-test',
      kind: 'npc',
      outline: 'other',
      draft: false,
      anims: { idle: { facings: { S: { src: 'art/clean/plain.png', frames: [0, 0] } } } },
    };
    const p = problemsOf(() => build(root, json));
    expect(p).toContain(
      'npc-test: idle_SE is missing (a finished sheet carries every animation and facing)',
    );
    expect(p).toContain(
      'npc-test: walk_S is missing (a finished sheet carries every animation and facing)',
    );
    expect(p).toHaveLength(15);
  });

  it('a prop: idle only, its frame rate from the recipe (default 8), looping with more than one frame', () => {
    const flame = finished({
      sheet: 'prop-flame',
      kind: 'prop',
      outline: 'other',
      draft: false,
      anims: { idle: { src: 'art/clean/plain.png', frames: [0, 0, 0, 0], fps: 12 } },
    });
    expect(flame.problems).toEqual([]);
    expect(flame.sheet.anims).toEqual({
      idle: { frames: ['idle_0', 'idle_1', 'idle_2', 'idle_3'], frameRate: 12, repeat: -1 },
    });
    const jar = finished({
      sheet: 'prop-jar',
      kind: 'prop',
      outline: 'other',
      draft: false,
      anims: { idle: { src: 'art/clean/plain.png', frames: [0] } },
    });
    expect(jar.problems).toEqual([]);
    expect(jar.sheet.anims).toEqual({
      idle: { frames: ['idle_0'], frameRate: 8, repeat: 0, hold: true },
    });
  });

  it('a tall prop (prop-twisted-tree) builds on the 96×128 cell with the origin at (48, 118): its base on cell row 117, the canopy above and to the sides (ART on #82)', () => {
    // A 96×128 source: a trunk from row 70 to 117 and a crown from row 6, 84 wide; it would not fit a 64×64 cell.
    const r = tempRoot();
    const tree = blank(96, 128);
    rect(tree, 44, 70, 8, 48, C['unwritten-tar']);
    rect(tree, 6, 6, 84, 64, C['wheel-patina']);
    writeImg(r, 'art/clean/tree.png', tree);
    const json = {
      sheet: 'prop-twisted-tree',
      kind: 'prop',
      outline: 'other',
      draft: false,
      anims: { idle: { src: 'art/clean/tree.png', frames: [0] } },
    };
    const built = build(r, json);
    const sheet = JSON.parse(built.outputs.get('packages/shared/assets/sprites/prop-twisted-tree.json')?.toString() ?? '{}') as SpriteSheet;
    expect(sheet.meta.cell).toEqual({ w: 96, h: 128 });
    expect(sheet.meta.origin).toEqual({ x: 48, y: 118 });
    expect(sheet.meta.size).toEqual({ w: 96, h: 128 });
    expect(sheet.frames.idle_0?.frame).toEqual({ x: 0, y: 0, w: 96, h: 128 });
    expect(sheet.frames.idle_0?.anchor).toEqual({ x: 0.5, y: 118 / 128 });
    const png = decodePng(built.outputs.get('packages/shared/assets/sprites/prop-twisted-tree.png') ?? Buffer.alloc(0));
    expect(v2Problems('prop-twisted-tree', sheet, { width: png.w, height: png.h, rgba: png.data }, null)).toEqual([]);
    // The lowest opaque row (the trunk's base) sits on cell row 117; the crown keeps its row 6 (the outline recolours edge pixels, it adds none).
    const rows = Array.from({ length: 128 }, (_, y) => Array.from({ length: 96 }, (_, x) => opaqueAt(png, x, y)).some(Boolean));
    expect(rows.lastIndexOf(true)).toBe(117);
    expect(rows.indexOf(true)).toBe(6);
    expect(built.anims[0]?.frames[0]?.cell.h).toBe(128);
    // The same source under another prop's name does not fit the 64×64 cell: nothing is cropped, so it fails.
    expect(problemsOf(() => build(r, { ...json, sheet: 'prop-jar' }))[0]).toMatch(/^idle_0: placed at \(-16, -64\) in the 64×64 cell, source pixels .* would fall outside it/);
  });

  it('a prop with more than 8 frames fails', () => {
    const json = {
      sheet: 'prop-jar',
      kind: 'prop',
      outline: 'other',
      draft: false,
      anims: { idle: { src: 'art/clean/plain.png', frames: Array.from({ length: 9 }, () => 0) } },
    };
    expect(problemsOf(() => build(root, json))).toEqual([
      "prop-jar: a prop's idle has 1 to 8 frames, not 9",
    ]);
  });

  /** A chest recipe (the prop with a table of its own, G1.5f) with the given frame counts. */
  const chestRecipe = (counts: Partial<Record<'closed' | 'opening' | 'open', number>>, extra: Record<string, unknown> = {}) => ({
    sheet: 'prop-chest',
    kind: 'prop',
    outline: 'other',
    draft: false,
    anims: Object.fromEntries(
      Object.entries(counts).map(([anim, n]) => [anim, { src: 'art/clean/plain.png', frames: Array.from({ length: n }, () => 0) }]),
    ),
    ...extra,
  });

  it('the chest: its own table, closed at the recipe\'s rate looping with 2 frames, opening once at 12 fps, open held', () => {
    const json = chestRecipe({ closed: 2, opening: 4, open: 1 });
    (json.anims.closed as Record<string, unknown>).fps = 2;
    const r = finished(json);
    expect(r.problems).toEqual([]);
    expect(r.sheet.anims).toEqual({
      closed: { frames: ['closed_0', 'closed_1'], frameRate: 2, repeat: -1 },
      opening: { frames: ['opening_0', 'opening_1', 'opening_2', 'opening_3'], frameRate: 12, repeat: 0, hold: true },
      open: { frames: ['open_0'], frameRate: 0, repeat: 0, hold: true },
    });
    expect(r.sheet.meta).toMatchObject({ cell: { w: 64, h: 64 }, origin: { x: 32, y: 54 } });
    expect(Object.keys(r.sheet.frames)).toEqual(['closed_0', 'closed_1', 'opening_0', 'opening_1', 'opening_2', 'opening_3', 'open_0']);
    // A 1-frame closed is still: held, at the default rate.
    const still = finished(chestRecipe({ closed: 1, opening: 4, open: 1 }));
    expect(still.problems).toEqual([]);
    expect(still.sheet.anims.closed).toEqual({ frames: ['closed_0'], frameRate: 8, repeat: 0, hold: true });
  });

  it('a finished chest needs all three animations; closed has at most 2 frames', () => {
    expect(problemsOf(() => build(root, chestRecipe({ closed: 2, open: 1 })))).toEqual([
      'prop-chest: opening is missing (a finished sheet carries every animation and facing)',
    ]);
    expect(problemsOf(() => build(root, chestRecipe({ closed: 3, opening: 4, open: 1 })))).toEqual([
      "prop-chest: a prop's closed has 1 to 2 frames, not 3",
    ]);
    expect(problemsOf(() => build(root, chestRecipe({ closed: 2, opening: 3, open: 1 })))).toEqual([
      'prop-chest: opening has 3 frames; the table says 4',
    ]);
  });

  it('a draft chest builds with any subset of its table, writing the review only', () => {
    const r = build(root, chestRecipe({ closed: 2, open: 1 }, { draft: true }));
    expect([...r.outputs.keys()].sort()).toEqual([
      'art/review/prop-chest/contact.png',
      'art/review/prop-chest/report.json',
      'art/review/prop-chest/report.md',
    ]);
    expect(r.anims.map((a) => a.key)).toEqual(['closed', 'open']);
  });

  it('the chest takes fps on closed only; opening and open are rated by the table', () => {
    const json = chestRecipe({ closed: 2, opening: 4, open: 1 });
    (json.anims.opening as Record<string, unknown>).fps = 6;
    expect(problemsOf(() => build(root, json))).toEqual([
      'art/sheets/prop-chest.json: anims.opening.fps is only for closed (opening takes its rate from the prop animation table)',
    ]);
    const burn = chestRecipe({ closed: 2, opening: 4, open: 1 }, { anims: { burn: { src: 'art/clean/plain.png', frames: [0] } } });
    expect(problemsOf(() => build(root, burn))).toEqual([
      'art/sheets/prop-chest.json: anims.burn is not in the prop animation table (closed, opening, open)',
    ]);
  });
});
