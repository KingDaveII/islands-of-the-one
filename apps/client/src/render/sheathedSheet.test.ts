import { existsSync } from 'node:fs';
import { OPTIONAL_SPRITE_SHEETS, REMEMBRANCE_SHEATHED_SHEETS, REMEMBRANCES, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../../packages/shared/test/fixtures/kindled-fixture.json' with { type: 'json' };
import { PLAYER_SHEATHED_SHEET, PLAYER_SHEET, sheathedSheetFor } from './characters.js';
import { bundledSheet, optionalSheet, sheetNamed } from './spriteSheets.js';

const fixture: SpriteSheet = fixtureJson;
/** The fixture as ART's Clay sheet would land: its PNG and its mask named after the sheet. */
const clay: SpriteSheet = {
  ...fixture,
  meta: { ...fixture.meta, image: 'kindled-clay-sheathed.png' },
  ...(fixture.palette ? { palette: { ...fixture.palette, mask: 'kindled-clay-sheathed.skin.png' } } : {}),
};
/** PNG URLs as the bundler would give them, for the files listed. */
const files =
  (...names: string[]) =>
  (file: string): string | undefined =>
    names.includes(file) ? `/assets/${file}` : undefined;

const onDisk = (name: string): boolean =>
  existsSync(new URL(`../../../../packages/shared/assets/sprites/${name}.json`, import.meta.url));

describe("the Remembrance's sheathed sheet (M2 Task 9, ART's job #114)", () => {
  it('bundles an optional Kindled sheet with its PNG and its skin mask', () => {
    expect(bundledSheet('kindled-clay-sheathed', clay, files('kindled-clay-sheathed.png', 'kindled-clay-sheathed.skin.png'))).toEqual({
      sheet: clay,
      png: '/assets/kindled-clay-sheathed.png',
      mask: '/assets/kindled-clay-sheathed.skin.png',
    });
  });

  it('refuses one without its mask (it could not take the clay tones), or without its PNG', () => {
    expect(bundledSheet('kindled-clay-sheathed', clay, files('kindled-clay-sheathed.png'))).toBeUndefined();
    expect(bundledSheet('kindled-clay-sheathed', clay, files('kindled-clay-sheathed.skin.png'))).toBeUndefined();
    const noPalette: SpriteSheet = { frames: clay.frames, meta: clay.meta, anims: clay.anims };
    expect(bundledSheet('kindled-clay-sheathed', noPalette, files('kindled-clay-sheathed.png'))).toBeUndefined();
    // Only optional sheets come this way, and only real sheets.
    expect(bundledSheet('kindled-ash-sheathed', clay, () => '/x')).toBeUndefined();
    expect(bundledSheet('kindled-clay-sheathed', { frames: {} }, () => '/x')).toBeUndefined();
  });

  it("looks the sheet up by Remembrance with Ash's as the fallback, through the same check", () => {
    const loaded =
      (...present: string[]) =>
      (name: string): boolean =>
        bundledSheet(name, clay, files(...present.flatMap((p) => [`${p}.png`, `${p}.skin.png`]))) !== undefined;
    // The fixture stands in for Clay's sheet: on disk with its mask, Clay wears it; the others wear Ash's.
    const clayOnDisk = (name: string): boolean => name === 'kindled-clay-sheathed' && loaded('kindled-clay-sheathed')(name);
    expect(sheathedSheetFor('clay', clayOnDisk)).toBe('kindled-clay-sheathed');
    expect(sheathedSheetFor('tide', clayOnDisk)).toBe(PLAYER_SHEATHED_SHEET);
    expect(sheathedSheetFor('ash', clayOnDisk)).toBe(PLAYER_SHEATHED_SHEET);
    // Without its mask it isn't loaded: Ash's.
    const maskless = (name: string): boolean =>
      bundledSheet(name, clay, files('kindled-clay-sheathed.png')) !== undefined;
    expect(sheathedSheetFor('clay', maskless)).toBe(PLAYER_SHEATHED_SHEET);
  });

  it('finds each sheet on disk through the optional loader, and only then (today Ash for all, each Remembrance as its sheet lands)', () => {
    expect(PLAYER_SHEATHED_SHEET).toBe('kindled-ash-sheathed');
    for (const name of REMEMBRANCE_SHEATHED_SHEETS) {
      expect(OPTIONAL_SPRITE_SHEETS).toContain(name);
      expect(optionalSheet(name) !== undefined, `${name} ${onDisk(name) ? 'is' : 'is not'} on disk`).toBe(onDisk(name));
    }
    for (const r of REMEMBRANCES) {
      const own = `kindled-${r}-sheathed`;
      expect(sheathedSheetFor(r), r).toBe(r === 'ash' || !onDisk(own) ? PLAYER_SHEATHED_SHEET : own);
      expect(sheetNamed(sheathedSheetFor(r)), r).toBeDefined();
    }
    // Encounters keep the combat sheet: kindled-ash, whatever the Remembrance.
    expect(PLAYER_SHEET).toBe('kindled-ash');
  });
});
