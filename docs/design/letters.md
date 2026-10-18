# Old Letters

The Old Letters are the Hebrew alphabet as the game uses it: for Writ Names, route waymarks and
Veils. This file is the spec for the letter sheet, the rules of the safe-letters filter and how to
call it. Terms: [`glossary.md`](glossary.md); colors: [`readability.md`](readability.md).

## 1. The letter sheet

`packages/shared/assets/old-letters-8px.png` with `old-letters.json` next to it.

- **189 × 8 px**: one row of 27 cells, 7 px each, in the JSON's `chars` order: the 22 letters alef
  to tav, then the five final forms (final kaf, mem, nun, pe, tsadi).
- Glyphs are **white on transparent** (tint them for states), start at **column 0** of their cell,
  and `widths` gives each one's ink width (2–6 px; proportional).
- **Rows 0–1 ascender** (lamed), **2–6 body** (5 rows), **7 descender** (qof and the descending
  final forms).
- `gap` (1 px) between letters of a word, `space` (3 px) between words. `finals` maps a letter to
  its final form.
- The current glyphs were drawn in-repo as placeholders to this spec; the design system's sheet
  replaces the PNG (same JSON) when it lands.

`packages/shared/test/old-letters.test.ts` checks the PNG against the JSON (size, order, ink
widths, column 0, white on transparent).

### Drawing a string

`@iot/shared` exports the data and the layout; the client draws.

- `shapeLetters(text)` (shared, pure): lays the string out **right to left** (the first letter at
  the right edge), applies the final form to the last letter of every word, folds typed final
  forms mid-word to the base letter, skips niqqud and anything not on the sheet. Returns the width
  and one placement (`cell`, `x`, `width`, `index`) per letter.
- `apps/client/src/render/letters.ts`: `loadLetterSheet()` reads the PNG's pixels once;
  `drawLetters(ctx, sheet, text, x, y, { scale, state, states })` stamps the glyphs onto a 2D
  canvas on whole pixels; `plotLetters(g, ...)` does the same onto a Phaser Graphics (the HUD, the
  Writ panel, the Name screen's tablet); `rasterize(...)` is the same without a canvas (tests,
  Phaser textures).
- **Letter states** for the Writ, one color each, all palette tokens: `lit` (`hollow-light`),
  `dim` (`hollow-dusk`), `dark` (`hollow-below`), `ember` (`spark-ember`), `gold` (`choir-gold`: a full Writ,
  every letter steady, ART 2026-10-18). `states[i]` is the
  state of letter `i` (spaces not counted); `state` is the default for the rest.
- The F3 debug overlay shows the demo: emet and a sample Name in every state; in the dark row
  only the aleph is dark, so emet reads as met.

## 2. The safe-letters filter

`packages/shared/src/safe-letters.ts`, importable as `@iot/shared` or `@iot/shared/safe-letters`.
Pure, no dependencies, same code on server and client.

```ts
import { isSafe, isSafePositions, NAME_REFUSED } from '@iot/shared';

isSafe(text); // { ok: true } | { ok: false, reason }
isSafe(text, { strict: true }); // generated or chosen Names
isSafePositions([0, 12, 21], { strict: true }); // a run of alphabet positions (the sim)
```

Reasons: `name-hebrew`, `name-latin`, `yod-he` (strict only), `offensive`.

