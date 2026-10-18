import { describe, expect, it } from 'vitest';
import {
  isSkill,
  levelFromXp,
  SKILL_TABLE_LEVELS,
  SKILLS,
  skillProgress,
  skillTable,
  xpForLevel,
  xpToNext,
} from '../src/index.js';

/**
 * Skill XP (docs/design/holding.md, GAME DESIGN's curve): the generated
 * table against the formula, integer-exact; the pinned values; the level
 * from an XP total at the edges, in the table and past it.
 */
describe('the skill curve', () => {
  it('has the three skills of M2', () => {
    expect(SKILLS).toEqual(['woodcutting', 'mining', 'farming']);
    expect(isSkill('mining')).toBe(true);
    expect(isSkill('cooking')).toBe(false);
  });

  it('is round(40 + 12,300 × (1.08^L − 1.08)) from level L to L + 1: level 2 at 40', () => {
    expect(xpToNext(1)).toBe(40);
    expect(xpToNext(2)).toBe(1103);
    expect(xpToNext(3)).toBe(2250);
    expect(xpToNext(199)).toBe(Math.round(40 + 12300 * (Math.pow(1.08, 199) - 1.08)));
  });

  it('the table is the formula summed, exactly, for every level from 1 to 200', () => {
    expect(skillTable).toHaveLength(SKILL_TABLE_LEVELS);
    expect(SKILL_TABLE_LEVELS).toBe(200);
    let sum = 0;
    skillTable.forEach((xp, i) => {
      expect(xp, `level ${i + 1}`).toBe(sum);
      expect(Number.isSafeInteger(xp)).toBe(true);
      sum += xpToNext(i + 1);
    });
  });

  it('pins the values the table gives: level 2 at 40, level 10 at 46,689, level 20 at 298,935', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(10)).toBe(46689);
    expect(xpForLevel(20)).toBe(298935);
    expect(xpForLevel(200)).toBe(743985697074);
  });

  it('gives the level from an XP total at the edges', () => {
    expect(skillProgress(0)).toEqual({ xp: 0, level: 1, into: 0, toNext: 40 });
    expect(skillProgress(39)).toEqual({ xp: 39, level: 1, into: 0 + 39, toNext: 1 });
    expect(skillProgress(40)).toEqual({ xp: 40, level: 2, into: 0, toNext: 1103 });
    expect(skillProgress(41)).toEqual({ xp: 41, level: 2, into: 1, toNext: 1102 });
    expect(skillProgress(46688).level).toBe(9);
    expect(skillProgress(46689)).toEqual({ xp: 46689, level: 10, into: 0, toNext: xpToNext(10) });
    expect(levelFromXp(298935)).toBe(20);
    expect(levelFromXp(298934)).toBe(19);
    // Negative or fractional totals never happen (XP is a whole count), but they don't break it.
    expect(skillProgress(-5).level).toBe(1);
    expect(skillProgress(40.9)).toEqual(skillProgress(40));
  });

  it('runs the same formula past the table: no level cap (200 and 250)', () => {
    const at200 = xpForLevel(200);
    expect(skillProgress(at200)).toEqual({ xp: at200, level: 200, into: 0, toNext: xpToNext(200) });
    expect(skillProgress(at200 - 1).level).toBe(199);
    expect(skillProgress(at200 + xpToNext(200))).toMatchObject({ level: 201, into: 0, toNext: xpToNext(201) });
    let at250 = at200;
    for (let l = 200; l < 250; l++) at250 += xpToNext(l);
    expect(xpForLevel(250)).toBe(at250);
    expect(Number.isSafeInteger(at250)).toBe(true);
    expect(skillProgress(at250)).toEqual({ xp: at250, level: 250, into: 0, toNext: xpToNext(250) });
    expect(skillProgress(at250 - 1)).toMatchObject({ level: 249, toNext: 1 });
  });
});
