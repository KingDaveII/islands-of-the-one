import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS, WHITELIST } from '../src/colour.js';
import { MATERIALS, materialsOf } from '../src/materials.js';
import { compactFrames } from '../src/review.js';
import { C } from './helpers.js';

const styleSheet = readFileSync(
  new URL('../../../art/anchors/style-sheet.md', import.meta.url),
  'utf8',
);

/** The whitelist tokens named in a line, as whole names (choir-flame is not choir-flame-deep). */
function tokensIn(line: string): string[] {
  return TOKENS.filter(
    (t) => WHITELIST.includes(t.hex) && new RegExp(`(?<![\\w-])${t.name}(?![\\w-])`).test(line),
  ).map((t) => t.name);
}

describe('the material map (the style sheet\'s "Colour" table)', () => {
  it('has one entry per material row of the style sheet, with the tokens that row names', () => {
    const rows = styleSheet
      .split('\n')
      .filter((l) => l.startsWith('| ') && !l.startsWith('| Material') && !l.startsWith('|---'));
    expect(rows.map((l) => l.split('|')[1]?.trim())).toEqual(MATERIALS.map((m) => m.row));
    rows.forEach((line, i) => {
      const m = MATERIALS[i];
      expect([...tokensIn(line)].sort(), m?.row).toEqual([...(m?.tokens ?? [])].sort());
    });
  });

  it('puts every whitelist colour in at least one material', () => {
    for (const hex of WHITELIST) expect(materialsOf(hex).length, hex).toBeGreaterThan(0);
    expect(materialsOf(C['unwritten-tar'])).toEqual(['skin']);
    expect(materialsOf(C['watcher-stone'])).toEqual(['cloth', 'steel']);
    expect(materialsOf(C['hollow-dusk'])).toEqual(['shell', 'stone']);
    expect(materialsOf('#123456')).toEqual([]);
  });
});

describe('compactFrames', () => {
  it('groups frames by animation key and shortens runs of three or more', () => {
    expect(
      compactFrames([
        'idle_SE_0',
        'walk_SE_0',
        'walk_SE_1',
        'walk_SE_2',
        'walk_SE_3',
        'walk_SE_5',
        'light_1_E_0',
        'light_1_E_1',
        'idle_3',
      ]),
    ).toBe('idle_SE 0; walk_SE 0–3 5; light_1_E 0 1; idle 3');
  });
});
