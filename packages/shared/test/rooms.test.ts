import { describe, expect, it } from 'vitest';
import { CHEST_CLEAR_TILES, chestClearanceProblems, roomTemplates } from '../src/index.js';

/**
 * The chest clearance rule (GAME DESIGN 2026-10-17): chests are solid, so a
 * template keeps two tiles of floor clear all round every `C`. The test
 * reports the templates that break it; it never edits rooms.json (GAME
 * DESIGN owns the layouts), so the ones known to break it today are listed
 * here and a layout change shows as a change to this list.
 */
describe('chest clearance (rooms.json)', () => {
  it('passes a chest with two tiles of floor, player start or spawn points all round', () => {
    const tiles = ['#######', '#.....#', '#..S..#', '#..C..#', '#P....#', '#.....#', '#######'];
    expect(CHEST_CLEAR_TILES).toBe(2);
    expect(chestClearanceProblems({ name: 'Clear', tiles })).toEqual([]);
  });

  it("reports a wall, a pillar, a door, another chest or the room's edge within two tiles, naming the chest", () => {
    expect(
      chestClearanceProblems({
        name: 'Walled',
        tiles: ['#######', '#.....#', '#..o..#', '#..C..#', '#.....#', '#....D#', '#######'],
      }),
    ).toEqual([
      'Walled: the chest at (3, 3) has 2 of its 24 surrounding tiles not floor: o at (3, 2), D at (5, 5)',
    ]);
    expect(chestClearanceProblems({ name: 'Edge', tiles: ['C....', '.....', '.....'] })).toEqual([
      'Edge: the chest at (0, 0) has 16 of its 24 surrounding tiles not floor: ' +
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
      'Walled: the chest at (3, 3) has 1 of its 8 surrounding tiles not floor: o at (3, 2)',
    ]);
  });

  it('reports the templates of rooms.json that break it (for GAME DESIGN; the layouts are theirs to change)', () => {
    const failing = roomTemplates.flatMap((t) => chestClearanceProblems(t));
    // Every M1 template today: the Shell Gallery by one pillar corner two tiles off, the other four put their
    // chest against a wall or the room's edge (reported in the M1 polish PR, 2026-10-17).
    expect(failing).toEqual([
      'Shell Gallery: the chest at (5, 15) has 1 of its 24 surrounding tiles not floor: o at (7, 13)',
      'Crossing: the chest at (6, 13) has 11 of its 24 surrounding tiles not floor: o at (8, 11), # at (4, 14), # at (5, 14), ' +
        '# at (6, 14), # at (7, 14), # at (8, 14), # at (4, 15), # at (5, 15), # at (6, 15), # at (7, 15), # at (8, 15)',
      'Narrow Hollow: the chest at (36, 1) has 10 of its 24 surrounding tiles not floor: # at (34, -1), # at (35, -1), ' +
        '# at (36, -1), # at (37, -1), # at (38, -1), # at (34, 0), # at (35, 0), # at (36, 0), # at (37, 0), # at (38, 0)',
      'Core Ring: the chest at (6, 15) has 10 of its 24 surrounding tiles not floor: # at (4, 16), # at (5, 16), ' +
        '# at (6, 16), # at (7, 16), # at (8, 16), # at (4, 17), # at (5, 17), # at (6, 17), # at (7, 17), # at (8, 17)',
      'Spill: the chest at (23, 12) has 18 of its 24 surrounding tiles not floor: # at (21, 10), # at (22, 10), ' +
        '# at (23, 10), # at (24, 10), # at (21, 11), # at (22, 11), # at (23, 11), # at (24, 11), # at (21, 13), ' +
        '# at (22, 13), # at (23, 13), # at (24, 13), # at (25, 13), # at (21, 14), # at (22, 14), # at (23, 14), ' +
        '# at (24, 14), # at (25, 14)',
    ]);
  });
});
