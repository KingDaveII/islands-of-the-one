import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CORNER_PIECES,
  DOOR_PIECES,
  FACE_PIECES,
  FLOOR_PIECES,
  isFloorWeights,
  isMidWeights,
  MID_WEIGHTS_DEFAULT,
  pickWeighted,
  roomTemplates,
  roomTiles,
  spriteSheetSpec,
  STATIC_TILE_PIECES,
  TILE_DOOR_ANIMS,
  TILE_FRAMES,
  tileAt,
  tileDoors,
  tileHash,
  TOP_PIECES,
  type TileSheet,
  type TileTemplate,
  type TileWeights,
} from '../src/index.js';
import fixtureJson from './fixtures/tiles-fixture.json' with { type: 'json' };
import { decodePng } from './png.js';
import { tileSheetProblems } from './tileChecks.js';

/**
 * The tile rule (packages/shared/src/tiles.ts, sprites.md "Tiles"): each
 * piece and overlay, the n-w-e naming, the hash and the weights, cells
 * outside the room and doors as solid; every door of rooms.json placeable;
 * and the sheet checks of §6 on the fixture and broken copies of it.
 */

const W: TileWeights = { floorWeights: [6, 3, 2, 1] };
const room = (tiles: string[], name = 'test'): TileTemplate => ({ name, tiles });
const at = (t: TileTemplate, c: number, r: number) => tileAt(t, c, r, W);
const base = (t: TileTemplate, c: number, r: number) => at(t, c, r).base;

