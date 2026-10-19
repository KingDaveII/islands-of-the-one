import { describe, expect, it } from 'vitest';
import {
  BUILD_TEXT,
  buildTextLines,
  cycleLengthMs,
  cycleSpeedPermille,
  DRAWABLE_CHARS,
  holdingLayout,
  holdingRoomTiles,
  isAvailablePiece,
  isPieceId,
  isPlotPieceRequest,
  isPlotPieceView,
  isPlotTakeDownRequest,
  isPlotView,
  needsSkillLine,
  nextRotation,
  pieceDef,
  pieceLimit,
  pieceRect,
  PIECES,
  PIECES_PER_LINE,
  piecesData,
  piecesFor,
  placementProblems,
  plotLevel,
  pluralItemName,
  rotatedFootprint,
  signpostReachable,
  standingRect,
  standingTiles,
  validatePiecesData,
  type LayoutPlot,
  type StandingPiece,
} from '../src/index.js';
import piecesJson from '../data/pieces.json' with { type: 'json' };
import { BANNED } from './banned.js';

/**
 * Upgrade pieces (docs/design/holding.md "Build mode", M2 Task 6): the
 * data's validator and LORE's cards, the level and the speed from the pieces
 * standing, the limit per Writ line, and placement: every reason, each
 * rotation, a moved piece not blocking itself, and two pieces walling the
 * signpost off from every edge tile.
 */
const layout = holdingLayout();
const plot = layout.plots[0] as LayoutPlot;
// plot-1: cols 7..12, rows 7..12; the signpost at (9, 9), its interact tile (9, 10).
const PLOT_KINDS = ['field'];
const FIELD_CYCLE = { cycleMs: 900_000 };
const channel: StandingPiece = { pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 };
const jars: StandingPiece = { pieceId: 'seed-jars', col: 11, row: 12, rotation: 0 };

