import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACTIONLESS_KINDS,
  HOLDING_DISTANCES,
  HOLDING_HEARTBEAT_MS,
  HOLDING_LAYOUT_ID,
  HOLDING_SOLID,
  holdingData,
  holdingLayout,
  holdingLayoutProblems,
  holdingRoomTiles,
  holdingStart,
  holdingTemplate,
  holdingTileSheet,
  isHoldingResponse,
  isHoldingStationId,
  isHoldingStationRequest,
  isKeshSliverRequest,
  OFFLINE_CAP_MS,
  PLOT_SIZE,
  rectGap,
  rectsTouch,
  roomTiles,
  STATION_PART_SHEETS,
  STATION_TILE,
  STATIONS,
  stationDef,
  stationParts,
  tileAt,
  validateHoldingData,
  validateStationsData,
  type HoldingLayout,
  type HoldingResponse,
  type LayoutStation,
  type TilePoint,
  type TileRect,
  pressedWrit,
  toWritView,
} from '../src/index.js';

/**
 * The holding's data (docs/design/holding.md): the stations table, the
 * layout validator (station tiles solid and reachable, the plots clear of
 * the stations and each other, GAME DESIGN's placement rules for the
 * starting holding, the shore rule's constraints), the shipped layout and a
 * snapshot of the pieces the shore rule draws it with, and the API guards.
 */
const stations = STATIONS;
const shipped = holdingLayout();

/** The shipped layout with its tiles changed by `edit` (a map of "col,row" to a character). */
function withCells(cells: Record<string, string>, layout: HoldingLayout = shipped): HoldingLayout {
  const tiles = layout.tiles.map((row, r) =>
    row
      .split('')
      .map((ch, c) => cells[`${c},${r}`] ?? ch)
      .join(''),
  );
  return { ...layout, tiles };
}
/** The shipped layout with one station replaced by `patch(station)`. */
function withStation(id: string, patch: (s: LayoutStation) => LayoutStation, layout: HoldingLayout = shipped): HoldingLayout {
  return { ...layout, stations: layout.stations.map((s) => (s.id === id ? patch(s) : s)) };
}
/** A station moved whole: its letter cleared from its old cells and written at the new rectangle, its interact point moved with it. */
function moved(id: string, rect: TileRect, interact: TilePoint, layout: HoldingLayout = shipped): HoldingLayout {
  const s = layout.stations.find((x) => x.id === id);
  if (!s) throw new Error(id);
  const letter = s.reserved ? '.' : (STATION_TILE[s.kind] ?? '.');
  const cells: Record<string, string> = {};
  for (const p of s.parts) for (let r = p.rect.row; r < p.rect.row + p.rect.rows; r++) for (let c = p.rect.col; c < p.rect.col + p.rect.cols; c++) cells[`${c},${r}`] = '.';
  for (let r = rect.row; r < rect.row + rect.rows; r++) for (let c = rect.col; c < rect.col + rect.cols; c++) cells[`${c},${r}`] = letter;
  return withStation(id, (x) => ({ ...x, parts: [{ rect, interact }] }), withCells(cells, layout));
}
const problems = (layout: HoldingLayout): string[] => holdingLayoutProblems(layout, stations);

