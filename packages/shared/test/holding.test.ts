import { describe, expect, it } from 'vitest';
import {
  type LayoutStation,
  HOLDING_HEARTBEAT_MS,
  HOLDING_LAYOUT_ID,
  HOLDING_SOLID,
  holdingData,
  holdingLayout,
  holdingLayoutProblems,
  holdingRoomTiles,
  holdingStart,
  holdingTemplate,
  isHoldingResponse,
  isHoldingStationId,
  isHoldingStationRequest,
  OFFLINE_CAP_MS,
  PLOT_SIZE,
  STATION_TILE,
  STATIONS,
  stationDef,
  tileAt,
  validateHoldingData,
  validateStationsData,
  type HoldingLayout,
  type HoldingResponse,
} from '../src/index.js';

/**
 * The holding's data (docs/design/holding.md): the stations table, the
 * layout validator (station tiles solid and reachable, plots clear of the
 * stations and each other, the start on ground), the shipped layout, and the
 * API guards.
 */
const stations = STATIONS;

const good: HoldingLayout = {
  id: 'test',
  tiles: [
    '##########',
    '#........#',
    '#.TT..W..#',
    '#.TT.....#',
    '#....P.RR#',
    '#......RR#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##########',
  ],
  stations: [
    { id: 'writ-post', kind: 'post', rect: { col: 6, row: 2, cols: 1, rows: 1 }, interact: { col: 6, row: 3 } },
    { id: 'twisted-trees', kind: 'trees', rect: { col: 2, row: 2, cols: 2, rows: 2 }, interact: { col: 4, row: 3 } },
    { id: 'stone-outcrop', kind: 'outcrop', rect: { col: 7, row: 4, cols: 2, rows: 2 }, interact: { col: 6, row: 5 } },
  ],
  plots: [{ col: 1, row: 6, cols: 6, rows: 6 }],
};
const withTiles = (tiles: string[]): HoldingLayout => ({ ...good, tiles });
const [POST, TREES, OUTCROP] = good.stations as [LayoutStation, LayoutStation, LayoutStation];

describe('stations.json', () => {
  it('holds the three M2 stations with GAME DESIGN\'s numbers', () => {
    expect(STATIONS.map((s) => [s.id, s.kind, s.name])).toEqual([
      ['writ-post', 'post', 'Writ post'],
      ['twisted-trees', 'trees', 'Twisted trees'],
      ['stone-outcrop', 'outcrop', 'Stone outcrop'],
    ]);
    expect(stationDef('writ-post')?.action).toBeNull();
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
    expect(problems({ stations: [{ ...trees, kind: 'mill' }] })).toEqual(['stations[0] (trees): kind must be one of post, trees, outcrop']);
    expect(problems({ stations: [{ ...trees, action: { ...trees.action, xp: 5 } }] })).toEqual([
      'stations[0] (trees): action.xp is 5; the curve gives the cycle\'s seconds, 4',
    ]);
    expect(problems({ stations: [{ ...trees, action: { ...trees.action, itemId: 'oak-log' } }] })).toEqual([
      'stations[0] (trees): action.itemId must be an item of items.json',
    ]);
    expect(problems({ stations: [{ id: 'post', kind: 'post', name: 'Post', action: trees.action }] })).toEqual([
      'stations[0] (post): the post has no action',
    ]);
    expect(problems({ stations: [{ id: 'quarry', kind: 'outcrop', name: 'Quarry' }] })).toEqual([
      'stations[0] (quarry): a outcrop needs an action',
    ]);
    expect(problems({ stations: [trees, trees] })).toEqual(['stations[1] (trees): duplicate id']);
    expect(problems({})).toEqual(['expected { stations: [...] }']);
  });
});