It rejects any text that contains the Hebrew name of God (the four-letter name or the title read
in its place; see the glossary's banned names), in these forms:

- **Old Letters**, in the written order and reversed, with or without final forms, niqqud and
  spaces, and across spaces and line breaks. The text is reduced to its letters first (final forms
  folded to base letters, marks and everything else dropped), then searched.
- **Latin transliterations and look-alike spellings**, case-insensitive, written and reversed,
  across spaces and punctuation, after the **Choir hand** normalization: accents removed,
  lowercase, J/Y → I, V/W → U, K → C, letters only.
- **Strict mode** also rejects the letter pair **yod-he** anywhere, in either order. Generated and
  player-chosen Names use it.
- The **offensive-word hook** sits behind the same function (lists empty for now).

The banned runs live in one data file, `packages/shared/data/safe-letters.json`, as **alphabet
positions**: Old Letters 0 = alef .. 21 = tav; Latin a = 0 .. z = 25 of the Choir-hand form. They
are never spelled out anywhere in the repo; the test fixture builds them from positions too, and
`packages/shared/test/names.test.ts` fails the build if a spelled-out form appears in any file.

## 3. Names

- A generated Writ Name (the sim's) is 2–5 Old Letters (`packages/shared/data/names.json`).
- **Generated Names**: `generateName(rng, rules)` in `packages/sim` draws a seeded run of
  positions and redraws until `rules.safe` accepts it. `rules.safe` is the strict filter,
  `(p) => isSafePositions(p, { strict: true }).ok`; the generator cannot run without it.
- **The island's Name** (M2 Task 4a) is typed in any language the fonts can draw and heard into the
  Old Letters by §4: `validateIslandName(input)` in `packages/shared/src/writ.ts` takes untrusted
  input, applies the typed-name rules (`validateTypedName`, [accounts.md](accounts.md)), hears the
  letters and checks them with the strict filter; it returns the Name and its letters, or a refusal
  with the in-world line, `NAME_REFUSED`: "The Writ won't take that name. Try another." (a Name the
  fonts can't draw keeps `NAME_NOT_DRAWABLE`). The old `validateName` (2–5 typed Old Letters) is
  retired: nothing called it.
- Every generator or input that produces letter sequences goes through the filter and has a test
  for it. The test room's display names do too (`isSafe`, non-strict).

## 4. Hearing a Name

A typed Name is cut into the Old Letters **as it sounds, not as it is spelled**: LORE's rules
(book: Lore §4.5), fixed by the reference script
[`reference/old-letters-transliteration.py`](reference/old-letters-transliteration.py) and ported
to [`packages/shared/src/hear-name.ts`](../../packages/shared/src/hear-name.ts), `hearName(typed,
lineLetters)`: base letters, words separated by spaces (`shapeLetters` adds the final forms when
drawing); the same input gives the same letters every time. The tables are data in the module
(`CONSONANTS`, `VOWEL_UNITS`, `INITIAL`, `MEDIAL`, `FINAL`, `LATIN_FOLD`), not `if` chains.

1. Start from the Name as the account rules store it (NFC, trimmed, spaces collapsed). Old Letters
   typed into a Name are kept as typed (the fonts can't draw them yet, so the validator refuses
   them for now). Other scripts are romanized first once the fonts can draw them; until then only
   Latin reaches step 2.
2. Fold: lowercase; ß → ss, æ → ae, œ → oe, ø → o, å → o, ð and þ → th, ñ → ny, ç → s, ý and ÿ
   → y; then strip the remaining accents.
3. Split into words at spaces and hyphens; drop every other non-letter. Inside a word a doubled
   consonant counts once, and a final h after a vowel is silent (Sarah, Noah).
4. Read each word left to right, longest match first, into consonants (table A) and vowels (table
   B). y and w are consonants before a vowel and vowels otherwise, and w is a vowel only right
   after another vowel. A vowel pair ending in y or w breaks before a vowel (in Maya the y is a
   consonant). c is samekh before e, i or y, and qof otherwise.
5. Write each vowel by where it stands in its word: first, inside or last (table B). A word that
   is a single vowel takes the "first" column.
6. Two identical letters side by side merge into one when either came from a vowel.
7. **Close the doors**, across the whole Name, ignoring spaces: where yod touches he, drop the yod
   if it came from a vowel; otherwise, if the he came from a vowel, cut it as alef; otherwise cut
   the he as het. Where yod touches yod, drop the one that came from a vowel. Repeat until no door
   is open. No result ever contains the strict pair.
8. **The lean hand:** if the Name has more letters than a Writ line holds (`lineLetters` in
   writ.json, 12), drop the letters that came from inside vowels (yod and vav, never a word's first
   or last letter), last word first and from the end of each word, until it fits; then close the
   doors again. A Name that still doesn't fit is the layout's problem: the face widens.
9. A Name left with one letter gets an alef in front of it.
10. Final forms at the end of every word: `shapeLetters`.
11. The result passes the safe-letters filter, strict (`validateIslandName`): a Name that happens
    to sound like a banned run is refused.

Where the script and the written rules disagree, the script wins, with two exceptions that read as
accidents (both flagged in the PR of M2 Task 4a): the script has no row for a hard c and drops it
("Cora" → "ora"), and a Python quirk reads a word-final c as samekh; the port follows rule 4 (qof)
in both. `packages/shared/test/hear-name.test.ts` holds LORE's worked examples (Ash אש, Tide טידה,
Maya מיא, Hyacinth חיסינת, Black Rock בלק רוק, Morningstar Rest מורננגסטר רסט in the lean hand…),
the doors and the filter over thousands of generated names, the lean hand, the single letter and
typed Old Letters.
