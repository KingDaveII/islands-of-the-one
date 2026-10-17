import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  roomTemplates,
  roomTiles,
  doorFrameName,
  TILE_FRAMES,
  TILE_RECIPE_PIECES,
  type TileSheet,
} from '@iot/shared';
import { tileSheetProblems } from '../../shared/test/tileChecks.js';
import { PipelineError } from '../src/errors.js';
import { blank, blit, fillRect, hexAt, opaqueAt, sameImg, setPixel, type Img } from '../src/image.js';
import { decodePng } from '../src/png.js';
import { parseRecipe } from '../src/recipe.js';
import { POINT_MARK } from '../src/review.js';
import { buildAndWrite, buildAny, checkAll } from '../src/sheets.js';
import { ROOM_GAP, type TileBuildResult } from '../src/tiles.js';
import { C, tempRoot, writeImg, writeRecipe } from './helpers.js';

/**
 * The `tiles` kind (art-pipeline.md "Kinds", sprites.md "Tiles"): pieces cut
 * from the shared tile fixture (packages/shared/test/fixtures/tiles-fixture.*)
 * into a throwaway repo, built into a sheet, its contact sheet and rooms.png.
 */

const FIXTURE = new URL('../../shared/test/fixtures/', import.meta.url);
const fixture = JSON.parse(readFileSync(new URL('tiles-fixture.json', FIXTURE), 'utf8')) as TileSheet;
const fixturePng = decodePng(readFileSync(new URL('tiles-fixture.png', FIXTURE)));

/** A frame of the fixture as its own image. */
function piece(name: string): Img {
  const f = fixture.frames[name]?.frame;
  if (!f) throw new Error(`the fixture has no ${name}`);
  const out = blank(f.w, f.h);
  for (let y = 0; y < f.h; y++)
    out.data.set(fixturePng.data.subarray(((f.y + y) * fixturePng.w + f.x) * 4, ((f.y + y) * fixturePng.w + f.x + f.w) * 4), y * f.w * 4);
  return out;
}

/** A repo holding every fixture piece under art/clean/tiles-test: a PNG per static piece, a folder of frames per door animation. */
function fixtureRoot(): string {
  const root = tempRoot();
  for (const f of TILE_FRAMES) {
    const door = f.name.startsWith('door_');
    writeImg(root, door ? `art/clean/tiles-test/${f.piece}/frame-${f.n}.png` : `art/clean/tiles-test/${f.name}.png`, piece(f.name));
  }
  return root;
}

/** Every piece of the contract, from the fixture's files. */
function allPieces(): Record<string, unknown> {
  return Object.fromEntries(
    TILE_RECIPE_PIECES.map((p) =>
      p.name.startsWith('door_')
        ? [p.name, { src: `art/clean/tiles-test/${p.name}`, frames: Array.from({ length: p.frames }, (_, n) => n) }]
        : [p.name, { src: `art/clean/tiles-test/${p.name}.png` }],
    ),
  );
}

const recipe = (extra: Record<string, unknown> = {}) => ({
  sheet: 'tiles-test',
  kind: 'tiles',
  outline: 'other',
  draft: false,
  floorWeights: [6, 3, 2, 1],
  pieces: allPieces(),
  ...extra,
});

function build(root: string, json: Record<string, unknown>): TileBuildResult {
  const r = buildAny(parseRecipe(json, `art/sheets/${String(json.sheet)}.json`, root), root);
  if (!('tiles' in r)) throw new Error('not a tiles build');
  return r;
}

function failure(fn: () => unknown): readonly string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof PipelineError) return e.problems;
    throw e;
  }
  return [];
}

const root = fixtureRoot();
const full = build(root, recipe());