describe('tileAt', () => {
  // 0123456
  const t = room([
    '#######', // 0
    '#.....#', // 1
    '#.o...#', // 2
    '#.....#', // 3
    '#..oo.#', // 4
    '#..oo.#', // 5
    '#.....#', // 6
    '#######', // 7
  ]);

  it('draws open cells as floor, whatever the legend (., P, S, C)', () => {
    const marks = room(['#####', '#.PS#', '#.C.#', '#####']);
    for (const [c, r] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [2, 2],
      [3, 2],
    ] as const)
      expect(FLOOR_PIECES as readonly string[], `${c},${r}`).toContain(base(marks, c, r));
  });

  it('names a wall face by its open sides among n, w, e, in that order', () => {
    // A lone pillar: S, N, W and E open.
    expect(base(t, 2, 2)).toBe('face_nwe');
    // The 2×2 pillar's lower row: faces open to the W or E; its upper row: tops open N and W or E.
    expect(base(t, 3, 5)).toBe('face_w');
    expect(base(t, 4, 5)).toBe('face_e');
    expect(base(t, 3, 4)).toBe('top_nw');
    expect(base(t, 4, 4)).toBe('top_ne');
    // Under the north wall: a face with nothing open but S, one of the two plain variants.
    expect(['face_mid_0', 'face_mid_1']).toContain(base(t, 3, 0));
    // The side walls: tops open to the room; the south wall: tops open N.
    expect(base(t, 0, 3)).toBe('top_e');
    expect(base(t, 6, 3)).toBe('top_w');
    expect(base(t, 3, 7)).toBe('top_n');
  });

  it('builds every face and top name in n-w-e order', () => {
    const faces = new Set<string>();
    const tops = new Set<string>();
    // Every 3×3 neighbourhood of a solid centre over a 4th row: all 2^8 rings.
    for (let m = 0; m < 512; m++) {
      const bit = (i: number): string => ((m >> i) & 1 ? '#' : '.');
      const g = room([`${bit(0)}${bit(1)}${bit(2)}`, `${bit(3)}#${bit(4)}`, `${bit(5)}${bit(6)}${bit(7)}`, '...'].map((r) => `.${r}.`).concat(['.....']));
      const b = base(g, 2, 1);
      if (b?.startsWith('face')) faces.add(b);
      if (b?.startsWith('top')) tops.add(b);
    }
    const sided = (pieces: readonly string[]) => pieces.filter((p) => !p.includes('_mid_'));
    expect([...faces].filter((p) => !p.includes('_mid_')).sort()).toEqual(sided(FACE_PIECES).sort());
    expect([...tops].filter((p) => !p.includes('_mid_')).sort()).toEqual(sided(TOP_PIECES).sort());
    // The plain variants by the hash: a long wall shows both, face and top.
    const long = room(['#'.repeat(40), '#'.repeat(40), '.'.repeat(40)]);
    const row = (r: number) => new Set(Array.from({ length: 38 }, (_, c) => base(long, c + 1, r)));
    expect([...row(1)].sort()).toEqual(['face_mid_0', 'face_mid_1']);
    expect([...row(0)].sort()).toEqual(['top_mid_0', 'top_mid_1']);
  });

  it('stacks shade_n, shade_w and shade_e on a floor where that neighbour is solid, in that order; no south shade', () => {
    expect(at(t, 1, 1).overlays).toEqual(['shade_n', 'shade_w']);
    expect(at(t, 5, 1).overlays).toEqual(['shade_n', 'shade_e']);
    expect(at(t, 1, 6).overlays).toEqual(['shade_w']);
    // Above the pillar: its top is S of the cell, and there is no south shade.
    expect(at(t, 2, 1).overlays).toEqual(['shade_n']);
    expect(at(t, 3, 6).overlays).toEqual(['shade_n']);
    const narrow = room(['#####', '#.#.#', '#####']);
    expect(at(narrow, 1, 1).overlays).toEqual(['shade_n', 'shade_w', 'shade_e']);
  });

  it('adds shade_nw (shade_ne) where NW (NE) is solid and N and W (E) are open', () => {
    // SE of the lone pillar and SW of it.
    expect(at(t, 3, 3).overlays).toEqual(['shade_nw']);
    expect(at(t, 1, 3).overlays).toEqual(['shade_w', 'shade_ne']);
    // Diagonal to the 2×2 pillar's lower corners.
    expect(at(t, 5, 6).overlays).toEqual(['shade_e', 'shade_nw']);
    expect(at(t, 2, 6).overlays).toEqual(['shade_ne']);
    // With N solid there is no diagonal shade.
    expect(at(t, 2, 3).overlays).toEqual(['shade_n']);
  });

  it('puts corner_nw (corner_ne) on a top whose N and W (E) are solid and NW (NE) open', () => {
    // The south wall's two inner corners.
    expect(at(t, 6, 7)).toEqual({ base: 'top_mid_1', overlays: ['corner_nw'], door: null });
    expect(at(t, 0, 7).overlays).toEqual(['corner_ne']);
    // Both at once, on a wall closing a notch.
    const notch = room(['.#.', '###', '###']);
    expect(at(notch, 1, 1).overlays).toEqual(['corner_nw', 'corner_ne']);
    expect(at(notch, 1, 1).base?.startsWith('top_mid_')).toBe(true);
    // A face never carries a corner.
    const faceNotch = room(['#.#', '###', '...']);
    expect(at(faceNotch, 1, 1)).toEqual({ base: 'face_n', overlays: [], door: null });
  });

  it('reads every cell outside the room as solid', () => {
    const tiny = room(['..', '..']);
    expect(at(tiny, 0, 0).overlays).toEqual(['shade_n', 'shade_w']);
    expect(at(tiny, 1, 1).overlays).toEqual(['shade_e']);
    // Rows shorter than the longest are wall past their end, as in the sim.
    const ragged = room(['....', '..']);
    expect(at(ragged, 1, 1).overlays).toEqual(['shade_e']);
    // Past the short row's end: a wall under an open cell, its S outside the room, so a top open N.
    expect(base(ragged, 3, 1)).toBe('top_n');
    // A cell outside the room draws nothing.
    expect(at(tiny, -1, 0)).toEqual({ base: null, overlays: [], door: null });
    expect(at(tiny, 2, 0)).toEqual({ base: null, overlays: [], door: null });
  });

  it('reads doors as solid for their neighbours, and gives a door cell its door', () => {
    const d = room(['##DD##', '#....#', '#....#', 'D....#', 'D....D', '#....D', '######']);
    expect(at(d, 2, 1).overlays).toEqual(['shade_n']);
    expect(at(d, 1, 3).overlays).toEqual(['shade_w']);
    expect(at(d, 4, 4).overlays).toEqual(['shade_e']);
    // The wall beside a door: S open, a face; the wall above a side door: S is the door, a top.
    expect(base(d, 1, 0)).toMatch(/^face_mid_[01]$/);
    expect(base(d, 0, 2)).toBe('top_e');
    expect(at(d, 2, 0)).toEqual({ base: null, overlays: [], door: { piece: 'door_n', col: 2, row: 0, cols: 2, rows: 1 } });
    expect(at(d, 3, 0).door).toEqual({ piece: 'door_n', col: 2, row: 0, cols: 2, rows: 1 });
    expect(at(d, 0, 4).door).toEqual({ piece: 'door_w', col: 0, row: 3, cols: 1, rows: 2 });
    expect(at(d, 5, 5).door).toEqual({ piece: 'door_e', col: 5, row: 4, cols: 1, rows: 2 });
  });

  it('picks floors and plain walls by a stable integer hash of (template, col, row)', () => {
    // Golden values: a change here moves every room's look and every screenshot.
    expect([tileHash('Shell Gallery', 3, 5), tileHash('Shell Gallery', 3, 5, 1), tileHash('Spill', 3, 5)]).toEqual([
      3812049218, 473720187, 746964472,
    ]);
    // The same template draws the same floors every time; another name draws others.
    const a = room(['.'.repeat(20), '.'.repeat(20)], 'one');
    const b = room(['.'.repeat(20), '.'.repeat(20)], 'two');
    const floors = (x: TileTemplate) => Array.from({ length: 20 }, (_, c) => base(x, c, 1));
    expect(floors(a)).toEqual(floors(a));
    expect(floors(a)).not.toEqual(floors(b));
  });

  it('weights the floors by floorWeights', () => {
    expect(pickWeighted(0, [6, 3, 2, 1])).toBe(0);
    expect(pickWeighted(5, [6, 3, 2, 1])).toBe(0);
    expect(pickWeighted(6, [6, 3, 2, 1])).toBe(1);
    expect(pickWeighted(9, [6, 3, 2, 1])).toBe(2);
    expect(pickWeighted(11, [6, 3, 2, 1])).toBe(3);
    expect(pickWeighted(12, [6, 3, 2, 1])).toBe(0);
    const big = room(Array.from({ length: 60 }, () => '.'.repeat(60)), 'weights');
    const counts = [0, 0, 0, 0];
    for (let r = 0; r < 60; r++) {
      for (let c = 0; c < 60; c++) {
        const i = Number(base(big, c, r)?.slice(-1));
        counts[i] = (counts[i] ?? 0) + 1;
      }
    }
    // 3600 cells at 6:3:2:1: within 15 % of each share.
    [6, 3, 2, 1].forEach((w, i) => { expect(Math.abs((counts[i] ?? 0) - (3600 * w) / 12), `floor_${i}`).toBeLessThan((3600 * w) / 12 * 0.15); });
    // Weights 1:1:1:1 give all four; a weight's own share moves only its piece.
    const even = new Set<string>();
    for (let c = 0; c < 60; c++) even.add(String(tileAt(big, c, 3, { floorWeights: [1, 1, 1, 1] }).base));
    expect([...even].sort()).toEqual([...FLOOR_PIECES]);
  });

  it('weights the plain faces and tops by faceMidWeights and topMidWeights, evenly without them', () => {
    // A long north wall over floor: every cell a plain face; a thick south mass: plain tops.
    const wall = room(['#'.repeat(80), ...Array.from({ length: 3 }, () => '#'.repeat(80)), '.'.repeat(80), '.'.repeat(80)], 'mids');
    const faces = (w: TileWeights) => Array.from({ length: 80 }, (_, c) => String(tileAt(wall, c, 3, w).base));
    const tops = (w: TileWeights) => Array.from({ length: 80 }, (_, c) => String(tileAt(wall, c, 1, w).base));
    for (const f of faces(W)) expect(f).toMatch(/^face_mid_[01]$/);
    for (const t of tops(W)) expect(t).toMatch(/^top_mid_[01]$/);
    // Absent means [1, 1]: the pick the hash's lowest bit made before the weights (G1.5e), so no room moves.
    expect(faces(W)).toEqual(faces({ ...W, faceMidWeights: [1, 1] }));
    expect(tops(W)).toEqual(tops({ ...W, topMidWeights: [1, 1] }));
    expect(faces(W)).toEqual(Array.from({ length: 80 }, (_, c) => `face_mid_${tileHash('mids', c, 3, 1) & 1}`));
    expect(tops(W)).toEqual(Array.from({ length: 80 }, (_, c) => `top_mid_${tileHash('mids', c, 1, 2) & 1}`));
    expect(MID_WEIGHTS_DEFAULT).toEqual([1, 1]);
    // ART's 3:1: the spare variant about a quarter of the time, each pick through its own weights.
    const rare = { ...W, faceMidWeights: [3, 1], topMidWeights: [3, 1] };
    const count = (xs: string[]) => xs.filter((x) => x.endsWith('_1')).length;
    expect(count(faces(rare))).toBeGreaterThan(8);
    expect(count(faces(rare))).toBeLessThan(32);
    expect(count(tops(rare))).toBeGreaterThan(8);
    expect(count(tops(rare))).toBeLessThan(32);
    expect(count(faces({ ...W, faceMidWeights: [1, 0] }))).toBe(0);
    expect(count(tops({ ...W, faceMidWeights: [1, 0] }))).toBe(count(tops(W)));
    expect(faces({ ...W, topMidWeights: [1, 0] })).toEqual(faces(W));
  });
});