describe('the layout validator', () => {
  it('passes a layout whose stations are solid letters beside reachable ground, plots clear, one start', () => {
    expect(holdingLayoutProblems(good, stations)).toEqual([]);
  });

  it('reports a station tile that is not its letter, a stray letter, and a station not in stations.json', () => {
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r, i) => (i === 3 ? '#.T......#' : r))), stations)).toEqual([
      'test: station twisted-trees: tile (3, 3) is ".", not T',
    ]);
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r, i) => (i === 7 ? '#.......R#' : r))), stations)).toEqual([
      'test: tile (8, 7) is "R" but belongs to no station',
    ]);
    expect(
      holdingLayoutProblems({ ...good, stations: [...good.stations, { ...TREES, id: 'twisted-oaks' }] }, stations),
    ).toEqual(['test: station twisted-oaks is not in stations.json']);
    expect(holdingLayoutProblems({ ...good, stations: [{ ...TREES, kind: 'outcrop' }] }, stations)).toEqual(
      expect.arrayContaining(['test: station twisted-trees is a outcrop here but a trees in stations.json']),
    );
  });

  it('reports an interact point that is not ground, not beside the station, or not reachable', () => {
    const moved = (interact: { col: number; row: number }): HoldingLayout => ({
      ...good,
      stations: good.stations.map((s) => (s.id === 'twisted-trees' ? { ...s, interact } : s)),
    });
    expect(holdingLayoutProblems(moved({ col: 2, row: 2 }), stations)).toEqual([
      'test: station twisted-trees: its interact point (2, 2) is not ground',
    ]);
    expect(holdingLayoutProblems(moved({ col: 5, row: 3 }), stations)).toEqual([
      'test: station twisted-trees: its interact point (5, 3) is not beside it',
    ]);
    // A pocket of ground walled off from the start.
    const walled = withTiles([
      '##########',
      '#.#......#',
      '#.#TT.W..#',
      '#.#TT....#',
      '#.#..P.RR#',
      '#.#....RR#',
      '#.#......#',
      '#.#......#',
      '#.#......#',
      '##########',
    ]);
    expect(
      holdingLayoutProblems(
        { ...walled, stations: walled.stations.map((s) => (s.id === 'twisted-trees' ? { ...s, rect: { col: 3, row: 2, cols: 2, rows: 2 }, interact: { col: 1, row: 2 } } : s)), plots: [] },
        stations,
      ),
    ).toEqual(['test: station twisted-trees: its interact point (1, 2) is not beside it']);
    const pocket = { ...walled, stations: walled.stations.map((s) => (s.id === 'twisted-trees' ? { ...s, rect: { col: 3, row: 2, cols: 2, rows: 2 }, interact: { col: 5, row: 3 } } : s)), plots: [] };
    const cut = withTiles(['##########', '#.T.#....#', '#.T.#.W..#', '#...#....#', '#####P.RR#', '#......RR#', '#........#', '#........#', '#........#', '##########']);
    expect(
      holdingLayoutProblems({ ...cut, stations: [POST, { ...TREES, rect: { col: 2, row: 1, cols: 1, rows: 2 }, interact: { col: 3, row: 2 } }, OUTCROP], plots: [] }, stations),
    ).toEqual(['test: station twisted-trees: its interact point (3, 2) can\'t be reached from the start']);
    expect(holdingLayoutProblems(pocket, stations)).toEqual([]);
  });

  it('reports plots that are not 6 × 6, off the ground, or overlapping a station or each other', () => {
    expect(PLOT_SIZE).toBe(6);
    expect(holdingLayoutProblems({ ...good, plots: [{ col: 1, row: 6, cols: 5, rows: 6 }] }, stations)).toEqual([
      'test: plot 0 is 5 × 6, not 6 × 6',
    ]);
    expect(holdingLayoutProblems({ ...good, plots: [{ col: 1, row: 1, cols: 6, rows: 6 }] }, stations)).toEqual(
      expect.arrayContaining(['test: plot 0: tile (2, 2) is "T", not ground', 'test: plot 0 overlaps station twisted-trees']),
    );
    expect(holdingLayoutProblems({ ...good, plots: [{ col: 1, row: 6, cols: 6, rows: 6 }, { col: 3, row: 6, cols: 6, rows: 6 }, { col: 7, row: 7, cols: 6, rows: 6 }] }, stations)).toEqual(
      expect.arrayContaining(['test: plot 0 overlaps plot 1', 'test: plot 2 is outside the layout']),
    );
  });

  it('reports a missing or doubled start, a start on a station, a ragged row and a stray character', () => {
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r) => r.replace('P', '.'))), stations)).toEqual([
      'test: 0 start tiles (P); there must be one',
      ...good.stations.map((s) => `test: station ${s.id}: its interact point (${s.interact.col}, ${s.interact.row}) can't be reached from the start`),
    ]);
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r, i) => (i === 1 ? '#P.......#' : r))), stations)).toEqual([
      'test: 2 start tiles (P); there must be one',
    ]);
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r, i) => (i === 7 ? '#.......#' : r))), stations)).toEqual([
      'test: row 7 is 9 wide, not 10',
    ]);
    expect(holdingLayoutProblems(withTiles(good.tiles.map((r, i) => (i === 7 ? '#.......C#' : r))), stations)).toEqual([
      'test: row 7 has "C", not in the legend',
    ]);
  });
});