describe('a finished tiles recipe', () => {
  const sheetPng = full.outputs.get('packages/shared/assets/sprites/tiles-test.png');
  const sheetJson = full.outputs.get('packages/shared/assets/sprites/tiles-test.json');

  it('writes a sheet that follows the tile contract', () => {
    expect(sheetPng).toBeDefined();
    expect(sheetJson).toBeDefined();
    if (!sheetPng || !sheetJson) return;
    const sheet = JSON.parse(sheetJson.toString()) as TileSheet;
    const png = decodePng(sheetPng);
    expect(tileSheetProblems('tiles-test', sheet, { width: png.w, height: png.h, rgba: png.data })).toEqual([]);
    expect(sheet.meta).toEqual({
      image: 'tiles-test.png',
      size: { w: png.w, h: png.h },
      scale: '1',
      format: 'RGBA8888',
      app: 'iot-art-pipeline',
      version: '2',
      pixelScale: 1,
    });
    expect(sheet.tiles).toEqual({ tileSize: 32, floorWeights: [6, 3, 2, 1] });
    expect(Object.keys(sheet.frames)).toEqual(TILE_FRAMES.map((f) => f.name));
  });

  it('packs door frames whole, pixel for pixel, never split into cells', () => {
    if (!sheetPng || !sheetJson) throw new Error('no sheet');
    const sheet = JSON.parse(sheetJson.toString()) as TileSheet;
    const png = decodePng(sheetPng);
    for (const name of ['door_n_opening_3', 'door_w_closed_0', 'door_e_open_0', 'floor_2', 'shade_nw']) {
      const r = sheet.frames[name]?.frame;
      if (!r) throw new Error(name);
      const src = piece(name);
      expect([r.w, r.h], name).toEqual([src.w, src.h]);
      const cut = blank(r.w, r.h);
      for (let y = 0; y < r.h; y++) cut.data.set(png.data.subarray(((r.y + y) * png.w + r.x) * 4, ((r.y + y) * png.w + r.x + r.w) * 4), y * r.w * 4);
      expect(sameImg(cut, src), name).toBe(true);
    }
    expect(sheet.frames.door_n_closed_0?.frame).toMatchObject({ w: 64, h: 32 });
    expect(sheet.frames.door_e_opening_0?.frame).toMatchObject({ w: 32, h: 64 });
    expect(sheet.anims.door_n_opening).toEqual({
      frames: [0, 1, 2, 3, 4, 5].map((n) => doorFrameName('door_n', 'opening', n)),
      frameRate: 12,
      repeat: 0,
      hold: true,
    });
  });

  it('writes the review: contact.png, rooms.png and the report', () => {
    expect([...full.outputs.keys()].sort()).toEqual([
      'art/review/tiles-test/contact.png',
      'art/review/tiles-test/report.json',
      'art/review/tiles-test/report.md',
      'art/review/tiles-test/rooms.png',
      'packages/shared/assets/sprites/tiles-test.json',
      'packages/shared/assets/sprites/tiles-test.png',
    ]);
    expect(full.report.missing).toEqual([]);
    expect(full.report.rooms.map((r) => r.name)).toEqual(roomTemplates.map((t) => t.name));
    const md = full.outputs.get('art/review/tiles-test/report.md')?.toString() ?? '';
    expect(md).toContain('# tiles-test\n');
    expect(md).toContain('| Shell Gallery | 32×19 | 16, 16 | none |');
  });

  it("draws rooms.png from the built pieces with the engine's rule, at 1×, doors closed", () => {
    const bytes = full.outputs.get('art/review/tiles-test/rooms.png');
    if (!bytes) throw new Error('no rooms.png');
    const got = decodePng(bytes);
    // The same picture composed here from the fixture's own frames and roomTiles.
    const cols = (t: { tiles: readonly string[] }) => Math.max(...t.tiles.map((r) => r.length));
    const w = ROOM_GAP * 2 + Math.max(...roomTemplates.map((t) => cols(t) * 32));
    const h = roomTemplates.reduce((s, t) => s + t.tiles.length * 32 + ROOM_GAP, ROOM_GAP);
    const want = blank(w, h);
    fillRect(want, 0, 0, w, h, C['hollow-deep']);
    let oy = ROOM_GAP;
    for (const t of roomTemplates) {
      const { draws, doors } = roomTiles(t, { floorWeights: [6, 3, 2, 1] });
      for (const d of draws) blit(want, piece(d.piece), ROOM_GAP + d.col * 32, oy + d.row * 32);
      for (const d of doors) blit(want, piece(doorFrameName(d.piece, 'closed', 0)), ROOM_GAP + d.col * 32, oy + d.row * 32);
      oy += t.tiles.length * 32 + ROOM_GAP;
    }
    expect([got.w, got.h]).toEqual([w, h]);
    expect(sameImg(got, want)).toBe(true);
    // Spot checks: the Shell Gallery's north door (closed) and a floor cell's shade.
    expect(hexAt(got, ROOM_GAP + 15 * 32 + 1, ROOM_GAP + 1)).toBe(C['watcher-rain']);
    expect(hexAt(got, ROOM_GAP + 32 + 26, ROOM_GAP + 32 + 1)).toBe(C['hollow-dusk']);
  });

  it('writes faceMidWeights and topMidWeights into the tiles block when the recipe gives them, and draws rooms.png with them', () => {
    const rare = build(root, recipe({ faceMidWeights: [3, 1], topMidWeights: [3, 1] }));
    const json = rare.outputs.get('packages/shared/assets/sprites/tiles-test.json');
    if (!json) throw new Error('no sheet');
    const sheet = JSON.parse(json.toString()) as TileSheet;
    expect(sheet.tiles).toEqual({ tileSize: 32, floorWeights: [6, 3, 2, 1], faceMidWeights: [3, 1], topMidWeights: [3, 1] });
    expect(tileSheetProblems('tiles-test', sheet, { width: 1, height: 1, rgba: new Uint8Array(4) })).not.toContain(
      expect.stringContaining('MidWeights'),
    );
    expect(rare.report).toMatchObject({ floorWeights: [6, 3, 2, 1], faceMidWeights: [3, 1], topMidWeights: [3, 1] });
    expect(rare.outputs.get('art/review/tiles-test/report.md')?.toString()).toContain('plain face 3:1 and plain top 3:1 (mid_0 to mid_1)');
    // Without them the block has only floorWeights, the report says 1:1, and rooms.png is the even pick's.
    expect(full.report.faceMidWeights).toBeUndefined();
    expect(full.outputs.get('art/review/tiles-test/report.md')?.toString()).toContain('plain face 1:1 and plain top 1:1');
    const even = decodePng(full.outputs.get('art/review/tiles-test/rooms.png') ?? Buffer.alloc(0));
    const weighted = decodePng(rare.outputs.get('art/review/tiles-test/rooms.png') ?? Buffer.alloc(0));
    expect(sameImg(even, weighted)).toBe(false);
    // The Narrow Hollow's north wall (row 0 of the second room) with 3:1 shows the spare face (watcher-iron body) less than a third of the time.
    const narrow = roomTemplates.findIndex((t) => t.name === 'Narrow Hollow');
    const oy = roomTemplates.slice(0, narrow).reduce((s, t) => s + t.tiles.length * 32 + ROOM_GAP, ROOM_GAP);
    const spare = (img: typeof even) =>
      Array.from({ length: 38 }, (_, c) => hexAt(img, ROOM_GAP + (c + 1) * 32 + 28, oy + 28)).filter((h) => h === C['watcher-iron']).length;
    expect(spare(weighted)).toBeLessThan(spare(even));
    expect(spare(weighted)).toBeGreaterThan(0);
  });

  it('rebuilds byte for byte (art:check)', () => {
    const r2 = fixtureRoot();
    writeRecipe(r2, recipe());
    buildAndWrite('tiles-test', r2);
    expect(checkAll(r2)).toEqual([]);
    writeRecipe(r2, recipe({ floorWeights: [1, 1, 1, 1] }));
    expect(checkAll(r2)).toEqual(
      expect.arrayContaining([
        'packages/shared/assets/sprites/tiles-test.json differs from what art/sheets/tiles-test.json builds: run pnpm art:build tiles-test (never edit a built file)',
        'art/review/tiles-test/rooms.png differs from what art/sheets/tiles-test.json builds: run pnpm art:build tiles-test (never edit a built file)',
      ]),
    );
  });
});