describe('pieces.json', () => {
  it("validates, with the field's three available and LORE's nine for the stations to come", () => {
    expect(validatePiecesData(piecesJson, PLOT_KINDS)).toEqual({ ok: true, data: piecesData });
    expect(PIECES_PER_LINE).toBe(2);
    expect(piecesFor('field').map((p) => p.id)).toEqual(['clay-channel', 'seed-jars', 'threshing-floor']);
    expect(PIECES.filter((p) => !p.available).map((p) => [p.stationKind, p.id])).toEqual([
      ['lumber-camp', 'chopping-block'],
      ['lumber-camp', 'drying-rack'],
      ['lumber-camp', 'saw-horse'],
      ['quarry', 'hoist'],
      ['quarry', 'sorting-sieve'],
      ['quarry', 'stone-sledge'],
      ['forge', 'anvil'],
      ['forge', 'quench-trough'],
      ['forge', 'pot-bellows'],
    ]);
    expect(piecesFor('lumber-camp')).toEqual([]);
    expect(isPieceId('clay-channel')).toBe(true);
    expect(isPieceId('workbench')).toBe(false);
    expect(isAvailablePiece(pieceDef('anvil'))).toBe(false);
    expect(isAvailablePiece(undefined)).toBe(false);
  });

  it("holds GAME DESIGN's costs, footprints and lines, and LORE's names and cards word for word", () => {
    expect(pieceDef('clay-channel')).toEqual({
      id: 'clay-channel',
      stationKind: 'field',
      name: 'Clay channel',
      card: 'Fired clay troughs laid between the furrows, the way the Kingdom waters its fields. Dew gathers in them overnight, from nowhere you can find.',
      available: true,
      cost: [
        { itemId: 'twisted-log', quantity: 300 },
        { itemId: 'black-stone', quantity: 150 },
      ],
      footprint: { cols: 1, rows: 4 },
      skill: null,
      writLine: 1,
      effect: { kind: 'cycle-speed', permille: 250 },
    });
    expect(pieceDef('seed-jars')).toMatchObject({
      name: 'Seed jars',
      card: 'Squat grey jars, waxed shut and pressed with your thumb. Seed kept dry keeps its name.',
      cost: [
        { itemId: 'twisted-log', quantity: 200 },
        { itemId: 'pale-grain', quantity: 40 },
      ],
      footprint: { cols: 2, rows: 1 },
      writLine: 1,
    });
    expect(pieceDef('threshing-floor')).toMatchObject({
      name: 'Threshing floor',
      card: 'A ring of flat stones beaten smooth, where grain is trodden out of the straw. The Scattered say the oldest temples stand on threshing floors, because that is where the wind came down to choose.',
      cost: [
        { itemId: 'black-stone', quantity: 400 },
        { itemId: 'twisted-log', quantity: 150 },
      ],
      footprint: { cols: 3, rows: 3 },
      writLine: 2,
    });
    expect(pieceDef('anvil')).toMatchObject({ available: false, cost: null, footprint: null, stationKind: 'forge' });
    // No field piece needs a skill level in M2.
    for (const p of PIECES) expect(p.skill, p.id).toBeNull();
  });

  it('every name, card and line of build mode uses only characters the fonts can draw, and no banned name', () => {
    const lines = [...PIECES.flatMap((p) => [p.name, p.card]), ...buildTextLines()];
    for (const line of lines) {
      const missing = Array.from(line).filter((ch) => !DRAWABLE_CHARS.has(ch));
      expect(missing, line).toEqual([]);
      expect(BANNED.test(line), line).toBe(false);
    }
    expect(BUILD_TEXT.HEADER('Field', 2)).toBe('Field, level 2');
    expect(BUILD_TEXT.PIECES_COUNT(1, 2)).toBe('Pieces 1/2');
    expect(BUILD_TEXT.MATERIAL('Twisted log', 340, 300)).toBe('Twisted log 340/300');
    expect(BUILD_TEXT.EFFECT_SPEED(25)).toBe('+25% work speed');
    expect(BUILD_TEXT.PIECES_NONE_YET).toBe('Pieces: none yet');
    expect(BUILD_TEXT.LIMIT).toBe('This plot can take no more pieces until your Writ has another line.');
    expect(BUILD_TEXT.STORE_FULL('twisted-log')).toBe('Store: twisted logs full.');
    expect(BUILD_TEXT.BLOCKED_BECAUSE('outside')).toBe("That doesn't fit there. It has to stand inside the plot's ring.");
    expect(BUILD_TEXT.BLOCKED_BECAUSE('blocks-signpost')).toBe("That doesn't fit there. It would block the way to the signpost.");
    expect([BUILD_TEXT.UNKNOWN_PIECE, BUILD_TEXT.ALREADY_BUILT, BUILD_TEXT.NOT_BUILT]).toEqual([
      "This station doesn't take that piece.",
      'One of those already stands in this plot.',
      "That piece isn't standing here.",
    ]);
    expect(needsSkillLine({ skill: 'farming', level: 5 })).toBe('Needs Farming 5');
    expect(pluralItemName('black-stone')).toBe('black stone');
  });

  it('lists every problem', () => {
    const good = pieceDef('clay-channel');
    const base = { piecesPerLine: 2, pieces: [good] };
    expect(validatePiecesData(null, PLOT_KINDS)).toEqual({ ok: false, problems: ['expected { piecesPerLine, pieces: [...] }'] });
    const bad = validatePiecesData(
      {
        ...base,
        extra: 1,
        piecesPerLine: 0,
        pieces: [
          { ...good, available: 'yes', stationKind: 'Field', name: '', card: 'A ✦ star', cost: [], footprint: { cols: 7, rows: 1 }, skill: { skill: 'cooking', level: 0 }, writLine: 0, effect: { kind: 'speed' }, more: 1 },
          { ...good, cost: [{ itemId: 'twisted-log', quantity: 1 }, { itemId: 'twisted-log', quantity: 2, more: 1 }, { itemId: 'gold', quantity: 0 }], footprint: { cols: 1 } },
          { ...good, id: 'anvil', available: false },
          { ...good, available: false, cost: undefined, footprint: undefined },
          { ...good, id: 'Clay Channel' },
          'clay-channel',
          { ...good, id: 'needs-skill', skill: undefined, stationKind: 'quarry' },
        ],
      },
      PLOT_KINDS,
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.problems).toEqual(
      expect.arrayContaining([
        'unknown field(s) extra',
        'piecesPerLine must be a positive integer',
        'pieces[0]: unknown field(s) more',
        'pieces[0] (clay-channel): available must be a boolean when present',
        'pieces[0] (clay-channel): stationKind must be kebab-case',
        'pieces[0] (clay-channel): name must be non-empty text',
        'pieces[0] (clay-channel): the fonts can\'t draw "✦" in card (don\'t change the text; flag it)',
        'pieces[0] (clay-channel): cost must be a non-empty list of { itemId, quantity }',
        'pieces[0] (clay-channel): footprint 7 x 1 doesn\'t fit a 6 x 6 plot',
        'pieces[0] (clay-channel): skill.skill must be a skill',
        'pieces[0] (clay-channel): skill.level must be a positive integer',
        'pieces[0] (clay-channel): writLine must be a positive integer',
        'pieces[0] (clay-channel): effect.kind must be one of cycle-speed',
        'pieces[1] (clay-channel): duplicate id',
        'pieces[1] (clay-channel).cost[1]: unknown field(s) more',
        'pieces[1] (clay-channel).cost[1]: twisted-log is listed twice',
        'pieces[1] (clay-channel).cost[2]: itemId must be an item of items.json',
        'pieces[1] (clay-channel).cost[2]: quantity must be a positive integer',
        'pieces[1] (clay-channel): footprint must be { cols, rows } of positive integers',
        'pieces[2] (anvil): an unavailable piece has no cost',
        'pieces[2] (anvil): an unavailable piece has no footprint',
        'pieces[4]: id must be kebab-case (it is stored)',
        'pieces[5]: not an object',
        'pieces[6] (needs-skill): skill must be { skill, level } or null',
        'pieces[6] (needs-skill): an available piece\'s stationKind must be a plot kind of stations.json (field)',
      ]),
    );
    // An unavailable piece of a station to come: no cost, no footprint, any kebab-case kind.
    const later = validatePiecesData({ piecesPerLine: 2, pieces: [{ ...good, id: 'x', available: false, cost: undefined, footprint: undefined, stationKind: 'forge' }] }, PLOT_KINDS);
    expect(later).toMatchObject({ ok: true, data: { pieces: [{ id: 'x', available: false, cost: null, footprint: null }] } });
  });
});