describe('stations.json', () => {
  it("holds the five M2 stations with GAME DESIGN's numbers: the post, the store and the rack without an action", () => {
    expect(STATIONS.map((s) => [s.id, s.kind, s.name])).toEqual([
      ['writ-post', 'post', 'Writ post'],
      ['holding-store', 'store', 'Holding store'],
      ['weapon-rack', 'rack', 'Weapon rack'],
      ['twisted-trees', 'trees', 'Twisted trees'],
      ['stone-outcrop', 'outcrop', 'Stone outcrop'],
    ]);
    expect(stationDef('writ-post')?.action).toBeNull();
    expect(stationDef('holding-store')?.action).toBeNull();
    expect(stationDef('weapon-rack')?.action).toBeNull();
    expect(ACTIONLESS_KINDS).toEqual(['post', 'store', 'rack']);
    expect(stationDef('twisted-trees')?.action).toEqual({
      name: 'a dead branch',
      itemId: 'twisted-log',
      quantity: 1,
      cycleMs: 4000,
      skill: 'woodcutting',
      xp: 4,
    });
    expect(stationDef('stone-outcrop')?.action).toEqual({
      name: 'surface stone',
      itemId: 'black-stone',
      quantity: 1,
      cycleMs: 6000,
      skill: 'mining',
      xp: 6,
    });
    expect(isHoldingStationId('stone-outcrop')).toBe(true);
    expect(isHoldingStationId('holding-store')).toBe(true);
    expect(isHoldingStationId('field')).toBe(false);
  });

  it('is validated on load: ids, kinds, names, the action and its XP (the cycle in seconds)', () => {
    const problems = (data: unknown): string[] => {
      const r = validateStationsData(data);
      return r.ok ? [] : r.problems;
    };
    const trees = { id: 'trees', kind: 'trees', name: 'Trees', action: stationDef('twisted-trees')?.action };
    expect(problems({ stations: [trees] })).toEqual([]);
    expect(problems({ stations: [{ ...trees, id: 'Trees' }] })).toEqual(['stations[0]: id must be kebab-case (it names the basket)']);
    expect(problems({ stations: [{ ...trees, kind: 'mill' }] })).toEqual(['stations[0] (trees): kind must be one of post, trees, outcrop, store, rack']);
    expect(problems({ stations: [{ ...trees, action: { ...trees.action, xp: 5 } }] })).toEqual([
      'stations[0] (trees): action.xp is 5; the curve gives the cycle\'s seconds, 4',
    ]);
    expect(problems({ stations: [{ ...trees, action: { ...trees.action, itemId: 'oak-log' } }] })).toEqual([
      'stations[0] (trees): action.itemId must be an item of items.json',
    ]);
    expect(problems({ stations: [{ id: 'post', kind: 'post', name: 'Post', action: trees.action }] })).toEqual([
      'stations[0] (post): the post has no action',
    ]);
    expect(problems({ stations: [{ id: 'store', kind: 'store', name: 'Store', action: trees.action }] })).toEqual([
      'stations[0] (store): the store has no action',
    ]);
    expect(problems({ stations: [{ id: 'quarry', kind: 'outcrop', name: 'Quarry' }] })).toEqual([
      'stations[0] (quarry): a outcrop needs an action',
    ]);
    expect(problems({ stations: [trees, trees] })).toEqual(['stations[1] (trees): duplicate id']);
    expect(problems({})).toEqual(['expected { stations: [...] }']);
  });
});