describe('doors (tileDoors)', () => {
  it('places every D pair of rooms.json', () => {
    for (const t of roomTemplates) {
      const { doors, problems } = tileDoors(t);
      expect(problems, t.name).toEqual([]);
      const cells = t.tiles.join('').split('').filter((ch) => ch === 'D').length;
      expect(doors.length * 2, t.name).toBe(cells);
    }
  });

  it('fails a D the rule cannot place, naming the template', () => {
    const cases: [string[], RegExp][] = [
      [['#####', '#...#', '##DD#'], /a south door/],
      [['##D##', '#...#', '#####'], /are not a pair/],
      [['#DDD#', '#...#', '#####'], /are not a pair/],
      [['#####', '#.DD#', '#####'], /not in the north, west or east border wall/],
      [['####', '#..#', '#DD#', '#..#', '####'], /not in the north, west or east border wall/],
      [['#D###', '#D..#', '#...#', '#####'], /not in the north, west or east border wall/],
    ];
    for (const [tiles, re] of cases) {
      const { problems } = tileDoors(room(tiles, 'New Template'));
      expect(problems.length, tiles.join('/')).toBe(1);
      expect(problems[0], tiles.join('/')).toMatch(/^New Template: the D cells at /);
      expect(problems[0], tiles.join('/')).toMatch(re);
    }
    // A vertical pair in the west wall is a door.
    expect(tileDoors(room(['#####', 'D...#', 'D...#', '#####'])).problems).toEqual([]);
  });

  it('draws every template of rooms.json from the pieces of tiles.ts', () => {
    const names = new Set(STATIC_TILE_PIECES.map((p) => p.name));
    for (const t of roomTemplates) {
      const { draws, doors, problems } = roomTiles(t, W);
      expect(problems).toEqual([]);
      for (const d of draws) expect(names.has(d.piece), `${t.name} ${d.piece}`).toBe(true);
      for (const d of doors) expect(DOOR_PIECES.map((p) => p.name)).toContain(d.piece);
    }
  });
});

