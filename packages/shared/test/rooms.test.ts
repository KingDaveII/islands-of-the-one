import { describe, expect, it } from 'vitest';
import { CHEST_CLEAR_TILES, chestClearanceProblems, roomTemplates } from '../src/index.js';

/**
 * The chest clearance rule (GAME DESIGN 2026-10-17): chests are solid, so a
 * template keeps two tiles of floor clear all round every `C`. The test
 * fails on any template that breaks it (every chest moved to keep it, GAME
 * DESIGN's answer on #69); it never edits rooms.json, GAME DESIGN owns the
 * layouts. The rule also keeps the player start and the spawn points out of
 * those two tiles.
 */
describe('chest clearance (rooms.json)', () => {
  it('passes a chest with two tiles of plain floor all round, and nothing else', () => {
    const tiles = ['#######', '#.....#', '#.....#', '#..C..#', '#.....#', '#.....#', '#######'];
    expect(CHEST_CLEAR_TILES).toBe(2);
    expect(chestClearanceProblems({ name: 'Clear', tiles })).toEqual([]);
  });

  it("reports a player start or a spawn point within the two tiles (GAME DESIGN's answer on #69)", () => {
    const tiles = ['#######', '#.....#', '#..S..#', '#..C..#', '#P....#', '#.....#', '#######'];
    expect(chestClearanceProblems({ name: 'Spawns', tiles })).toEqual([
      'Spawns: the chest at (3, 3) has 2 of its 24 surrounding tiles not plain floor: S at (3, 2), P at (1, 4)',
    ]);
    // Three tiles off is fine.
    expect(
      chestClearanceProblems({
        name: 'Far',
        tiles: [
          'S.........',
          '..........',
          '..........',
          '....C.....',
          '..........',
          '..........',
          '.P........',
        ],
      }),
    ).toEqual([]);
  });

  it("reports a wall, a pillar, a door, another chest or the room's edge within two tiles, naming the chest", () => {
    expect(
      chestClearanceProblems({
        name: 'Walled',
        tiles: ['#######', '#.....#', '#..o..#', '#..C..#', '#.....#', '#....D#', '#######'],
      }),
    ).toEqual([
      'Walled: the chest at (3, 3) has 2 of its 24 surrounding tiles not plain floor: o at (3, 2), D at (5, 5)',
    ]);
    expect(chestClearanceProblems({ name: 'Edge', tiles: ['C....', '.....', '.....'] })).toEqual([
      'Edge: the chest at (0, 0) has 16 of its 24 surrounding tiles not plain floor: ' +
        '# at (-2, -2), # at (-1, -2), # at (0, -2), # at (1, -2), # at (2, -2), # at (-2, -1), # at (-1, -1), # at (0, -1), ' +
        '# at (1, -1), # at (2, -1), # at (-2, 0), # at (-1, 0), # at (-2, 1), # at (-1, 1), # at (-2, 2), # at (-1, 2)',
    ]);
    expect(
      chestClearanceProblems({ name: 'Pair', tiles: ['.......', '..C.C..', '.......'] }),
    ).toHaveLength(2);
    // The clearance is a parameter: one tile would pass what two tiles do not.
    expect(
      chestClearanceProblems(
        {
          name: 'Walled',
          tiles: ['#######', '#.....#', '#..o..#', '#..C..#', '#.....#', '#....D#', '#######'],
        },
        1,
      ),
    ).toEqual([
      'Walled: the chest at (3, 3) has 1 of its 8 surrounding tiles not plain floor: o at (3, 2)',
    ]);
  });

  it('every template of rooms.json keeps the rule (the five chests moved, GAME DESIGN 2026-10-17)', () => {
    expect(roomTemplates.flatMap((t) => chestClearanceProblems(t))).toEqual([]);
    // Where they stand now (col, row); a chest moves only by GAME DESIGN's word.
    const at = roomTemplates.map((t) => [
      t.name,
      ...t.tiles.flatMap((row, r) => (row.includes('C') ? [[row.indexOf('C'), r]] : [])),
    ]);
    expect(at).toEqual([
      ['Shell Gallery', [4, 15]],
      ['Crossing', [11, 11]],
      ['Narrow Hollow', [36, 3]],
      ['Core Ring', [6, 13]],
      ['Spill', [23, 7]],
    ]);
  });
});