describe('the layout validator', () => {
  it("passes the shipped layout: GAME DESIGN's starting holding keeps every rule", () => {
    expect(problems(shipped)).toEqual([]);
  });

  it('measures rectangles by the tiles between their nearest cells, and touching as a gap of one', () => {
    const a = { col: 0, row: 0, cols: 2, rows: 2 };
    expect(rectGap(a, { col: 2, row: 0, cols: 1, rows: 1 })).toBe(1);
    expect(rectGap(a, { col: 3, row: 5, cols: 1, rows: 1 })).toBe(4);
    expect(rectGap(a, { col: 1, row: 1, cols: 3, rows: 3 })).toBe(0);
    expect(rectsTouch(a, { col: 2, row: 2, cols: 1, rows: 1 })).toBe(true);
    expect(rectsTouch(a, { col: 3, row: 0, cols: 1, rows: 1 })).toBe(false);
  });

  it('reports a station tile that is not its letter, a stray letter, a station not in stations.json, and a reserved spot that is not ground', () => {
    expect(problems(withCells({ '4,3': '.' }))).toEqual(['first-holding: station twisted-trees part 0: tile (4, 3) is ".", not T']);
    expect(problems(withCells({ '20,3': 'R' }))).toEqual(['first-holding: tile (20, 3) is "R" but belongs to no station']);
    expect(problems({ ...shipped, stations: [...shipped.stations, { id: 'twisted-oaks', kind: 'trees', parts: [] }] })).toEqual([
      'first-holding: station twisted-oaks is not in stations.json',
      'first-holding: station twisted-oaks has no parts',
    ]);
    expect(problems(withStation('stone-outcrop', (s) => ({ ...s, kind: 'trees' })))).toEqual(
      expect.arrayContaining(['first-holding: station stone-outcrop is a trees here but a outcrop in stations.json']),
    );
    expect(problems(withCells({ '17,13': 'S' }))).toEqual([
      'first-holding: station weapon-rack: tile (17, 13) is "S", not ground (a reserved spot)',
    ]);
    expect(problems(withStation('twisted-trees', (s) => ({ ...s, reserved: true })))).toEqual(
      expect.arrayContaining(['first-holding: station twisted-trees is reserved, but has an action in stations.json']),
    );
    // A kind with no letter stands only on a reserved spot.
    expect(problems(withStation('weapon-rack', ({ id, kind, parts }) => ({ id, kind, parts })))).toEqual([
      'first-holding: station weapon-rack: a rack has no tile letter, so it can only stand on a reserved spot',
    ]);
  });

  it('reports an interact point that is not ground, not beside the station, or not reachable, and overlapping parts', () => {
    const tree = (interact: TilePoint, layout = shipped): HoldingLayout =>
      withStation('twisted-trees', (s) => ({ ...s, parts: s.parts.map((p, i) => (i === 0 ? { ...p, interact } : p)) }), layout);
    expect(problems(tree({ col: 4, row: 2 }))).toEqual(['first-holding: station twisted-trees part 0: its interact point (4, 2) is not ground']);
    expect(problems(tree({ col: 7, row: 3 }))).toEqual(['first-holding: station twisted-trees part 0: its interact point (7, 3) is not beside it']);
    // The tree's interact point walled into a pocket.
    expect(problems(withCells({ '6,2': '#', '6,4': '#', '7,3': '#' }))).toEqual([
      "first-holding: station twisted-trees part 0: its interact point (6, 3) can't be reached from the start",
    ]);
    expect(problems(withStation('twisted-trees', (s) => ({ ...s, parts: [...s.parts, s.parts[0] ?? { rect: { col: 0, row: 0, cols: 1, rows: 1 }, interact: { col: 0, row: 0 } }] })))).toEqual(
      expect.arrayContaining(['first-holding: station twisted-trees part 0 overlaps its part 6']),
    );
    expect(problems(moved('stone-outcrop', { col: 16, row: 13, cols: 2, rows: 2 }, { col: 15, row: 14 }))).toEqual(
      expect.arrayContaining(['first-holding: station stone-outcrop overlaps station weapon-rack', 'first-holding: station weapon-rack overlaps station stone-outcrop']),
    );
  });

  it('reports plots that are not 6 × 6, off the ground, overlapping a station, or touching each other, the post or the store', () => {
    expect(PLOT_SIZE).toBe(6);
    const plots = (...list: TileRect[]): HoldingLayout => ({ ...shipped, plots: list });
    expect(problems(plots({ col: 7, row: 7, cols: 5, rows: 6 }))).toEqual(['first-holding: plot 0 is 5 × 6, not 6 × 6']);
    expect(problems(plots({ col: 3, row: 5, cols: 6, rows: 6 }))).toEqual(
      expect.arrayContaining(['first-holding: plot 0: tile (4, 6) is "T", not ground', 'first-holding: plot 0 overlaps station twisted-trees']),
    );
    expect(problems(plots({ col: 7, row: 7, cols: 6, rows: 6 }, { col: 13, row: 7, cols: 6, rows: 6 }))).toEqual(
      expect.arrayContaining(['first-holding: plot 0 touches plot 1', 'first-holding: plot 1 touches the Writ post']),
    );
    expect(problems(plots({ col: 7, row: 7, cols: 6, rows: 6 }, { col: 9, row: 7, cols: 6, rows: 6 }))).toEqual(
      expect.arrayContaining(['first-holding: plot 0 overlaps plot 1']),
    );
    expect(problems(plots({ col: 7, row: 8, cols: 6, rows: 6 }))).toEqual(['first-holding: plot 0 touches the store']);
    expect(problems(plots({ col: 40, row: 7, cols: 6, rows: 6 }))).toEqual(['first-holding: plot 0 is outside the layout']);
  });

  it("checks GAME DESIGN's placement: the post at the centre, the store and rack within 3, the trees west and the outcrop east within 10", () => {
    expect(HOLDING_DISTANCES).toEqual({ NEAR_POST: 3, FAR_POST: 10, CENTRE_SLACK: 2, ROCK_OFF_SHORE: 1, ROCK_NEAR_SHORE: 6, TALK_REACH: 4 });
    expect(problems(moved('holding-store', { col: 8, row: 14, cols: 2, rows: 1 }, { col: 7, row: 14 }))).toEqual([
      'first-holding: station holding-store is 5 tiles from the post; at most 3',
    ]);
    expect(problems(moved('weapon-rack', { col: 19, row: 13, cols: 2, rows: 1 }, { col: 18, row: 13 }))).toEqual([
      'first-holding: station weapon-rack is 5 tiles from the post; at most 3',
    ]);
    expect(problems(moved('stone-outcrop', { col: 26, row: 13, cols: 2, rows: 2 }, { col: 25, row: 14 }))).toEqual([
      'first-holding: station stone-outcrop is 12 tiles from the post; at most 10',
    ]);
    expect(problems(moved('stone-outcrop', { col: 10, row: 10, cols: 2, rows: 2 }, { col: 9, row: 10 }))).toEqual(
      expect.arrayContaining(['first-holding: station stone-outcrop is not east of the post']),
    );
    const farTree = withStation('twisted-trees', (s) => ({ ...s, parts: s.parts.map((p, i) => (i === 0 ? { rect: { col: 2, row: 5, cols: 2, rows: 2 }, interact: { col: 4, row: 5 } } : p)) }));
    expect(problems(withCells({ '4,2': '.', '5,2': '.', '4,3': '.', '5,3': '.', '2,5': 'T', '3,5': 'T', '2,6': 'T', '3,6': 'T' }, farTree))).toEqual([
      'first-holding: station twisted-trees part 0 is 11 tiles from the post; at most 10',
    ]);
    expect(problems(moved('twisted-trees', { col: 16, row: 10, cols: 2, rows: 2 }, { col: 15, row: 10 }))).toEqual(
      expect.arrayContaining(['first-holding: station twisted-trees is not west of the post']),
    );
    expect(problems(moved('writ-post', { col: 14, row: 9, cols: 1, rows: 1 }, { col: 14, row: 10 }))).toEqual(
      expect.arrayContaining(["first-holding: the Writ post at (14, 9) is not at the island's centre (14.5, 11.5), within 2 tiles"]),
    );
    expect(problems({ ...shipped, stations: shipped.stations.filter((s) => s.kind !== 'post') })).toEqual(
      expect.arrayContaining(['first-holding: 0 Writ posts; there must be one']),
    );
  });

  it("checks the landing (ground on the south shore), Kesh's rock (void off the south-east shore, the Talk spot beside it) and free ground north", () => {
    expect(problems({ ...shipped, landing: { col: 14, row: 21 } })).toEqual([
      'first-holding: the landing (14, 21) is not on the shore (the cell south of it is not void)',
    ]);
    expect(problems({ ...shipped, landing: { col: 14, row: 23 } })).toEqual(['first-holding: the landing (14, 23) is not ground']);
    expect(problems({ ...shipped, landing: { col: 3, row: 2 } })).toEqual([
      'first-holding: the landing (3, 2) is not on the shore (the cell south of it is not void)',
      'first-holding: the landing (3, 2) is not on the south shore (north of the post)',
    ]);
    const kesh = (rock: TileRect, talk: TilePoint = shipped.kesh.talk): HoldingLayout => ({ ...shipped, kesh: { rock, talk } });
    expect(problems(kesh({ col: 20, row: 20, cols: 2, rows: 2 }))).toEqual(
      expect.arrayContaining(['first-holding: Kesh\'s rock tile (20, 20) is ".", not void (#)']),
    );
    expect(problems(kesh({ col: 24, row: 19, cols: 2, rows: 2 }))).toEqual([
      "first-holding: Kesh's rock touches the island; it stands off the shore with at least 1 cell of void between",
    ]);
    expect(problems(kesh({ col: 26, row: 20, cols: 2, rows: 2 }, { col: 20, row: 15 }))).toEqual([
      "first-holding: the Talk spot (20, 15) is 6 tiles from Kesh's rock; at most 4",
    ]);
    expect(problems(kesh({ col: 26, row: 20, cols: 2, rows: 2 }, { col: 25, row: 20 }))).toEqual(['first-holding: the Talk spot (25, 20) is not ground']);
    expect(problems(kesh({ col: 1, row: 1, cols: 2, rows: 1 }, { col: 3, row: 2 }))).toEqual(
      expect.arrayContaining(["first-holding: Kesh's rock is not off the south-east shore (south and east of the post)"]),
    );
    expect(problems(kesh({ col: 40, row: 20, cols: 2, rows: 2 }))).toEqual(["first-holding: Kesh's rock is outside the layout"]);
    // The north filled with void (and the north-east down to the post's row): no plot's worth of ground north of the post.
    const cells: Record<string, string> = { '4,7': '.', '5,7': '.' };
    for (let r = 1; r <= 6; r++) for (let c = 1; c <= 28; c++) cells[`${c},${r}`] = '#';
    for (let r = 7; r <= 12; r++) for (let c = 23; c <= 28; c++) cells[`${c},${r}`] = '#';
    expect(problems(withCells(cells, { ...shipped, stations: shipped.stations.map((s) => (s.id === 'twisted-trees' ? { ...s, parts: s.parts.slice(2) } : s)) }))).toEqual(
      expect.arrayContaining(["first-holding: no free 6 × 6 of ground north of the post for later Writ lines' plots"]),
    );
  });

  it("checks the shore rule's constraints: a border of edge all round, and no one-cell notch", () => {
    expect(problems(withCells({ '0,5': '.' }))).toEqual(
      expect.arrayContaining(["first-holding: the border must be edge (#) all round, so the shore's drops fit the template; not at (0, 5)"]),
    );
    // A one-wide slot cut into the south shore: a notch at its foot, and another in the border row below it.
    expect(problems(withCells({ '15,21': '#', '15,22': '#' }))).toEqual([
      'first-holding: the void cell at (15, 22) is a one-cell notch (ground at NW and NE but not N); no shore piece draws it',
      'first-holding: the void cell at (15, 23) is a one-cell notch (ground at NW and NE but not N); no shore piece draws it',
    ]);
  });

  it('reports a missing or doubled start, a ragged row and a stray character', () => {
    expect(problems(withCells({ '14,15': '.' }))).toEqual(
      expect.arrayContaining(['first-holding: 0 start tiles (P); there must be one', "first-holding: station writ-post: its interact point (14, 14) can't be reached from the start"]),
    );
    expect(problems(withCells({ '14,17': 'P' }))).toEqual(['first-holding: 2 start tiles (P); there must be one']);
    expect(problems({ ...shipped, tiles: shipped.tiles.map((r, i) => (i === 7 ? r.slice(1) : r)) })).toEqual(
      expect.arrayContaining(['first-holding: row 7 is 29 wide, not 30']),
    );
    expect(problems(withCells({ '20,7': 'C' }))).toEqual(
      expect.arrayContaining(['first-holding: row 7 has "C", not in the legend', 'first-holding: plot 1: tile (20, 7) is "C", not ground']),
    );
  });
});

