import type { RoomTemplate } from './data.js';

/**
 * The room templates' layout rules (`packages/shared/data/rooms.json`),
 * checked over the data by `packages/shared/test/rooms.test.ts`. GAME DESIGN
 * owns the layouts: a rule here reports a template, it never edits one.
 */

/**
 * A chest is a solid pillar (GAME DESIGN 2026-10-17), so a template keeps
 * this many tiles of plain floor clear on every side of every `C` (the 5 × 5
 * square around it), with no player start (`P`) or spawn point (`S`) in
 * them either (GAME DESIGN's answer on #69): a chest never closes a corridor,
 * there is always room to circle it, and nothing spawns against it.
 */
export const CHEST_CLEAR_TILES = 2;

/** The one tile allowed round a chest: plain floor. Walls, pillars, doors, other chests, the player start and the spawn points are not. */
const CLEAR_TILE = '.';

/**
 * Where a template breaks the chest clearance rule: one line per chest that
 * has anything but plain floor within `CHEST_CLEAR_TILES` tiles of it (the
 * room's edge counts as wall), naming the chest's cell and what is in the
 * way. An empty list is a template that passes.
 */
export function chestClearanceProblems(
  template: RoomTemplate,
  clear = CHEST_CLEAR_TILES,
): string[] {
  const problems: string[] = [];
  const tileAt = (col: number, row: number): string => template.tiles[row]?.[col] ?? '#';
  template.tiles.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== 'C') continue;
      const blocked: string[] = [];
      for (let dr = -clear; dr <= clear; dr++) {
        for (let dc = -clear; dc <= clear; dc++) {
          if (dr === 0 && dc === 0) continue;
          const t = tileAt(col + dc, row + dr);
          if (t !== CLEAR_TILE) blocked.push(`${t} at (${col + dc}, ${row + dr})`);
        }
      }
      if (blocked.length)
        problems.push(
          `${template.name}: the chest at (${col}, ${row}) has ${blocked.length} of its ${(2 * clear + 1) ** 2 - 1} surrounding tiles not plain floor: ${blocked.join(', ')}`,
        );
    }
  });
  return problems;
}