describe('the tile contract', () => {
  it('makes tiles- a sheet kind with the door animations as its table', () => {
    const spec = spriteSheetSpec('tiles-cave');
    expect(spec.kind).toBe('tiles');
    expect(spec.anims).toBe(TILE_DOOR_ANIMS);
    expect(spec.facings).toBe(false);
    expect(spec.palette).toBe(false);
  });

  it('lists 29 static pieces at 32×32 and three doors with closed, opening (6 frames, 12 fps) and open', () => {
    expect(STATIC_TILE_PIECES.length).toBe(29);
    for (const p of STATIC_TILE_PIECES) expect([p.w, p.h], p.name).toEqual([32, 32]);
    expect(CORNER_PIECES).toEqual(['corner_nw', 'corner_ne']);
    expect(Object.fromEntries(DOOR_PIECES.map((d) => [d.name, [d.w, d.h]]))).toEqual({
      door_n: [64, 32],
      door_w: [32, 64],
      door_e: [32, 64],
    });
    expect(TILE_DOOR_ANIMS.map((a) => `${a.name} ${a.frames} ${a.fps}`)).toEqual(
      ['door_n', 'door_w', 'door_e'].flatMap((d) => [`${d}_closed 1 0`, `${d}_opening 6 12`, `${d}_open 1 0`]),
    );
    expect(TILE_FRAMES.length).toBe(29 + 3 * 8);
  });

  it('checks floorWeights: four positive integers', () => {
    expect(isFloorWeights([6, 3, 2, 1])).toBe(true);
    for (const bad of [[6, 3, 2], [6, 3, 2, 1, 1], [6, 3, 0, 1], [6, 3, -2, 1], [6, 3, 2.5, 1], ['6', 3, 2, 1], null])
      expect(isFloorWeights(bad), JSON.stringify(bad)).toBe(false);
  });

  it('checks faceMidWeights and topMidWeights: two positive integers', () => {
    expect(isMidWeights([3, 1])).toBe(true);
    expect(isMidWeights([1, 1])).toBe(true);
    for (const bad of [[3], [3, 1, 1], [3, 0], [-3, 1], [1.5, 1], ['3', 1], null, 3])
      expect(isMidWeights(bad), JSON.stringify(bad)).toBe(false);
  });
});

