import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KINDLED_ANIMS,
  kindledAnimKey,
  kindledFrameName,
  SPRITE_FACINGS,
  type SpriteSheet,
} from '@iot/shared';
import { v2Problems } from '../../shared/test/sheetChecks.js';
import { APP_ID, buildRecipe, pack, type BuiltAnim } from '../src/build.js';
import { PipelineError } from '../src/errors.js';
import { blank, hexAt, opaqueAt } from '../src/image.js';
import { decodePng } from '../src/png.js';
import { parseRecipe, type Recipe } from '../src/recipe.js';
import { buildAndWrite, checkAll } from '../src/sheets.js';
import { C, figure, tempRoot, writeImg, writeRecipe } from './helpers.js';

/** A full Kindled recipe: every animation, facing and frame in the table, all from one figure. */
function fullKindled(src: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const anims: Record<string, unknown> = {};
  for (const a of KINDLED_ANIMS) {
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
    delete anims.sit;
    delete anims.walk?.facings.SW;
    anims.idle?.facings.S?.frames.pop();
    expect(problemsOf(() => build(root, json))).toEqual([
      'kindled-test: idle_S has 1 frames; the table says 2',
      'kindled-test: walk_SW is missing (a finished sheet carries every animation and facing)',
      'kindled-test: sit_S is missing (a finished sheet carries every animation and facing)',
      'kindled-test: sit_E is missing (a finished sheet carries every animation and facing)',
    ]);
  });

  it('fails a non-draft sheet of a kind the contract has no table for', () => {
    const json = {
      sheet: 'npc-test',
      kind: 'npc',
      outline: 'other',
      draft: false,
      anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } } } },
    };
    expect(problemsOf(() => build(root, json))).toEqual([
      'npc-test: the sprite contract has no animation table (frame counts and rates) for npc sheets yet, so only a draft can be built',
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