describe('the level and the speed', () => {
  it('is 1 plus the distinct pieces; the speed 1000 + 250 each; the field at 15, 12 and 10 min', () => {
    expect(plotLevel()).toBe(1);
    expect(plotLevel([channel])).toBe(2);
    expect(plotLevel([channel, jars])).toBe(3);
    const twice: StandingPiece = { ...channel, col: 8 };
    expect(plotLevel([channel, twice])).toBe(2);
    expect(cycleSpeedPermille()).toBe(1000);
    expect(cycleSpeedPermille([channel])).toBe(1250);
    expect(cycleSpeedPermille([channel, jars])).toBe(1500);
    expect(cycleSpeedPermille([{ pieceId: 'workbench' }])).toBe(1000);
    expect(cycleLengthMs(FIELD_CYCLE)).toBe(15 * 60_000);
    expect(cycleLengthMs(FIELD_CYCLE, [channel])).toBe(12 * 60_000);
    expect(cycleLengthMs(FIELD_CYCLE, [channel, jars])).toBe(10 * 60_000);
    // The rounding: a 7 s cycle at +25% is 5.6 s, rounded to 5600 ms exactly; at +50% 4667.
    expect(cycleLengthMs({ cycleMs: 7000 }, [channel, jars])).toBe(4667);
  });

  it('allows two pieces per Writ line', () => {
    expect(pieceLimit(1)).toBe(2);
    expect(pieceLimit(2)).toBe(4);
    expect(pieceLimit(0)).toBe(0);
    expect(pieceLimit(3, 1)).toBe(3);
  });
});

describe('footprints', () => {
  it('turn in 90-degree steps, 90 and 270 swapping cols and rows', () => {
    const fp = { cols: 1, rows: 4 };
    expect(rotatedFootprint(fp, 0)).toEqual({ cols: 1, rows: 4 });
    expect(rotatedFootprint(fp, 90)).toEqual({ cols: 4, rows: 1 });
    expect(rotatedFootprint(fp, 180)).toEqual({ cols: 1, rows: 4 });
    expect(rotatedFootprint(fp, 270)).toEqual({ cols: 4, rows: 1 });
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(270)).toBe(0);
    expect(pieceRect(fp, 7, 7, 90)).toEqual({ col: 7, row: 7, cols: 4, rows: 1 });
    expect(standingRect(channel)).toEqual({ col: 7, row: 7, cols: 1, rows: 4 });
    expect(standingRect({ ...channel, pieceId: 'anvil' })).toBeNull();
    expect(standingTiles([jars])).toEqual([
      { col: 11, row: 12 },
      { col: 12, row: 12 },
    ]);
    // The roam: the pieces' tiles are pillars beside the named signposts.
    const tiles = holdingRoomTiles(layout, ['plot-1'], standingTiles([jars]));
    expect(tiles[12]?.slice(11, 13)).toBe('oo');
    expect(tiles[9]?.[9]).toBe('o');
    expect(holdingRoomTiles(layout, ['plot-1'])[12]?.slice(11, 13)).toBe('..');
  });
});

