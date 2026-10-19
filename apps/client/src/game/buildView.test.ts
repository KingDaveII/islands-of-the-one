import { defaultTuning, holdingLayout, holdingRoomTiles, type LayoutPlot, type PlotView, type StandingPiece } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  buildHeader,
  buildPhase,
  cursorStart,
  ghostAt,
  ghostFit,
  ghostRect,
  inStore,
  materialLines,
  needsLine,
  pieceAt,
  pieceInitials,
  pieceRows,
  piecesLine,
  pieceWorldRect,
  plotPieceTiles,
  refundFloats,
  rotateGhost,
  stepCursor,
  tileOfSim,
  tileOfWorld,
  tileRectWorld,
  type Ghost,
} from './buildView.js';

/**
 * Build mode on the client (docs/design/holding.md "Build mode", M2 Task 6):
 * the side list's lines and locked states, the header, the ghost's colour
 * from the shared placement rule plus the Kindled's tile, the rotation, the
 * cursor stepping on a pad, the building moment's phases and the roam's
 * pillars with pieces.
 */
const layout = holdingLayout();
const plot1 = layout.plots[0] as LayoutPlot;
const channel: StandingPiece = { pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 };
const jars: StandingPiece = { pieceId: 'seed-jars', col: 11, row: 12, rotation: 0 };
const skills = { woodcutting: { level: 1 }, mining: { level: 1 }, farming: { level: 1 } };
const store = (logs: number, stone: number, grain: number) => ({
  store: [
    { itemId: 'twisted-log', quantity: logs },
    { itemId: 'black-stone', quantity: stone },
    { itemId: 'pale-grain', quantity: grain },
  ].filter((e) => e.quantity > 0),
});
const field = (pieces: StandingPiece[]): Pick<PlotView, 'ground' | 'pieces'> => ({ ground: 'adamah', pieces });

describe('the side list', () => {
  it("rows the pieces the field can take: the picture's initials, the materials against the store, what is needed, the effect and the card", () => {
    expect(pieceInitials('Clay channel')).toBe('CC');
    expect(pieceInitials('Saw-horse')).toBe('SH');
    expect(pieceInitials('Threshing floor')).toBe('TF');
    const rows = pieceRows('field', field([]), store(340, 100, 0), 1, skills);
    expect(rows.map((r) => r.pieceId)).toEqual(['clay-channel', 'seed-jars', 'threshing-floor']);
    expect(rows[0]).toEqual({
      pieceId: 'clay-channel',
      name: 'Clay channel',
      initials: 'CC',
      footprint: { cols: 1, rows: 4 },
      materials: [
        { itemId: 'twisted-log', text: 'Twisted log 340/300', short: false },
        { itemId: 'black-stone', text: 'Black stone 100/150', short: true },
      ],
      needs: null,
      effect: '+25% work speed',
      card: 'Fired clay troughs laid between the furrows, the way the Kingdom waters its fields. Dew gathers in them overnight, from nowhere you can find.',
      locked: false,
      built: false,
      affordable: false,
    });
    expect(rows[1]).toMatchObject({ name: 'Seed jars', materials: [{ text: 'Twisted log 340/200', short: false }, { text: 'Pale grain 0/40', short: true }], needs: null, locked: false });
    // The threshing floor needs Writ line 2: locked, with what it needs.
    expect(rows[2]).toMatchObject({ name: 'Threshing floor', needs: 'Needs Writ line 2', locked: true, built: false, footprint: { cols: 3, rows: 3 } });
    expect(pieceRows('field', field([]), store(1000, 1000, 100), 2, skills)[2]).toMatchObject({ needs: null, locked: false, affordable: true });
    // A standing piece's row is built: each kind once.
    // A piece already standing shows "Standing" in place of its cost (GAME DESIGN 2026-10-19).
    expect(pieceRows('field', field([channel]), null, 1, skills)[0]).toMatchObject({ built: true, locked: false, needs: null, materials: [{ text: 'Standing', short: false }] });
    // Nothing for a kind without pieces yet.
    expect(pieceRows('lumber-camp', field([]), null, 1, skills)).toEqual([]);
    expect(inStore(store(5, 0, 0), 'twisted-log')).toBe(5);
    expect(inStore(null, 'twisted-log')).toBe(0);
  });

  it('needs the Writ line first, then the skill level', () => {
    const floor = { id: 'f', stationKind: 'field', name: 'F', card: 'c', available: true as const, cost: [], footprint: { cols: 1, rows: 1 }, skill: { skill: 'farming' as const, level: 5 }, writLine: 2, effect: { kind: 'cycle-speed' as const, permille: 250 } };
    expect(needsLine(floor, 1, skills)).toBe('Needs Writ line 2');
    expect(needsLine(floor, 2, skills)).toBe('Needs Farming 5');
    expect(needsLine(floor, 2, { ...skills, farming: { level: 5 } })).toBeNull();
    expect(needsLine(floor, 2, {})).toBe('Needs Farming 5');
    expect(materialLines({ ...floor, cost: [{ itemId: 'pale-grain', quantity: 40 }] }, store(0, 0, 40))).toEqual([{ itemId: 'pale-grain', text: 'Pale grain 40/40', short: false }]);
  });

  it('heads the list with the kind and level, the pieces against the limit; the sentence panel lists the pieces by name', () => {
    expect(buildHeader(field([]), 'Field', 1)).toEqual({ title: 'Field, level 1', count: 'Pieces 0/2' });
    expect(buildHeader(field([channel]), 'Field', 1)).toEqual({ title: 'Field, level 2', count: 'Pieces 1/2' });
    expect(buildHeader(field([channel, jars]), 'Field', 2)).toEqual({ title: 'Field, level 3', count: 'Pieces 2/4' });
    expect(piecesLine([])).toBe('Pieces: none yet');
    expect(piecesLine([channel])).toBe('Pieces: Clay channel');
    expect(piecesLine([channel, jars])).toBe('Pieces: Clay channel, Seed jars');
    expect(refundFloats('clay-channel')).toEqual(['+300 Twisted log', '+150 Black stone']);
    expect(refundFloats('seed-jars')).toEqual(['+200 Twisted log', '+40 Pale grain']);
    expect(refundFloats('anvil')).toEqual([]);
  });
});