describe('the tiles steps', () => {
  it('fails a piece whose source is not its exact size, naming the piece and both sizes', () => {
    const r = fixtureRoot();
    writeImg(r, 'art/clean/tiles-test/floor_1.png', blank(32, 30));
    writeImg(r, 'art/clean/tiles-test/door_w_open/frame-0.png', piece('door_n_open_0'));
    expect(failure(() => build(r, recipe()))).toEqual([
      'floor_1 (art/clean/tiles-test/floor_1.png frame 0): the source is 32×30, but floor_1 is 32×32; ' +
        "a piece's source must be its exact size (nothing is scaled or shifted)",
      'door_w_open_0 (art/clean/tiles-test/door_w_open frame 0): the source is 64×32, but door_w_open is 32×64; ' +
        "a piece's source must be its exact size (nothing is scaled or shifted)",
    ]);
  });

  it('outlines only against transparency inside the piece: the border is no edge and no gap', () => {
    const r = fixtureRoot();
    // A floor framed by a dream-night border: not an edge, so it is neither recoloured nor counted.
    const floor = blank(32, 32);
    fillRect(floor, 0, 0, 32, 32, C['dream-night']);
    fillRect(floor, 1, 1, 30, 30, C['hollow-lavender']);
    writeImg(r, 'art/clean/tiles-test/floor_0.png', floor);
    // A shade: a band in hollow-dusk with a dream-night line along its inner side, where it meets transparency.
    const shade = blank(32, 32);
    fillRect(shade, 0, 0, 32, 6, C['hollow-dusk']);
    fillRect(shade, 0, 6, 32, 1, C['dream-night']);
    writeImg(r, 'art/clean/tiles-test/shade_n.png', shade);
    const built = build(r, recipe());
    const get = (name: string) => built.tiles.find((t) => t.name === name);
    const f0 = get('floor_0');
    const sn = get('shade_n');
    if (!f0 || !sn) throw new Error('missing');
    expect(f0.outlineGaps).toBe(0);
    expect(hexAt(f0.img, 0, 0)).toBe(C['dream-night']);
    expect(hexAt(f0.img, 31, 16)).toBe(C['dream-night']);
    // The line against transparency takes the outline colour; the band's border rows are no gap.
    expect(hexAt(sn.img, 10, 6)).toBe(C['hollow-deep']);
    expect(sn.outlineGaps).toBe(0);
    expect(hexAt(sn.img, 0, 0)).toBe(C['hollow-dusk']);
    // A band with no line has gaps: its pixels against transparency are not an outline colour.
    const bare = blank(32, 32);
    fillRect(bare, 0, 0, 32, 6, C['hollow-dusk']);
    writeImg(r, 'art/clean/tiles-test/shade_n.png', bare);
    expect(build(r, recipe()).tiles.find((t) => t.name === 'shade_n')?.outlineGaps).toBe(32);
  });

  it('fails a finished recipe missing a piece or a door frame, and fails an opaque piece with a hole', () => {
    const pieces = allPieces();
    delete pieces.corner_ne;
    pieces.door_e_opening = { src: 'art/clean/tiles-test/door_e_opening', frames: [0, 1, 2] };
    expect(failure(() => build(root, recipe({ pieces })))).toEqual([
      'tiles-test: corner_ne is missing (a finished tile sheet carries every piece and door frame)',
      'tiles-test: door_e_opening has 3 frames; the contract says 6',
    ]);
    const r = fixtureRoot();
    const holed = piece('top_n');
    setPixel(holed, 5, 7, null);
    writeImg(r, 'art/clean/tiles-test/top_n.png', holed);
    expect(failure(() => build(r, recipe()))).toEqual([
      'tiles-test: top_n has 1 transparent pixels, the first at (5, 7); floor, face, top and door pieces are fully opaque',
    ]);
  });

  it('builds a draft from any subset: the report lists what is missing, rooms.png boxes it', () => {
    const pieces = Object.fromEntries(
      Object.entries(allPieces()).filter(([k]) => k.startsWith('floor_') || k === 'top_n' || k === 'door_n_opening'),
    );
    (pieces.door_n_opening as { frames: number[] }).frames = [0, 1];
    const d = build(root, recipe({ draft: true, pieces }));
    expect([...d.outputs.keys()].sort()).toEqual([
      'art/review/tiles-test/contact.png',
      'art/review/tiles-test/report.json',
      'art/review/tiles-test/report.md',
      'art/review/tiles-test/rooms.png',
    ]);
    expect(d.report.missing).toContain('shade_n');
    expect(d.report.missing).toContain('door_n_closed');
    expect(d.report.missing).toContain('door_n_opening: 2 of 6 frames');
    expect(d.report.missing).not.toContain('top_n');
    const shell = d.report.rooms.find((r) => r.name === 'Shell Gallery');
    expect(shell?.missing).toContain('shade_n');
    expect(shell?.missing).toContain('door_n_closed_0');
    expect(shell?.missing).not.toContain('top_n');
    const md = d.outputs.get('art/review/tiles-test/report.md')?.toString() ?? '';
    expect(md).toContain('# tiles-test (draft)');
    expect(md).toContain('door_n_opening: 2 of 6 frames');
    // The Shell Gallery's closed north door: a hollow-deep box with the pink cross through its corners.
    const png = decodePng(d.outputs.get('art/review/tiles-test/rooms.png') ?? Buffer.alloc(0));
    const x0 = ROOM_GAP + 15 * 32;
    const y0 = ROOM_GAP;
    expect(hexAt(png, x0, y0)).toBe(POINT_MARK);
    expect(hexAt(png, x0 + 63, y0)).toBe(POINT_MARK);
    expect(hexAt(png, x0 + 32, y0 + 16)).toBe(POINT_MARK);
    expect(hexAt(png, x0 + 10, y0 + 20)).toBe(C['hollow-deep']);
    // A built piece draws as itself: the bottom wall's top_n.
    expect(hexAt(png, ROOM_GAP + 5 * 32 + 1, ROOM_GAP + 18 * 32 + 1)).toBe(C['sleeper-ochre']);
  });

  it('runs remap on pieces, scoped by piece name', () => {
    const r = fixtureRoot();
    const grey = blank(32, 32);
    fillRect(grey, 0, 0, 32, 32, '#d0d0d0');
    writeImg(r, 'art/clean/tiles-test/floor_3.png', grey);
    const built = build(r, recipe({ remap: [{ from: ['#d0d0d0'], to: 'wheel-eye', anims: ['floor_3'] }] }));
    const f3 = built.tiles.find((t) => t.name === 'floor_3');
    expect(f3 && hexAt(f3.img, 4, 4)).toBe(C['wheel-eye']);
    expect(built.report.remap[0]?.pixels).toEqual({ floor_3: 1024 });
    expect(opaqueAt(f3?.img ?? blank(1, 1), 31, 31)).toBe(true);
  });
});

