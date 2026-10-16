import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KINDLED_ANIMS,
  kindledAnimKey,
  HUSK_TABLES,
  kindledFrameName,
  propIdleSpec,
  isRequiredAnim,
  SPRITE_FACINGS,
  spriteSheetSpec,
  type SpriteAnimSpec,
  type SpriteSheet,
} from '@iot/shared';
import { tableProblems, v2Problems } from '../../shared/test/sheetChecks.js';
import { APP_ID, buildRecipe, pack, type BuiltAnim } from '../src/build.js';
import { PipelineError } from '../src/errors.js';
import { blank, hexAt, opaqueAt } from '../src/image.js';
import { animChecks, BOB_FLAG } from '../src/review.js';
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
    ...extra,
  };
}

function build(root: string, json: Record<string, unknown>) {
  const recipe: Recipe = parseRecipe(json, `art/sheets/${String(json.sheet)}.json`, root);
  return buildRecipe(recipe, root);
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
    expect(sheet.meta.size).toEqual({ w: 18 * 112, h: Math.ceil(expected.length / 18) * 80 });
    expect([png.w, png.h]).toEqual([sheet.meta.size.w, sheet.meta.size.h]);
    names.forEach((name, i) => {
      expect(sheet.frames[name]?.frame, name).toEqual({
        x: (i % 18) * 112,
        y: Math.floor(i / 18) * 80,
        w: 112,
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
      cell: { w: 112, h: 80 },
      origin: { x: 56, y: 64 },
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

  it('puts the canvas at (24, 10): the soles on cell row 63', () => {
    const f = sheet.frames.idle_S_0?.frame ?? { x: 0, y: 0 };
    expect(opaqueAt(png, f.x + 24 + 27, f.y + 10 + 53)).toBe(true);
    expect(opaqueAt(png, f.x + 24 + 27, f.y + 10 + 54)).toBe(false);
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

  it('passes without the M2 animations (carry_idle, carry_walk, sit), on the shared sheet checks too', () => {
    const m1 = KINDLED_ANIMS.filter(isRequiredAnim);
    expect(KINDLED_ANIMS.filter((a) => !isRequiredAnim(a)).map((a) => a.name)).toEqual([
      'carry_idle',
      'carry_walk',
      'sit',
    ]);
    const r = build(root, fullKindled('art/clean/fig.png', {}, m1));
    const json = JSON.parse(
      r.outputs.get('packages/shared/assets/sprites/kindled-test.json')?.toString() ?? '{}',
    ) as SpriteSheet;
    const sheetPng = decodePng(
      r.outputs.get('packages/shared/assets/sprites/kindled-test.png') ?? Buffer.alloc(0),
    );
    const sheetMask = decodePng(
      r.outputs.get('packages/shared/assets/sprites/kindled-test.skin.png') ?? Buffer.alloc(0),
    );
    expect(
      Object.keys(json.anims).some((k) => k.startsWith('carry_') || k.startsWith('sit_')),
    ).toBe(false);
    expect(tableProblems('kindled-test', json, KINDLED_ANIMS)).toEqual([]);
    expect(
      v2Problems(
        'kindled-test',
        json,
        { width: sheetPng.w, height: sheetPng.h, rgba: sheetPng.data },
        { width: sheetMask.w, height: sheetMask.h, rgba: sheetMask.data },
      ),
    ).toEqual([]);
    expect(r.report.optional).toEqual(['carry_idle (M2)', 'carry_walk (M2)', 'sit (M2)']);
  });

  it('fails an optional animation that is there but incomplete', () => {
    const json = fullKindled('art/clean/fig.png');
    const anims = json.anims as Record<string, { facings: Record<string, { frames: number[] }> }>;
    delete anims.sit?.facings.E;
    delete anims.carry_idle;
    anims.carry_walk?.facings.N?.frames.pop();
    expect(problemsOf(() => build(root, json))).toEqual([
      'kindled-test: carry_walk_N has 5 frames; the table says 6',
      'kindled-test: sit_E is missing (sit is optional until M2, but a finished sheet that has it carries every facing)',
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
    expect(opaqueAt(mask, 24 + 30, 10 + 33)).toBe(true);
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
    expect(hexAt(r.anims[0]?.frames[0]?.cell ?? blank(1, 1), 24 + 30, 10 + 33)).toBe(
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
    expect(hexAt(r.anims[0]?.frames[0]?.cell ?? blank(1, 1), 24 + 30, 10 + 33)).toBe(
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

describe('the body bob flag', () => {
  /** A walk whose top row sits `tops` rows above the soles, frame by frame. */
  const walk = (tops: number[]): BuiltAnim => ({
    key: 'walk_S',
    anim: 'walk',
    facing: 'S',
    frames: tops.map((t, n) => {
      const cell = blank(112, 80);
      rect(cell, 50, 63 - t, 4, t + 1, C['watcher-iron']);
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
    const cell = blank(112, 80);
    const frames = Array.from({ length: 18 * 26 }, (_, n) => ({
      name: `walk_S_${n}`,
      cell,
      mask: null,
    })) as unknown as BuiltAnim['frames'];
    const anims: BuiltAnim[] = [{ key: 'walk_S', anim: 'walk', facing: 'S', frames }];
    const recipe = { sheet: 'kindled-big', kind: 'kindled' } as Recipe;
    expect(problemsOf(() => pack(recipe, anims))).toEqual([
      'kindled-big: 468 frames of 112×80 need a 2016×2080 sheet; the most is 2048×2048',
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
        ? [propIdleSpec(sheet.anims.idle?.frames.length ?? 0, sheet.anims.idle?.frameRate)]
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
});