describe('holding.json', () => {
  it("holds the 48 h cap, the 30 s heartbeat and one layout, first-holding, GAME DESIGN's starting holding", () => {
    expect(OFFLINE_CAP_MS).toBe(48 * 60 * 60 * 1000);
    expect(HOLDING_HEARTBEAT_MS).toBe(30_000);
    expect(HOLDING_LAYOUT_ID).toBe('first-holding');
    expect(holdingData.layouts.map((l) => l.id)).toEqual(['first-holding']);
    expect(shipped.tiles).toHaveLength(24);
    expect(shipped.tiles[0]).toHaveLength(30);
    expect(shipped.stations.map((s) => [s.id, s.parts.length, s.reserved ?? false])).toEqual([
      ['writ-post', 1, false],
      ['holding-store', 1, false],
      ['weapon-rack', 1, true],
      ['twisted-trees', 6, false],
      ['stone-outcrop', 1, false],
    ]);
    expect(stationParts(shipped, 'writ-post')).toEqual([{ rect: { col: 14, row: 13, cols: 1, rows: 1 }, interact: { col: 14, row: 14 } }]);
    expect(stationParts(shipped, 'field')).toEqual([]);
    expect(shipped.plots).toHaveLength(4);
    expect(shipped.landing).toEqual({ col: 14, row: 22 });
    expect(shipped.kesh).toEqual({ rock: { col: 26, row: 20, cols: 2, rows: 2 }, talk: { col: 23, row: 19 } });
    expect(holdingStart(shipped)).toEqual({ col: 14, row: 15 });
    expect(() => holdingLayout('other')).toThrow('no holding layout other');
  });

  it('alternates the six trees between the two tree sheets (ART 2026-10-18), and refuses a part sheet its kind may not name', () => {
    const trees = stationParts(shipped, 'twisted-trees');
    expect(trees.map((p) => p.sheet ?? null)).toEqual([null, 'prop-twisted-tree-2', null, 'prop-twisted-tree-2', null, 'prop-twisted-tree-2']);
    expect(STATION_PART_SHEETS).toEqual({ trees: ['prop-twisted-tree-2'] });
    const r = validateHoldingData(
      {
        offlineCapHours: 48,
        heartbeatMs: 30000,
        cameraMarginTiles: 6,
        layouts: [
          {
            ...shipped,
            stations: shipped.stations.map((s) =>
              s.id === 'writ-post' ? { ...s, parts: s.parts.map((p) => ({ ...p, sheet: 'prop-twisted-tree-2' })) } : s,
            ),
          },
        ],
      },
      stations,
    );
    expect(r.ok ? [] : r.problems).toEqual([
      'layouts[0] (first-holding): stations[0].parts[0].sheet: "prop-twisted-tree-2" is not a sheet a post part may name (none)',
    ]);
  });

  it('is validated on load', () => {
    const problems = (data: unknown): string[] => {
      const r = validateHoldingData(data, stations);
      return r.ok ? [] : r.problems;
    };
    const base = { offlineCapHours: 48, heartbeatMs: 30000, cameraMarginTiles: 6, layouts: [shipped] };
    expect(problems(base)).toEqual([]);
    expect(problems({ ...base, offlineCapHours: 0 })).toEqual(['offlineCapHours must be a positive integer']);
    expect(problems({ ...base, cameraMarginTiles: 0 })).toEqual(['cameraMarginTiles must be a positive integer']);
    expect(problems({ ...base, layouts: [] })).toEqual(['layouts must be a non-empty list']);
    expect(problems({ ...base, layouts: [shipped, shipped] })).toEqual(['layouts[1]: duplicate id first-holding']);
    expect(
      problems({ ...base, layouts: [{ ...shipped, stations: [{ id: 'writ-post', kind: 'post', parts: [{ rect: { col: 6, row: 2 }, interact: { col: 6, row: 3 } }] }] }] }),
    ).toEqual(['layouts[0] (first-holding): stations[0].parts[0].rect: must be { col, row, cols, rows } of whole numbers']);
    expect(problems({ ...base, layouts: [{ ...shipped, stations: [{ id: 'writ-post', kind: 'post', rect: { col: 6, row: 2, cols: 1, rows: 1 }, interact: { col: 6, row: 3 } }] }] })).toEqual([
      'layouts[0] (first-holding): stations[0]: unknown field(s) rect, interact',
      'layouts[0] (first-holding): stations[0].parts: must be a non-empty list of { rect, interact }',
    ]);
    expect(problems({ ...base, layouts: [{ ...shipped, stations: shipped.stations.map((s) => (s.reserved ? { ...s, reserved: false } : s)) }] })).toEqual([
      'layouts[0] (first-holding): stations[2].reserved: must be true when present',
    ]);
    expect(problems({ ...base, layouts: [{ ...shipped, landing: { col: 14 } }] })).toEqual(['layouts[0] (first-holding): landing: must be { col, row }']);
    expect(problems({ ...base, layouts: [{ ...shipped, kesh: { rock: shipped.kesh.rock } }] })).toEqual(['layouts[0] (first-holding): kesh.talk: must be { col, row }']);
    expect(problems({ ...base, extra: 1 })).toEqual(['unknown field(s) extra']);
  });

  it('draws as an island with the shore rule: station tiles are ground for the tile rule, pillars for the sim, the rock void', () => {
    const template = holdingTemplate(shipped);
    expect(template.name).toBe('first-holding');
    const W = holdingTileSheet.tiles;
    expect(W.rule).toBe('shore');
    expect(W.doors).toBe(false);
    // A tree's tiles draw as floor (the prop stands on it); the south shore under the landing is a drop; the north edge a lip.
    expect(tileAt(template, 4, 2, W).base).toMatch(/^floor_[0-3]$/);
    expect(tileAt(template, 14, 23, W).base).toMatch(/^drop_mid_[01]$/);
    expect(tileAt(template, 14, 1, W).overlays).toEqual(['lip_n']);
    expect(tileAt(template, 26, 20, W)).toEqual({ base: null, overlays: [], door: null });
    const sim = holdingRoomTiles(shipped);
    expect(shipped.tiles[14]).toBe('#...TT....SS...........RR...##');
    expect(sim[14]).toBe('#...oo....oo...........oo...##');
    // The reserved rack's spot stays ground; a row without a letter is unchanged.
    expect(sim[13]).toBe('#.............o........oo....#');
    expect(sim[17]).toBe(shipped.tiles[17]);
    expect(HOLDING_SOLID).toBe('#WTRS');
    expect(STATION_TILE).toEqual({ post: 'W', trees: 'T', outcrop: 'R', store: 'S' });
  });

  it("matches the golden snapshot of every cell's pieces (test/golden/first-holding.tiles.txt), so a layout edit shows as a readable diff", () => {
    const template = holdingTemplate(shipped);
    const { draws, problems } = roomTiles(template, holdingTileSheet.tiles);
    expect(problems).toEqual([]);
    const cols = shipped.tiles[0]?.length ?? 0;
    const lines = shipped.tiles.map((_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const pieces = draws.filter((d) => d.col === c && d.row === r).map((d) => d.piece);
        return pieces.length ? pieces.join('+') : '-';
      }).join(' '),
    );
    const golden = readFileSync(new URL('./golden/first-holding.tiles.txt', import.meta.url), 'utf8');
    expect(`${lines.join('\n')}\n`).toBe(golden);
  });
});

