# Glossary

The public game terms. Use them for names everywhere: identifiers, data keys and IDs, asset names,
player-facing text, docs and comments. The "In code" column is the form for identifiers and JSON
keys (camelCase, PascalCase for types); string IDs in data use the same words in kebab-case
(`deep-casting`, `coil-beneath`), like the existing `dash-strike`.

This file fixes names, not lore: meanings are only as precise as naming needs. New public terms come
with the task that introduces them; add them here in the same change.

## The One

In-world, the deity is only ever **the One**, as in the game's title. No other name or title for the
deity appears in the game.

## Banned names

Hard ban everywhere: player-facing text, data, item IDs, identifiers, assets (file names and
content), comments and docs.

- **The Tetragrammaton**, the four-letter Hebrew name of God, in any spelling, vocalization or
  transliteration (the bare consonants, the vocalized scholarly forms, the forms used in English
  and German Bibles) and in any script, including Hebrew letters.
- **The Hebrew title read in its place**, meaning "my Lord".

This file describes them instead of spelling them out, so that it follows its own rule.
[`packages/shared/test/names.test.ts`](../../packages/shared/test/names.test.ts) fails `pnpm check`
when a file in the repo contains one in its path or text.

All other religious and mythological names, symbols and scripts are allowed.

## The world

| Term                        | Meaning                                                                      | In code                                       |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| the Hollow                  | The void-sea. Formal name: **Tehiru**.                                       | `hollow`                                      |
| Shard                       | An island in the Hollow.                                                     | `shard`                                       |
| holding                     | A player's own Shard.                                                        | `holding`                                     |
| Writ                        | A Shard's tablet. "Tether" appears only as a verb in UI text, never in code. | `writ`                                        |
| Writ lines                  | The tiers of a Writ; one is a Writ line.                                     | `writLine`                                    |
| Pillar                      | Watcher-Pillar, Wheel-Pillar, Sleeper-Pillar.                                | `pillar`; kinds `watcher`, `wheel`, `sleeper` |
| Pillared Cities             | One is a Pillared City.                                                      | `pillaredCity`                                |
| Concord of Pillars          | Always the full name in text.                                                | `concord`                                     |
| Scriptorium of Washed Names | Always the full name in text.                                                | `scriptorium`                                 |
| Works                       | Community projects; one is a Work.                                           | `work`                                        |

## The Kindled and their things

| Term         | Meaning                                                                    | In code                                      |
| ------------ | -------------------------------------------------------------------------- | -------------------------------------------- |
| the Kindled  | The players; one is a Kindled.                                             | `kindled`                                    |
| Remembrance  | A Kindled's cosmetic origin: **Clay**, **Ash**, **Tide** or **Wing**.      | `remembrance`; `clay`, `ash`, `tide`, `wing` |
| Sparkglass   | The crystal that is both currency and fuel. A mass noun: "120 Sparkglass". | `sparkglass`                                 |
| Veil         | A ship's ward.                                                             | `veil`                                       |
| deep-casting | Fishing in the Hollow.                                                     | `deepCasting`                                |

`player` stays the technical name in code for accounts, sessions, input and the controlled entity
(`PlayerState`, the `players` table); `kindled` is for in-world things, like a Kindled's
Remembrance. Player-facing text says the Kindled.

## Beings

| Term               | Meaning                                                | In code                                          |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| Husks              | One is a Husk. Combat rules: [`combat.md`](combat.md). | `husk`                                           |
| the Unwritten      |                                                        | `unwritten`                                      |
| the Choirs         | One is a Choir.                                        | `choir`                                          |
| Dream-Spawn        |                                                        | `dreamSpawn`                                     |
| the Three Withheld | **Coil Beneath**, **Unfelled**, **Eclipse**.           | `withheld`; `coilBeneath`, `unfelled`, `eclipse` |

## Retired terms

| Don't use                                            | Use                                        |
| ---------------------------------------------------- | ------------------------------------------ |
| void, the Deep (the sea, the backdrop around a room) | the Hollow, `hollow`                       |
| island                                               | Shard, or holding for a player's own Shard |
| tether as a noun, data ID or identifier              | Writ                                       |
| crystal                                              | Sparkglass                                 |
| fishing                                              | deep-casting                               |
| tier of a Writ                                       | Writ line                                  |
| shard for a fragment of something                    | chip, piece (a Shard is always an island)  |
| any other name or title for the deity                | the One                                    |

These stay as they are: the TypeScript keyword `void`; "hollow" as an adjective (a Husk's hollow
shell); the title "Islands of the One" and the repo, package and deploy names taken from it
(`islands-of-the-one`, `/opt/islands`).

## Writing the terms

- Proper nouns are capitalized: Hollow, Shard, Writ, Pillar, Sparkglass, Veil, Husk, Work. Lowercase:
  holding, deep-casting, and "lines" in Writ lines.
- "the" stays lowercase mid-sentence: the Hollow, the Kindled, the Choirs, the One.