describe('the ghost', () => {
  const ghost: Ghost = { ...channel, moving: false };

  it('follows a tile with its footprint centred on it, turns in 90-degree steps, and is green only where the shared rule and the Kindled allow', () => {
    expect(tileOfSim(16 * 7 + 3, 16 * 8)).toEqual({ col: 7, row: 8 });
    expect(tileOfWorld(32 * 7 + 3, 32 * 8 + 31)).toEqual({ col: 7, row: 8 });
    expect(ghostRect(ghost)).toEqual({ col: 7, row: 7, cols: 1, rows: 4 });
    expect(ghostRect({ ...ghost, pieceId: 'anvil' })).toBeNull();
    // A 1 × 4 centred on (9, 9): its top-left a row up; turned, 4 × 1 centred: two cols left.
    expect(ghostAt(ghost, { col: 9, row: 9 })).toMatchObject({ col: 9, row: 8 });
    expect(ghostAt({ ...ghost, rotation: 90 }, { col: 9, row: 9 })).toMatchObject({ col: 8, row: 9 });
    expect(ghostAt({ ...ghost, pieceId: 'threshing-floor' }, { col: 9, row: 9 })).toMatchObject({ col: 8, row: 8 });
    expect(ghostAt({ ...ghost, pieceId: 'anvil' }, { col: 9, row: 9 })).toMatchObject({ col: 9, row: 9 });
    expect(rotateGhost(ghost).rotation).toBe(90);
    expect(rotateGhost({ ...ghost, rotation: 270 }).rotation).toBe(0);
    // L1 turns it back (GAME DESIGN 2026-10-19).
    expect(rotateGhost(ghost, -1).rotation).toBe(270);
    expect(rotateGhost({ ...ghost, rotation: 90 }, -1).rotation).toBe(0);
    expect(ghostRect(rotateGhost(ghost))).toEqual({ col: 7, row: 7, cols: 4, rows: 1 });
    // Fits; red over the signpost (the shared reason); red over the Kindled's own tile, which only the client knows.
    expect(ghostFit(layout, plot1, [], ghost, null)).toEqual({ fits: true, problems: [], onKindled: false });
    expect(ghostFit(layout, plot1, [], { ...ghost, col: 9 }, null)).toEqual({ fits: false, problems: ['on-signpost'], onKindled: false });
    expect(ghostFit(layout, plot1, [], ghost, { col: 7, row: 9 })).toEqual({ fits: false, problems: [], onKindled: true });
    expect(ghostFit(layout, plot1, [], ghost, { col: 8, row: 9 })).toMatchObject({ fits: true, onKindled: false });
    expect(ghostFit(layout, plot1, [jars], { ...ghost, pieceId: 'seed-jars', col: 11, row: 12, moving: true }, null)).toMatchObject({ fits: true });
    expect(ghostFit(layout, plot1, [channel], { ...ghost, pieceId: 'seed-jars', col: 7, row: 8 }, null)).toMatchObject({ fits: false, problems: ['overlaps'] });
  });

  it("steps the pad's cursor inside the plot, and finds the standing piece under a tile", () => {
    expect(cursorStart(plot1)).toEqual({ col: 8, row: 8 });
    expect(stepCursor({ col: 8, row: 8 }, 1, 0, plot1)).toEqual({ col: 9, row: 8 });
    expect(stepCursor({ col: 12, row: 8 }, 1, 0, plot1)).toEqual({ col: 12, row: 8 });
    expect(stepCursor({ col: 7, row: 7 }, -1, -1, plot1)).toEqual({ col: 7, row: 7 });
    expect(stepCursor({ col: 9, row: 12 }, 0, 1, plot1)).toEqual({ col: 9, row: 12 });
    expect(pieceAt([channel, jars], { col: 7, row: 10 })).toBe(channel);
    expect(pieceAt([channel, jars], { col: 12, row: 12 })).toBe(jars);
    expect(pieceAt([channel, jars], { col: 8, row: 8 })).toBeUndefined();
  });
});