describe('placement', () => {
  const problems = (candidate: StandingPiece, pieces: StandingPiece[] = []) => placementProblems(layout, plot, pieces, candidate);

  it('fits inside the plot, off the signpost and its interact tile, off other pieces, with a way in', () => {
    expect(problems(channel)).toEqual([]);
    expect(problems({ ...channel, col: 12, row: 9 })).toEqual([]);
    expect(problems(jars)).toEqual([]);
    expect(problems({ pieceId: 'threshing-floor', col: 10, row: 10, rotation: 0 })).toEqual([]);
  });

  it('outside: not wholly inside the 6 x 6, at any rotation', () => {
    expect(problems({ ...channel, col: 6 })).toEqual(['outside']);
    expect(problems({ ...channel, row: 10 })).toEqual(['outside']);
    expect(problems({ ...channel, col: 12, row: 9, rotation: 90 })).toEqual(['outside']);
    expect(problems({ ...channel, col: 9, row: 12, rotation: 90 })).toEqual([]);
    expect(problems({ ...channel, col: 10, row: 12, rotation: 90 })).toEqual(['outside']);
    expect(problems({ ...channel, col: 10, row: 12, rotation: 270 })).toEqual(['outside']);
    expect(problems({ ...channel, col: 7, row: 9, rotation: 180 })).toEqual([]);
    expect(problems({ ...channel, col: 0, row: 0 })).toEqual(['outside']);
  });

  it("on-signpost: over the signpost's tile or its interact tile", () => {
    expect(problems({ ...channel, col: 9, row: 7 })).toEqual(['on-signpost']);
    expect(problems({ ...jars, col: 8, row: 10 })).toEqual(['on-signpost']);
    expect(problems({ ...channel, col: 7, row: 9, rotation: 90 })).toEqual(['on-signpost']);
    expect(problems({ ...channel, col: 7, row: 10, rotation: 270 })).toEqual(['on-signpost']);
  });

  it('overlaps: over another piece of the plot; a piece being moved does not block itself', () => {
    expect(problems({ ...jars, col: 7, row: 8 }, [channel])).toEqual(['overlaps']);
    expect(problems({ ...jars, col: 8, row: 8 }, [channel])).toEqual([]);
    // The clay channel moved onto itself, or beside itself: free.
    expect(problems(channel, [channel])).toEqual([]);
    expect(problems({ ...channel, col: 8 }, [channel])).toEqual([]);
    expect(problems({ ...channel, col: 8 }, [channel, jars])).toEqual([]);
  });

  it('blocks-signpost: two pieces that together wall the signpost off from every edge tile', () => {
    // A threshing floor over rows 8..10 at cols 7..9 leaves the interact tile (9, 10)... covered: on-signpost. Place it at
    // cols 10..12, rows 8..10 instead: the way in from the west and south stays open.
    const floor: StandingPiece = { pieceId: 'threshing-floor', col: 10, row: 8, rotation: 0 };
    expect(problems(floor)).toEqual([]);
    // With the floor standing, a channel turned flat along row 11 from col 7 to col 10 leaves (11, 11) and (12, 11)... still a way
    // round through col 12 (rows 11, 12 free, up the east side? The floor covers 10..12 rows 8..10, so (12, 11) → (12, 12) only).
    // The interact tile (9, 10) is reached from (8, 10), (9, 11) or (10, 10): a channel across row 11 at cols 7..10 and the floor
    // leave (8, 10) reachable from (7, 10) ← (7, 9) ← ... the west edge. So wall it with a vertical channel at col 8 rows 7..10
    // and the floor: (9, 10) is reached only from (9, 11) and (8, 10) → (7, 10)... (8, 10) is covered by the channel; (9, 11)
    // from (9, 12) or (8, 11), both free from the south edge. Add the jars at (8, 11): (9, 11) ← (9, 12) ← south edge still.
    const wallWest: StandingPiece = { ...channel, col: 8, row: 7 };
    expect(problems(wallWest, [floor])).toEqual([]);
    // Seed jars flat under the interact tile at (9, 11)..(10, 11): the signpost's tile is reached only from (9, 11)? No: from
    // (8, 10) too, which is free with the channel at col 8 rows 7..10 ... covered. So (9, 10) ← (9, 11) only, and the jars
    // cover it: walled off from every edge tile.
    const jarsUnder: StandingPiece = { ...jars, col: 9, row: 11 };
    expect(problems(jarsUnder, [floor, wallWest])).toEqual(['blocks-signpost']);
    // Each of the three alone, or any two, leaves a way in.
    expect(problems(jarsUnder, [floor])).toEqual([]);
    expect(problems(jarsUnder, [wallWest])).toEqual([]);
    expect(problems(wallWest, [floor, jarsUnder])).toEqual(['blocks-signpost']);
    // The fill itself: nothing solid, reachable; the signpost ringed by its own interact tile's neighbours blocked, not.
    expect(signpostReachable(layout, plot, [])).toBe(true);
    expect(
      signpostReachable(layout, plot, [
        { col: 8, row: 10, cols: 1, rows: 1 },
        { col: 10, row: 10, cols: 1, rows: 1 },
        { col: 9, row: 11, cols: 1, rows: 1 },
      ]),
    ).toBe(false);
    // A candidate outside the plot and over the signpost reports both; the fill is skipped on the signpost.
    expect(problems({ ...channel, col: 9, row: 6 })).toEqual(['outside', 'on-signpost']);
  });

  it('throws for a piece that cannot be built', () => {
    expect(() => problems({ ...channel, pieceId: 'anvil' })).toThrow('anvil');
  });
});

