import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAVE_STATIC_PIECES,
  CORNER_PIECES,
  DOOR_PIECES,
  DROP_PIECES,
  FACE_PIECES,
  FLOOR_PIECES,
  holdingTileSheet,
  isFloorWeights,
  isMidWeights,
  isTileRule,
  LIP_PIECES,
  MID_WEIGHTS_DEFAULT,
  pickWeighted,
  roomTemplates,
  roomTiles,
  SHORE_STATIC_PIECES,
  shoreProblems,
  spriteSheetSpec,
  STATIC_TILE_PIECES,
  TILE_DOOR_ANIMS,
  TILE_FRAMES,
  TILE_RECIPE_PIECES,
  TILE_RULES,
  TILE_SET_DEFAULT,
  tileAt,
  tileDoorAnimsFor,
  tileDoors,
  tileFramesFor,
  tileHash,
  tileRecipePiecesFor,
  tileRuleOf,
  tileSetOf,
  TOP_PIECES,
  type TileSheet,
  type TileTemplate,
  type TileWeights,
} from '../src/index.js';
import fixtureJson from './fixtures/tiles-fixture.json' with { type: 'json' };
import { decodePng } from './png.js';
import { tileSheetProblems } from './tileChecks.js';

/**
 * The tile rules (packages/shared/src/tiles.ts, sprites.md "Tiles"): the
 * cave's pieces and overlays, the n-w-e naming, the hash and the weights,
 * cells outside the room and doors as solid, every door of rooms.json
 * placeable; the shore rule's floors, lips, drops and corners, the notch it
 * refuses and stations drawn as ground; sets with and without doors; and the
 * sheet checks of §6 on the fixture, broken copies of it and the holding's
 * shore set.
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

const SHORE: TileWeights = { floorWeights: [6, 3, 2, 1], rule: 'shore' };
const shoreAt = (t: TileTemplate, c: number, r: number) => tileAt(t, c, r, SHORE);
const shoreBase = (t: TileTemplate, c: number, r: number) => shoreAt(t, c, r).base;

describe('tileAt with the shore rule (ART 2026-10-18)', () => {
  // 0123456
  const island = room([
    '#######', // 0
    '#.....#', // 1
    '#.....#', // 2
    '##....#', // 3
    '#..W..#', // 4
    '#.....#', // 5
    '#######', // 6
  ]);

  it('draws ground as a floor by the hash and floorWeights, with no shades, and stations as ground', () => {
    for (const [c, r] of [
      [1, 1],
      [3, 2],
      [2, 3],
    ] as const)
      expect(FLOOR_PIECES as readonly string[], `${c},${r}`).toContain(shoreBase(island, c, r));
    expect(shoreAt(island, 3, 2)).toEqual({ base: shoreBase(island, 3, 2), overlays: [], door: null });
    // The Writ post's W, a tree's T, the outcrop's R, the store's S, the start: ground for drawing.
    const marks = room(['#######', '#WTRSP#', '#.....#', '#######']);
    for (let c = 1; c <= 5; c++) {
      expect(FLOOR_PIECES as readonly string[], `col ${c}`).toContain(shoreBase(marks, c, 1));
      expect(shoreAt(marks, c, 1).overlays, `col ${c}`).toContain('lip_n');
    }
    // The pick is the cave's: the same floor as the cave rule gives the cell.
    expect(shoreBase(island, 3, 2)).toBe(base(island, 3, 2));
  });

  it('stacks lip_n, lip_w and lip_e where that neighbour is void, in that order; no south lip', () => {
    expect(shoreAt(island, 1, 1).overlays).toEqual(['lip_n', 'lip_w']);
    expect(shoreAt(island, 5, 1).overlays).toEqual(['lip_n', 'lip_e']);
    expect(shoreAt(island, 1, 5).overlays).toEqual(['lip_w']);
    expect(shoreAt(island, 3, 5).overlays).toEqual([]);
    expect(shoreAt(island, 3, 1).overlays).toEqual(['lip_n']);
    expect(shoreAt(island, 2, 3).overlays).toEqual(['lip_w']);
    const spit = room(['#####', '#.#.#', '#####']);
    expect(shoreAt(spit, 1, 1).overlays).toEqual(['lip_n', 'lip_w', 'lip_e']);
  });

  it('adds lip_nw (lip_ne) where NW (NE) is void and N and W (E) are ground, stacked after the sides', () => {
    // Under the bite at (1, 3): (2, 4) has void at NW, ground N and W.
    expect(shoreAt(island, 2, 4).overlays).toEqual(['lip_nw']);
    const notchE = room(['#####', '#..##', '#...#', '#####']);
    expect(shoreAt(notchE, 2, 2).overlays).toEqual(['lip_ne']);
    expect(shoreAt(notchE, 3, 2).overlays).toEqual(['lip_n', 'lip_e']);
    // Both at once, with the side lips first.
    const both = room(['#####', '##.##', '#...#', '#####']);
    expect(shoreAt(both, 2, 2).overlays).toEqual(['lip_nw', 'lip_ne']);
    expect(shoreAt(both, 1, 2).overlays).toEqual(['lip_n', 'lip_w']);
    expect(shoreAt(both, 2, 1).overlays).toEqual(['lip_n', 'lip_w', 'lip_e']);
  });

  it('draws the drop under the island: drop_mid by dropMidWeights between drops, drop_w / drop_e at the ends, drop_we alone', () => {
    // The south shore of the island: a drop under every ground cell of row 5.
    expect(shoreBase(island, 1, 6)).toBe('drop_w');
    expect(shoreBase(island, 5, 6)).toBe('drop_e');
    for (const c of [2, 3, 4]) expect(shoreBase(island, c, 6), `col ${c}`).toMatch(/^drop_mid_[01]$/);
    // Under the bite's ground (2, 2): the cell (1, 3) is void with ground north, its W outside the island (not a drop), its E ground.
    expect(shoreBase(island, 1, 3)).toBe('drop_we');
    // A one-cell island: a lone drop.
    const lone = room(['###', '#.#', '###']);
    expect(shoreAt(lone, 1, 1).overlays).toEqual(['lip_n', 'lip_w', 'lip_e']);
    expect(shoreBase(lone, 1, 2)).toBe('drop_we');
    // A two-cell island: the west end and the east end.
    const pair = room(['####', '#..#', '####']);
    expect([shoreBase(pair, 1, 2), shoreBase(pair, 2, 2)]).toEqual(['drop_w', 'drop_e']);
    // The plain drops by the hash: a long shore shows both, weighted by dropMidWeights (default even).
    const long = room(['#'.repeat(80), `#${'.'.repeat(78)}#`, '#'.repeat(80)], 'shore');
    const drops = (w: TileWeights) => Array.from({ length: 76 }, (_, c) => String(tileAt(long, c + 2, 2, w).base));
    expect([...new Set(drops(SHORE))].sort()).toEqual(['drop_mid_0', 'drop_mid_1']);
    expect(drops(SHORE)).toEqual(Array.from({ length: 76 }, (_, c) => `drop_mid_${tileHash('shore', c + 2, 2, 3) & 1}`));
    expect(drops(SHORE)).toEqual(drops({ ...SHORE, dropMidWeights: [1, 1] }));
    const rare = drops({ ...SHORE, dropMidWeights: [3, 1] }).filter((d) => d.endsWith('_1')).length;
    expect(rare).toBeGreaterThan(6);
    expect(rare).toBeLessThan(32);
    expect(drops({ ...SHORE, dropMidWeights: [1, 0] }).every((d) => d === 'drop_mid_0')).toBe(true);
  });

  it('turns the corners: drop_corner_w west of a run with ground at NE, drop_corner_e east of one with ground at NW, nothing elsewhere in the void', () => {
    // Off the island's SW and SE corners, beside the drops' ends.
    expect(shoreBase(island, 0, 6)).toBe('drop_corner_w');
    expect(shoreBase(island, 6, 6)).toBe('drop_corner_e');
    // West of the bite's one-cell drop (1, 3): the cell (0, 3) has ground at NE (1, 2) and the drop to its east.
    expect(shoreBase(island, 0, 3)).toBe('drop_corner_w');
    // Beside a straight west edge there is ground at NE but no run to turn round: nothing (not a column of corners).
    expect(shoreAt(island, 0, 2)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 0, 5)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 6, 2)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 0, 4)).toEqual({ base: null, overlays: [], door: null });
    // Empty void: the edge rows and columns away from any ground draw nothing.
    expect(shoreAt(island, 0, 0)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 3, 0)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 0, 1)).toEqual({ base: null, overlays: [], door: null });
    // Outside the template: nothing.
    expect(shoreAt(island, -1, 6)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreAt(island, 3, 7)).toEqual({ base: null, overlays: [], door: null });
  });

  it('draws nothing at a one-cell notch (ground at NW and NE but not N) and refuses it by name', () => {
    const notch = room(['#####', '#...#', '#.#.#', '#####'], 'Notched');
    // (2, 3): void, N (2, 2) void (the hole's drop), NW (1, 2) and NE (3, 2) ground: both corners at once.
    expect(shoreAt(notch, 2, 3)).toEqual({ base: null, overlays: [], door: null });
    expect(shoreProblems(notch)).toEqual([
      'Notched: the void cell at (2, 3) is a one-cell notch (ground at NW and NE but not N); no shore piece draws it',
    ]);
    expect(roomTiles(notch, { ...SHORE, doors: false }).problems).toEqual(shoreProblems(notch));
    expect(shoreProblems(island)).toEqual([]);
    // The hole (2, 2) is a drop_we under (2, 1), and its sides are lips.
    expect(shoreBase(notch, 2, 2)).toBe('drop_we');
    expect(shoreAt(notch, 1, 2).overlays).toEqual(['lip_w', 'lip_e']);
  });

  it('draws the whole island with roomTiles: floors under lips, drops and corners, nothing in the void, no doors', () => {
    const { draws, doors, problems } = roomTiles(island, { ...SHORE, doors: false });
    expect(problems).toEqual([]);
    expect(doors).toEqual([]);
    const names = new Set(SHORE_STATIC_PIECES.map((p) => p.name));
    for (const d of draws) expect(names.has(d.piece), d.piece).toBe(true);
    const at = (c: number, r: number) => draws.filter((d) => d.col === c && d.row === r).map((d) => d.piece);
    expect(at(1, 1)).toEqual([expect.stringMatching(/^floor_[0-3]$/), 'lip_n', 'lip_w']);
    expect(at(0, 6)).toEqual(['drop_corner_w']);
    expect(at(0, 0)).toEqual([]);
    expect(at(3, 4)).toEqual([expect.stringMatching(/^floor_[0-3]$/)]);
  });
});

describe('sets: rules and doors', () => {
  it('reads the rule and doors from a tiles block, cave with doors by default', () => {
    expect(TILE_RULES).toEqual(['cave', 'shore']);
    expect(TILE_SET_DEFAULT).toEqual({ rule: 'cave', doors: true });
    expect(tileSetOf(undefined)).toEqual({ rule: 'cave', doors: true });
    expect(tileSetOf({ rule: 'shore', doors: false })).toEqual({ rule: 'shore', doors: false });
    expect(tileSetOf({ rule: 'beach' })).toEqual({ rule: 'cave', doors: true });
    expect(isTileRule('shore')).toBe(true);
    expect(isTileRule('beach')).toBe(false);
    expect(tileRuleOf(W)).toBe('cave');
    expect(tileRuleOf(SHORE)).toBe('shore');
    expect(holdingTileSheet.tiles.rule).toBe('shore');
    expect(holdingTileSheet.tiles.doors).toBe(false);
    expect(holdingTileSheet.tiles.dropMidWeights).toEqual([3, 1]);
  });

  it("lists each rule's pieces: the cave's 29, the shore's 16 (floors, drops, lips), each with its opacity", () => {
    expect(CAVE_STATIC_PIECES).toBe(STATIC_TILE_PIECES);
    expect(SHORE_STATIC_PIECES.map((p) => p.name)).toEqual([...FLOOR_PIECES, ...DROP_PIECES, ...LIP_PIECES]);
    expect(DROP_PIECES).toEqual(['drop_mid_0', 'drop_mid_1', 'drop_w', 'drop_e', 'drop_we', 'drop_corner_w', 'drop_corner_e']);
    expect(LIP_PIECES).toEqual(['lip_n', 'lip_w', 'lip_e', 'lip_nw', 'lip_ne']);
    expect(SHORE_STATIC_PIECES.length).toBe(16);
    for (const p of SHORE_STATIC_PIECES) expect([p.w, p.h], p.name).toEqual([32, 32]);
    const opacity = Object.fromEntries(SHORE_STATIC_PIECES.map((p) => [p.name, p.opacity]));
    expect(opacity).toEqual({
      floor_0: 'full', floor_1: 'full', floor_2: 'full', floor_3: 'full',
      drop_mid_0: 'top', drop_mid_1: 'top', drop_w: 'top', drop_e: 'top', drop_we: 'top',
      drop_corner_w: 'none', drop_corner_e: 'none',
      lip_n: 'none', lip_w: 'none', lip_e: 'none', lip_nw: 'none', lip_ne: 'none',
    });
    expect(CAVE_STATIC_PIECES.filter((p) => p.opacity === 'full').map((p) => p.name)).toEqual([...FLOOR_PIECES, ...FACE_PIECES, ...TOP_PIECES]);
    expect(CAVE_STATIC_PIECES.every((p) => p.opaque === (p.opacity === 'full'))).toBe(true);
  });

  it('gives a set its frames and recipe pieces: door frames and animations only with doors', () => {
    expect(tileFramesFor(TILE_SET_DEFAULT)).toEqual(TILE_FRAMES);
    expect(tileRecipePiecesFor(TILE_SET_DEFAULT)).toEqual(TILE_RECIPE_PIECES);
    const shore = tileFramesFor({ rule: 'shore', doors: false });
    expect(shore.map((f) => f.name)).toEqual(SHORE_STATIC_PIECES.map((p) => p.name));
    expect(tileRecipePiecesFor({ rule: 'shore', doors: false }).map((p) => [p.name, p.frames])).toEqual(
      SHORE_STATIC_PIECES.map((p) => [p.name, 1]),
    );
    expect(tileDoorAnimsFor({ rule: 'shore', doors: false })).toEqual([]);
    expect(tileDoorAnimsFor({ rule: 'cave', doors: true })).toBe(TILE_DOOR_ANIMS);
    // A doorless cave set: the static pieces alone; a shore set with doors: its pieces and the doors.
    expect(tileFramesFor({ rule: 'cave', doors: false }).length).toBe(29);
    expect(tileFramesFor({ rule: 'shore', doors: true }).length).toBe(16 + 3 * 8);
  });

  it('refuses a D in a template drawn with a doorless set, naming the template, and places none', () => {
    const d = room(['##DD##', '#....#', '######'], 'Gate');
    expect(roomTiles(d, W).problems).toEqual([]);
    expect(roomTiles(d, W).doors.length).toBe(1);
    const doorless = roomTiles(d, { ...W, doors: false });
    expect(doorless.doors).toEqual([]);
    expect(doorless.problems).toEqual(['Gate: has D cells at (2, 0) (3, 0), but the tile set has no doors (doors: false)']);
    expect(roomTiles(room(['####', '#..#', '####'], 'Plain'), { ...W, doors: false }).problems).toEqual([]);
    // Every room of rooms.json needs doors: none draws with a doorless set.
    for (const t of roomTemplates) expect(roomTiles(t, { ...W, doors: false }).problems.length, t.name).toBe(1);
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

  it("check a set by its rule and doors: the shore's pieces, no door frames or animations, dropMidWeights, the top-row opacity", () => {
    // The fixture declared a shore set: every cave piece and door is foreign, every shore piece missing.
    const s = clone();
    s.tiles.rule = 'shore';
    s.tiles.doors = false;
    const problems = tileSheetProblems('tiles-fixture', s, FIXTURE_PNG);
    expect(problems).toEqual(
      expect.arrayContaining([
        'drop_mid_0 is missing',
        'lip_ne is missing',
        'shade_n is not a piece of the shore rule',
        'door_n_closed_0 is a door frame, but the set has no doors (tiles.doors false)',
        'anims.door_n_opening is a door animation, but the set has no doors (tiles.doors false)',
      ]),
    );
    expect(problems).not.toContain('floor_0 is missing');
    // The weights of the other rule.
    const w = clone();
    w.tiles.dropMidWeights = [3, 1];
    expect(tileSheetProblems('tiles-fixture', w, FIXTURE_PNG)).toEqual(["tiles.dropMidWeights is for the shore rule, and this set's rule is cave"]);
    w.tiles.dropMidWeights = [3];
    expect(tileSheetProblems('tiles-fixture', w, FIXTURE_PNG)).toEqual(['tiles.dropMidWeights is [3], not two positive integers']);
    const r = clone();
    r.tiles.rule = 'beach';
    expect(tileSheetProblems('tiles-fixture', r, FIXTURE_PNG)).toEqual(['tiles.rule is "beach", not one of cave, shore']);
    const d = clone();
    (d.tiles as { doors?: unknown }).doors = 'no';
    // A value that is not a boolean reads as the default (doors), so only the field is reported.
    expect(tileSheetProblems('tiles-fixture', d, FIXTURE_PNG)).toEqual(['tiles.doors is "no", not true or false']);
    // A cave set without doors: the door frames and animations are foreign.
    const c = clone();
    c.tiles.doors = false;
    expect(tileSheetProblems('tiles-fixture', c, FIXTURE_PNG)).toEqual(
      expect.arrayContaining(['door_w_open_0 is a door frame, but the set has no doors (tiles.doors false)', 'anims.door_e_closed is a door animation, but the set has no doors (tiles.doors false)']),
    );
    expect(tileSheetProblems('tiles-fixture', c, FIXTURE_PNG).filter((p) => p.includes('missing'))).toEqual([]);
    // The shipped shore set passes, and a hole in a drop's top row fails it while one lower down does not.
    const holding = holdingTileSheet;
    const png = decodePng(readFileSync(new URL('../assets/sprites/tiles-holding.png', import.meta.url)));
    expect(tileSheetProblems('tiles-holding', holding, png)).toEqual([]);
    expect(Object.keys(holding.anims)).toEqual([]);
    const drop = holding.frames.drop_w?.frame;
    if (!drop) throw new Error('no drop_w');
    const top = { ...png, rgba: png.rgba.slice() };
    setPx(top, drop.x + 5, drop.y, [0, 0, 0, 0]);
    expect(tileSheetProblems('tiles-holding', holding, top)).toEqual(['transparent pixels in the top row of pieces that must be opaque at the top: drop_w']);
    const low = { ...png, rgba: png.rgba.slice() };
    setPx(low, drop.x + 5, drop.y + 10, [0, 0, 0, 0]);
    expect(tileSheetProblems('tiles-holding', holding, low)).toEqual([]);
    const floor = holding.frames.floor_1?.frame;
    if (!floor) throw new Error('no floor_1');
    setPx(low, floor.x + 5, floor.y + 10, [0, 0, 0, 0]);
    expect(tileSheetProblems('tiles-holding', holding, low)).toEqual(['transparent pixels in pieces that must be opaque: floor_1']);
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