describe('the world', () => {
  it('places a piece in world px, and makes its tiles pillars for the roam beside the named signposts', () => {
    expect(tileRectWorld({ col: 7, row: 7, cols: 1, rows: 4 })).toEqual({ x: 224, y: 224, w: 32, h: 128 });
    expect(pieceWorldRect(jars)).toEqual({ x: 352, y: 384, w: 64, h: 32 });
    expect(pieceWorldRect({ ...jars, pieceId: 'anvil' })).toBeNull();
    const plots = [
      { ground: 'adamah', pieces: [channel] },
      { ground: null, pieces: [jars] },
    ];
    expect(plotPieceTiles(plots)).toEqual([
      { col: 7, row: 7 },
      { col: 7, row: 8 },
      { col: 7, row: 9 },
      { col: 7, row: 10 },
    ]);
    const tiles = holdingRoomTiles(layout, ['plot-1'], plotPieceTiles(plots));
    expect(tiles[7]?.[7]).toBe('o');
    expect(tiles[10]?.[7]).toBe('o');
    expect(tiles[11]?.[7]).toBe('.');
    expect(tiles[9]?.[9]).toBe('o');
  });
});

describe('the building moment', () => {
  it('scatters dust for the first quarter, then raises the box row by row, over plots.buildMs', () => {
    const t = defaultTuning.plots;
    expect(t.buildMs).toBe(400);
    expect(buildPhase(t, 0, 4)).toEqual({ dust: true, risen: 0, done: false });
    expect(buildPhase(t, 99, 4)).toEqual({ dust: true, risen: 0, done: false });
    expect(buildPhase(t, 100, 4)).toEqual({ dust: false, risen: 1, done: false });
    expect(buildPhase(t, 250, 4)).toEqual({ dust: false, risen: 3, done: false });
    expect(buildPhase(t, 399, 4)).toEqual({ dust: false, risen: 4, done: false });
    expect(buildPhase(t, 400, 4)).toEqual({ dust: false, risen: 4, done: true });
    expect(buildPhase(t, 5000, 1)).toEqual({ dust: false, risen: 1, done: true });
    expect(buildPhase({ buildMs: 0 }, 0, 2)).toEqual({ dust: false, risen: 2, done: true });
  });
});
