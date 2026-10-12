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
  canvas on whole pixels; `rasterize(...)` is the same without a canvas (tests, Phaser textures).
- **Letter states** for the Writ, one color each, all palette tokens: `lit` (`hollow-light`),
  `dim` (`hollow-dusk`), `dark` (`hollow-below`), `ember` (`spark-ember`). `states[i]` is the
  state of letter `i` (spaces not counted); `state` is the default for the rest.
- The F3 debug overlay shows the demo: emet and a sample Name in all four states; in the dark row
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

- A Writ Name is 2–5 Old Letters (`packages/shared/data/names.json`).
- **Generated Names**: `generateName(rng, rules)` in `packages/sim` draws a seeded run of
  positions and redraws until `rules.safe` accepts it. `rules.safe` is the strict filter,
  `(p) => isSafePositions(p, { strict: true }).ok`; the generator cannot run without it.
- **Player Names**: `validateName(input)` in `apps/server/src/names.ts` takes untrusted input and
  returns the canonical Name or a refusal with the in-world line, `NAME_REFUSED`: "The Writ won't
  take that name. Try another."
- Every generator or input that produces letter sequences goes through the filter and has a test
  for it. The test room's display names do too (`isSafe`, non-strict).