const FIXTURE_PNG = decodePng(readFileSync(new URL('./fixtures/tiles-fixture.png', import.meta.url)));
const fixture: TileSheet = fixtureJson;
const clone = (): TileSheet => JSON.parse(JSON.stringify(fixture)) as TileSheet;
const pngClone = () => ({ ...FIXTURE_PNG, rgba: FIXTURE_PNG.rgba.slice() });
const setPx = (png: { width: number; rgba: Uint8Array }, x: number, y: number, rgba: [number, number, number, number]) => { png.rgba.set(rgba, (y * png.width + x) * 4); };
const frameAt = (name: string) => {
  const f = fixture.frames[name];
  if (!f) throw new Error(`the fixture has no ${name}`);
  return f.frame;
};

describe('the tile sheet checks (§6) on test/fixtures/tiles-fixture', () => {
  it('pass the fixture', () => {
    expect(tileSheetProblems('tiles-fixture', fixture, FIXTURE_PNG)).toEqual([]);
  });

  it('fail a missing piece and a missing door frame', () => {
    const s = clone();
    delete s.frames.top_nwe;
    delete s.frames.door_e_opening_5;
    expect(tileSheetProblems('tiles-fixture', s, FIXTURE_PNG)).toEqual(
      expect.arrayContaining(['top_nwe is missing', 'door_e_opening_5 is missing']),
    );
  });

  it('fail a piece of the wrong size', () => {
    const s = clone();
    const f = s.frames.door_n_closed_0;
    if (f) f.frame.w = 32;
    expect(tileSheetProblems('tiles-fixture', s, FIXTURE_PNG)).toEqual(['door_n_closed_0 is 32×32, not 64×32']);
  });

  it('fail a door animation with the wrong frames or rate', () => {
    const s = clone();
    const a = s.anims.door_w_opening;
    if (a) {
      a.frames = a.frames.slice(0, 5);
      a.frameRate = 8;
    }
    const problems = tileSheetProblems('tiles-fixture', s, FIXTURE_PNG);
    expect(problems.some((p) => p.startsWith('anims.door_w_opening has frames'))).toBe(true);
    expect(problems).toContain('anims.door_w_opening runs at 8 fps, not 12');
  });

  it('fail a hole in a piece that must be opaque, but not in a shade', () => {
    const png = pngClone();
    const floor = frameAt('floor_2');
    setPx(png, floor.x + 5, floor.y + 5, [0, 0, 0, 0]);
    expect(tileSheetProblems('tiles-fixture', fixture, png)).toEqual([
      'transparent pixels in pieces that must be opaque: floor_2',
    ]);
    const door = frameAt('door_w_open_0');
    const png2 = pngClone();
    setPx(png2, door.x + 31, door.y + 63, [0, 0, 0, 0]);
    expect(tileSheetProblems('tiles-fixture', fixture, png2)).toEqual([
      'transparent pixels in pieces that must be opaque: door_w_open_0',
    ]);
    // The fixture's shades are mostly transparent, and pass.
    expect(tileSheetProblems('tiles-fixture', fixture, FIXTURE_PNG)).toEqual([]);
  });

  it('fail a telegraph colour, a reserved colour and an off-whitelist colour', () => {
    const f = frameAt('face_n');
    const cases: [[number, number, number, number], string][] = [
      [[0xe0, 0x45, 0x7b, 255], 'telegraph colours in a tile sheet: face_n'],
      [[0xff, 0xff, 0xff, 255], 'colours never allowed in a sheet: #ffffff'],
      [[0xff, 0xe7, 0xa3, 255], 'colours never allowed in a sheet: #ffe7a3'],
      [[0x12, 0x34, 0x56, 255], 'colours outside the whitelist: #123456'],
      [[0x5b, 0x54, 0x78, 128], 'semi-transparent pixels: face_n'],
    ];
    for (const [rgba, message] of cases) {
      const png = pngClone();
      setPx(png, f.x + 10, f.y + 20, rgba);
      expect(tileSheetProblems('tiles-fixture', fixture, png), message).toEqual([message]);
    }
  });

  it('fail bad floorWeights and a wrong tile size', () => {
    for (const w of [[6, 3, 2], [6, 0, 2, 1], [6, 3, 2, 1.5]]) {
      const s = clone();
      s.tiles.floorWeights = w;
      expect(tileSheetProblems('tiles-fixture', s, FIXTURE_PNG)).toEqual([
        `tiles.floorWeights is ${JSON.stringify(w)}, not four positive integers`,
      ]);
    }
    const s = clone();
    s.tiles.tileSize = 16;
    expect(tileSheetProblems('tiles-fixture', s, FIXTURE_PNG)).toEqual(['tiles.tileSize is 16, not 32']);
  });

  it('take faceMidWeights and topMidWeights when present, two positive integers each', () => {
    const s = clone();
    s.tiles.faceMidWeights = [3, 1];
    s.tiles.topMidWeights = [1, 1];
    expect(tileSheetProblems('tiles-fixture', s, FIXTURE_PNG)).toEqual([]);
    expect(fixture.tiles.faceMidWeights).toBeUndefined();
    for (const w of [[3], [3, 0], [3, 1, 1], [1.5, 1]]) {
      const bad = clone();
      bad.tiles.faceMidWeights = w;
      bad.tiles.topMidWeights = w;
      expect(tileSheetProblems('tiles-fixture', bad, FIXTURE_PNG)).toEqual([
        `tiles.faceMidWeights is ${JSON.stringify(w)}, not two positive integers`,
        `tiles.topMidWeights is ${JSON.stringify(w)}, not two positive integers`,
      ]);
    }
  });

  it('fail an unknown frame and overlapping frames', () => {
    const s = clone();
    const f = frameAt('floor_0');
    s.frames.floor_4 = { ...(fixture.frames.floor_0 ?? s.frames.floor_1), frame: { ...f } } as TileSheet['frames'][string];
    const problems = tileSheetProblems('tiles-fixture', s, FIXTURE_PNG);
    expect(problems).toContain('floor_4 is not a tile piece or door frame');
    expect(problems).toContain('floor_0 and floor_4 overlap');
  });
});