describe('the holding API guards', () => {
  const response: HoldingResponse = {
    layoutId: 'first-holding',
    baskets: { 'writ-post': [], 'holding-store': [], 'weapon-rack': [], 'twisted-trees': [{ itemId: 'twisted-log', quantity: 3 }], 'stone-outcrop': [] },
    activity: { stationId: 'twisted-trees', startedAt: '2026-10-17T12:00:00.000Z', cycleMs: 4000 },
    now: '2026-10-17T12:00:13.000Z',
    skills: {
      woodcutting: { xp: 12, level: 1, into: 12, toNext: 28 },
      mining: { xp: 0, level: 1, into: 0, toNext: 40 },
      farming: { xp: 0, level: 1, into: 0, toNext: 40 },
    },
    writ: toWritView(pressedWrit(Date.parse('2026-10-17T12:00:00.000Z')), Date.parse('2026-10-17T12:00:13.000Z')),
    kesh: { firstGiven: false, due: 'first', nextTideAt: '2026-10-17T18:00:00.000Z' },
  };

  it('accept the holding answer, with or without a take, and refuse unknown fields, stations and skills', () => {
    expect(isHoldingResponse(response)).toBe(true);
    expect(isHoldingResponse({ ...response, activity: null })).toBe(true);
    expect(
      isHoldingResponse({ ...response, take: { stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 3 }], left: [] } }),
    ).toBe(true);
    expect(isHoldingResponse({ ...response, baskets: { field: [] } })).toBe(false);
    expect(isHoldingResponse({ ...response, skills: { ...response.skills, cooking: response.skills.mining } })).toBe(false);
    expect(isHoldingResponse({ ...response, activity: { ...response.activity, cycleMs: 0 } })).toBe(false);
    expect(isHoldingResponse({ ...response, now: 'soon' })).toBe(false);
    expect(isHoldingResponse({ ...response, extra: 1 })).toBe(false);
    // Kesh (4b): firstGiven a boolean, due one of first, tide or null, nextTideAt a time.
    expect(isHoldingResponse({ ...response, kesh: { ...response.kesh, due: null } })).toBe(true);
    expect(isHoldingResponse({ ...response, kesh: { ...response.kesh, due: 'tide' } })).toBe(true);
    expect(isHoldingResponse({ ...response, kesh: { ...response.kesh, due: 'second' } })).toBe(false);
    expect(isHoldingResponse({ ...response, kesh: { ...response.kesh, nextTideAt: 'tonight' } })).toBe(false);
    expect(isHoldingResponse({ ...response, kesh: { ...response.kesh, extra: 1 } })).toBe(false);
    expect(isKeshSliverRequest({})).toBe(true);
    expect(isKeshSliverRequest({ sliver: 1 })).toBe(false);
    expect(isKeshSliverRequest(null)).toBe(false);
    expect(isKeshSliverRequest([])).toBe(false);
  });

  it('accept a station request of exactly { stationId }', () => {
    expect(isHoldingStationRequest({ stationId: 'twisted-trees' })).toBe(true);
    expect(isHoldingStationRequest({ stationId: 'anything' })).toBe(true);
    expect(isHoldingStationRequest({ stationId: 1 })).toBe(false);
    expect(isHoldingStationRequest({ stationId: 'twisted-trees', quantity: 1 })).toBe(false);
    expect(isHoldingStationRequest({})).toBe(false);
  });
});