describe('holding.json', () => {
  it('holds the 48 h cap, the 30 s heartbeat and one layout, first-holding, that keeps every rule', () => {
    expect(OFFLINE_CAP_MS).toBe(48 * 60 * 60 * 1000);
    expect(HOLDING_HEARTBEAT_MS).toBe(30_000);
    expect(HOLDING_LAYOUT_ID).toBe('first-holding');
    expect(holdingData.layouts.map((l) => l.id)).toEqual(['first-holding']);
    const layout = holdingLayout();
    expect(holdingLayoutProblems(layout, stations)).toEqual([]);
    expect(layout.tiles).toHaveLength(20);
    expect(layout.tiles[0]).toHaveLength(28);
    expect(layout.stations.map((s) => s.id)).toEqual(['writ-post', 'twisted-trees', 'stone-outcrop']);
    expect(layout.plots).toHaveLength(4);
    expect(holdingStart(layout)).toEqual({ col: 14, row: 11 });
    expect(() => holdingLayout('other')).toThrow('no holding layout other');
  });

  it('is validated on load', () => {
    const problems = (data: unknown): string[] => {
      const r = validateHoldingData(data, stations);
      return r.ok ? [] : r.problems;
    };
    const base = { offlineCapHours: 48, heartbeatMs: 30000, layouts: [good] };
    expect(problems(base)).toEqual([]);
    expect(problems({ ...base, offlineCapHours: 0 })).toEqual(['offlineCapHours must be a positive integer']);
    expect(problems({ ...base, layouts: [] })).toEqual(['layouts must be a non-empty list']);
    expect(problems({ ...base, layouts: [good, good] })).toEqual(['layouts[1]: duplicate id test']);
    expect(problems({ ...base, layouts: [{ ...good, stations: [{ id: 'writ-post', kind: 'post', rect: { col: 6, row: 2 }, interact: { col: 6, row: 3 } }] }] })).toEqual([
      'layouts[0] (test): stations[0].rect: must be { col, row, cols, rows } of whole numbers',
    ]);
    expect(problems({ ...base, extra: 1 })).toEqual(['unknown field(s) extra']);
  });

  it('draws as a room: station tiles are ground for the tile rule, pillars for the sim', () => {
    const layout = holdingLayout();
    const template = holdingTemplate(layout);
    expect(template.name).toBe('first-holding');
    // The trees' tiles draw as floor (the prop stands on it); the edge draws as a face along the top.
    expect(tileAt(template, 3, 9, { floorWeights: [1, 1, 1, 1] }).base).toMatch(/^floor_[0-3]$/);
    expect(tileAt(template, 5, 0, { floorWeights: [1, 1, 1, 1] }).base).toMatch(/^face_mid_[01]$/);
    const sim = holdingRoomTiles(layout);
    expect(sim[9]).toBe('#..oo.........o.........oo.#');
    expect(sim[11]).toBe(layout.tiles[11]);
    expect(HOLDING_SOLID).toBe('#WTR');
    expect(STATION_TILE).toEqual({ post: 'W', trees: 'T', outcrop: 'R' });
  });
});

describe('the holding API guards', () => {
  const response: HoldingResponse = {
    layoutId: 'first-holding',
    baskets: { 'writ-post': [], 'twisted-trees': [{ itemId: 'twisted-log', quantity: 3 }], 'stone-outcrop': [] },
    activity: { stationId: 'twisted-trees', startedAt: '2026-10-17T12:00:00.000Z', cycleMs: 4000 },
    now: '2026-10-17T12:00:13.000Z',
    skills: {
      woodcutting: { xp: 12, level: 1, into: 12, toNext: 28 },
      mining: { xp: 0, level: 1, into: 0, toNext: 40 },
      farming: { xp: 0, level: 1, into: 0, toNext: 40 },
    },
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
  });

  it('accept a station request of exactly { stationId }', () => {
    expect(isHoldingStationRequest({ stationId: 'twisted-trees' })).toBe(true);
    expect(isHoldingStationRequest({ stationId: 'anything' })).toBe(true);
    expect(isHoldingStationRequest({ stationId: 1 })).toBe(false);
    expect(isHoldingStationRequest({ stationId: 'twisted-trees', quantity: 1 })).toBe(false);
    expect(isHoldingStationRequest({})).toBe(false);
  });
});