describe('the wire', () => {
  const piece = { pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 };
  const named = {
    id: 'plot-1',
    ground: 'adamah',
    virtue: null,
    namedAt: '2026-10-17T12:00:00.000Z',
    virtueSetAt: null,
    sownAt: null,
    kind: 'field',
    pieces: [piece],
    level: 2,
    state: 'lit',
  };

  it('accepts a plot with its pieces (none while unnamed) and the build, move and take-down bodies', () => {
    expect(isPlotPieceView(piece)).toBe(true);
    expect(isPlotPieceView({ ...piece, rotation: 45 })).toBe(false);
    expect(isPlotPieceView({ ...piece, col: -1 })).toBe(false);
    expect(isPlotPieceView({ ...piece, extra: 1 })).toBe(false);
    expect(isPlotView(named)).toBe(true);
    expect(isPlotView({ ...named, pieces: [] })).toBe(true);
    expect(isPlotView({ ...named, ground: null, kind: null, namedAt: null, level: 1 })).toBe(false);
    expect(isPlotView({ ...named, ground: null, kind: null, namedAt: null, level: 1, pieces: [] })).toBe(true);
    const { pieces: _pieces, ...noPieces } = named;
    expect(_pieces).toHaveLength(1);
    expect(isPlotView(noPieces)).toBe(false);
    const body = { plotId: 'plot-1', pieceId: 'clay-channel', col: 7, row: 7, rotation: 90 };
    expect(isPlotPieceRequest(body)).toBe(true);
    expect(isPlotPieceRequest({ ...body, rotation: 1 })).toBe(false);
    expect(isPlotPieceRequest({ ...body, col: 1.5 })).toBe(false);
    expect(isPlotPieceRequest({ ...body, more: 1 })).toBe(false);
    expect(isPlotPieceRequest({ plotId: 'plot-1', pieceId: 'clay-channel' })).toBe(false);
    expect(isPlotTakeDownRequest({ plotId: 'plot-1', pieceId: 'clay-channel' })).toBe(true);
    expect(isPlotTakeDownRequest({ plotId: 'plot-1' })).toBe(false);
    expect(isPlotTakeDownRequest({ plotId: 'plot-1', pieceId: 'clay-channel', col: 1 })).toBe(false);
  });
});
