import { describe, expect, it } from 'vitest';
import { PipelineError } from '../src/errors.js';
import { parseRecipe } from '../src/recipe.js';
import { C, figure, tempRoot, writeImg } from './helpers.js';

const root = tempRoot();
writeImg(root, 'art/clean/fig.png', figure(C['watcher-iron']).img);
writeImg(root, 'art/clean/walk/frame-0.png', figure(C['watcher-iron']).img);
writeImg(root, 'art/clean/walk/frame-1.png', figure(C['watcher-iron']).img);

const good = () => ({
  sheet: 'kindled-test',
  kind: 'kindled',
  outline: 'player',
  draft: true,
  anims: {
    idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } } },
    walk: { ground: 'frame', facings: { S: { src: 'art/clean/walk', frames: [0, 1] } } },
  },
  fixes: [
    {
      frame: 'walk_S_1',
      pixels: [
        [30, 41, '#7D8794'],
        [31, 41, null],
      ],
    },
  ],
  skin: {
    add: { walk_S_0: [[22, 40]] },
    remove: {
      idle_S_0: [
        [
          [40, 38],
          [43, 41],
        ],
      ],
    },
  },
});

/** The problems a recipe fails with. */
function problems(json: unknown, file = 'art/sheets/kindled-test.json'): readonly string[] {
  try {
    parseRecipe(json, file, root);
  } catch (e) {
    if (e instanceof PipelineError) return e.problems;
    throw e;
  }
  return [];
}

describe('the recipe guard', () => {
  it('accepts the documented shape and lowercases fix colours', () => {
    const r = parseRecipe(good(), 'art/sheets/kindled-test.json', root);
    expect(r.fixes[0]?.pixels[0]).toEqual([30, 41, '#7d8794']);
    expect(r.skin.remove.idle_S_0).toEqual([
      [
        [40, 38],
        [43, 41],
      ],
    ]);
  });

  it('accepts a kind without facings with src and frames on the animation', () => {
    const r = parseRecipe(
      {
        sheet: 'prop-jar',
        kind: 'prop',
        outline: 'other',
        draft: true,
        anims: { idle: { src: 'art/clean/fig.png', frames: [0] } },
      },
      'art/sheets/prop-jar.json',
      root,
    );
    expect(r.anims.idle?.source).toEqual({ src: 'art/clean/fig.png', frames: [0] });
  });

  it.each([
    [
      'an unknown key',
      { ...good(), colour: 'red' },
      'art/sheets/kindled-test.json: colour is not a recipe field',
    ],
    [
      'an unknown animation key',
      {
        ...good(),
        anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } }, speed: 2 } },
      },
      'anims.idle.speed is not a recipe field',
    ],
    [
      'an unknown source key',
      {
        ...good(),
        anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0], fps: 4 } } } },
      },
      'anims.idle.facings.S.fps is not a recipe field',
    ],
    [
      'a sheet name that is not the file',
      { ...good(), sheet: 'kindled-other' },
      'sheet is "kindled-other" but the file is kindled-test.json',
    ],
    ['a bad kind', { ...good(), kind: 'boss' }, 'kind must be one of kindled, npc, enemy, prop'],
    [
      'a Kindled name on another kind',
      { ...good(), kind: 'npc', outline: 'other', skin: undefined },
      'kind is npc but "kindled-" names are Kindled sheets',
    ],
    ['a missing draft flag', { ...good(), draft: undefined }, 'draft must be true or false'],
    [
      'an animation outside the table',
      {
        ...good(),
        anims: { dance: { facings: { S: { src: 'art/clean/fig.png', frames: [0] } } } },
      },
      'anims.dance is not in the kindled animation table',
    ],
    [
      'a facing the animation lacks',
      { ...good(), anims: { hit: { facings: { SE: { src: 'art/clean/fig.png', frames: [0] } } } } },
      'anims.hit.facings.SE is not a facing of hit (S, E, N, W)',
    ],
    [
      'a missing file',
      {
        ...good(),
        anims: { idle: { facings: { S: { src: 'art/clean/nope.png', frames: [0] } } } },
      },
      'anims.idle.facings.S.src art/clean/nope.png does not exist',
    ],
    [
      'a missing frame in a folder',
      { ...good(), anims: { walk: { facings: { S: { src: 'art/clean/walk', frames: [0, 2] } } } } },
      'art/clean/walk/frame-2.png does not exist',
    ],
    [
      'a missing ground ref frame',
      {
        ...good(),
        anims: {
          walk: { ground: { ref: 5 }, facings: { S: { src: 'art/clean/walk', frames: [0] } } },
        },
      },
      'art/clean/walk/frame-5.png does not exist',
    ],
    [
      'frame 1 of a single PNG',
      { ...good(), anims: { idle: { facings: { S: { src: 'art/clean/fig.png', frames: [1] } } } } },
      'art/clean/fig.png is a single PNG: its only frame is 0',
    ],
    [
      'a path outside art/',
      { ...good(), anims: { idle: { facings: { S: { src: 'packages/x.png', frames: [0] } } } } },
      'anims.idle.facings.S.src must be a repo-relative path under art/',
    ],
    [
      'a bad ground',
      {
        ...good(),
        anims: {
          idle: { ground: 'feet', facings: { S: { src: 'art/clean/fig.png', frames: [0] } } },
        },
      },
      'anims.idle.ground must be "frame", "canvas" or { "ref": <source frame index> }',
    ],
    [
      'a bad downscale',
      {
        ...good(),
        anims: {
          idle: { facings: { S: { src: 'art/clean/fig.png', frames: [0], downscale: 1 } } },
        },
      },
      'downscale must be a whole number, 2 or more',
    ],
    [
      'a fix on a frame the recipe does not build',
      { ...good(), fixes: [{ frame: 'walk_S_9', pixels: [[0, 0, null]] }] },
      'fixes[0].frame names "walk_S_9", which is not a frame this recipe builds',
    ],
    [
      'a fix colour off the whitelist',
      { ...good(), fixes: [{ frame: 'walk_S_1', pixels: [[0, 0, '#ffffff']] }] },
      'fixes[0].pixels[0] sets #ffffff, which is not a whitelist colour',
    ],
    [
      'a malformed fix',
      { ...good(), fixes: [{ frame: 'walk_S_1', pixels: [[0, 0]] }] },
      'fixes[0].pixels[0] must be [x, y, "#rrggbb"] or [x, y, null]',
    ],
    [
      'a skin area that is neither a pixel nor a rectangle',
      { ...good(), skin: { add: { walk_S_0: [[1, 2, 3]] } } },
      'skin.add.walk_S_0 must be a non-empty list',
    ],
    [
      'skin on a sheet without a mask',
      { ...good(), sheet: 'npc-test', kind: 'npc', outline: 'other' },
      'skin is only for Kindled sheets',
    ],
    [
      'the player outline on an NPC',
      { ...good(), sheet: 'npc-test', kind: 'npc', skin: undefined },
      'outline is "player" but only Kindled sheets use the player outline',
    ],
  ])('fails on %s', (_, json, message) => {
    const file =
      typeof json.sheet === 'string' && json.sheet.startsWith('npc-')
        ? 'art/sheets/npc-test.json'
        : 'art/sheets/kindled-test.json';
    const p = problems(JSON.parse(JSON.stringify(json)) as unknown, file);
    expect(
      p.some((x) => x.includes(message)),
      `${p.join('\n')}\nwanted: ${message}`,
    ).toBe(true);
  });

  it('fails on something that is not an object', () => {
    expect(problems([])).toEqual(['art/sheets/kindled-test.json: a recipe is a JSON object']);
  });
});