describe('the tiles recipe guard', () => {
  const problems = (json: unknown): readonly string[] =>
    failure(() => parseRecipe(json, 'art/sheets/tiles-test.json', root));

  it('accepts pieces in place of anims, a static piece without frames', () => {
    const r = parseRecipe(recipe(), 'art/sheets/tiles-test.json', root);
    expect(r.kind).toBe('tiles');
    expect(r.tiles?.pieces.floor_0).toEqual({ src: 'art/clean/tiles-test/floor_0.png', frames: [0] });
    expect(r.tiles?.floorWeights).toEqual([6, 3, 2, 1]);
    expect(r.tiles?.faceMidWeights).toBeUndefined();
    expect(r.tiles?.topMidWeights).toBeUndefined();
    expect(r.anims).toEqual({});
    const rare = parseRecipe(recipe({ faceMidWeights: [3, 1], topMidWeights: [1, 2] }), 'art/sheets/tiles-test.json', root);
    expect([rare.tiles?.faceMidWeights, rare.tiles?.topMidWeights]).toEqual([[3, 1], [1, 2]]);
    expect(problems({ ...recipe(), faceMidWeights: [1, 1, 1] })).toEqual([
      'art/sheets/tiles-test.json: faceMidWeights must be two positive integers (the weights of face_mid_0 and face_mid_1)',
    ]);
  });

  it('names every problem', () => {
    expect(
      problems(
        recipe({
          outline: 'player',
          floorWeights: [6, 3, 0, 1],
          faceMidWeights: [3],
          topMidWeights: [3, 0],
          anims: {},
          pieces: {
            floor_9: { src: 'art/clean/tiles-test/floor_0.png' },
            floor_0: { src: 'art/clean/tiles-test/floor_0.png', frames: [0, 0] },
            floor_1: { src: 'art/clean/tiles-test/floor_1.png', downscale: 2 },
            door_n_open: { src: 'art/clean/tiles-test/door_n_open' },
            door_w_opening: { src: 'art/clean/tiles-test/door_w_opening', frames: [0, 1, 2, 3, 4, 5, 0] },
            shade_n: { src: 'art/clean/tiles-test/shade_n.png', despeckle: 'yes' },
          },
        }),
      ),
    ).toEqual([
      'art/sheets/tiles-test.json: anims is not a recipe field',
      'art/sheets/tiles-test.json: outline is "player" but only Kindled sheets use the player outline',
      'art/sheets/tiles-test.json: floorWeights must be four positive integers (the weights of floor_0 … floor_3)',
      'art/sheets/tiles-test.json: faceMidWeights must be two positive integers (the weights of face_mid_0 and face_mid_1)',
      'art/sheets/tiles-test.json: topMidWeights must be two positive integers (the weights of top_mid_0 and top_mid_1)',
      `art/sheets/tiles-test.json: pieces.floor_9 is not a tile piece (${TILE_RECIPE_PIECES.map((p) => p.name).join(', ')})`,
      'art/sheets/tiles-test.json: pieces.floor_0.frames lists 2 frames; floor_0 is one frame',
      'art/sheets/tiles-test.json: pieces.floor_1.downscale is not a piece field',
      'art/sheets/tiles-test.json: pieces.door_n_open.frames must list the 1 source frames of door_n_open, in order',
      'art/sheets/tiles-test.json: pieces.door_w_opening.frames lists 7 frames; door_w_opening has 6',
      'art/sheets/tiles-test.json: pieces.shade_n.despeckle must be true or false',
    ]);
  });

  it('ties the kind to the tiles- prefix both ways, and needs pieces', () => {
    expect(problems({ ...recipe(), kind: 'prop' })).toEqual([
      'art/sheets/tiles-test.json: kind is prop but the name "tiles-test" makes it tiles',
    ]);
    expect(
      failure(() => parseRecipe({ ...recipe(), sheet: 'prop-test' }, 'art/sheets/prop-test.json', root)),
    ).toEqual(['art/sheets/prop-test.json: kind is tiles but the name "prop-test" makes it prop']);
    expect(problems({ ...recipe(), pieces: {} })).toEqual([
      'art/sheets/tiles-test.json: pieces must be an object with at least one piece',
    ]);
  });

  it('checks fixes and remap against the frames the pieces build', () => {
    expect(
      problems(
        recipe({
          fixes: [{ frame: 'door_n_opening_6', pixels: [[0, 0, null]] }],
          remap: [{ from: ['#d0d0d0'], to: 'wheel-eye', facings: ['S'] }],
        }),
      ),
    ).toEqual([
      'art/sheets/tiles-test.json: fixes[0].frame names "door_n_opening_6", which is not a frame this recipe builds',
      'art/sheets/tiles-test.json: remap[0].facings is only for kinds with facings (kindled, npc)',
    ]);
  });
});
