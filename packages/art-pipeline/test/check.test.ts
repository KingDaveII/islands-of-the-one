import { describe, expect, it } from 'vitest';
import { checkAll, recipeNames } from '../src/sheets.js';

/**
 * `pnpm art:check` as a test, so `pnpm check` covers it: every committed
 * recipe in art/sheets rebuilds in memory to exactly the committed outputs,
 * byte for byte. A hand-edited built sheet, review image or report fails here.
 */
describe('art:check', () => {
  it('finds the committed recipes', () => {
    expect(recipeNames()).toEqual(expect.arrayContaining(['kindled-ash', 'npc-tally']));
  });

  it('rebuilds every committed recipe to the committed outputs, byte for byte', () => {
    expect(checkAll()).toEqual([]);
  });
});
