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

| Term                        | Meaning                                                                                               | In code                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| the Hollow                  | The void-sea. Formal name: **Tehiru**.                                                                | `hollow`                                      |
| Shard                       | An island in the Hollow.                                                                              | `shard`                                       |
| holding                     | A player's own Shard.                                                                                 | `holding`                                     |
| Writ                        | A Shard's tablet. "Tether" appears only as a verb in UI text, never in code.                          | `writ`                                        |
| Writ lines                  | The tiers of a Writ; one is a Writ line.                                                              | `writLine`                                    |
| Pillar                      | Watcher-Pillar, Wheel-Pillar, Sleeper-Pillar.                                                         | `pillar`; kinds `watcher`, `wheel`, `sleeper` |
| Pillared Cities             | One is a Pillared City.                                                                               | `pillaredCity`                                |
| Concord of Pillars          | Always the full name in text.                                                                         | `concord`                                     |
| Scriptorium of Washed Names | Always the full name in text.                                                                         | `scriptorium`                                 |
| Works                       | Community projects; one is a Work.                                                                    | `work`                                        |
| Old Letters                 | The Hebrew alphabet, used for Writ Names, route waymarks and Veils. Spec: [`letters.md`](letters.md). | `oldLetters`; one is a `letter`               |
| Name                        | A Writ Name: 2–5 Old Letters. Always passes the safe-letters filter.                                  | `name`                                        |

## The Kindled and their things

| Term         | Meaning                                                                              | In code                                                                   |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| the Kindled  | The players; one is a Kindled.                                                       | `kindled`                                                                 |
| Remembrance  | A Kindled's cosmetic origin: **Clay**, **Ash**, **Tide** or **Wing**.                | `remembrance`; `clay`, `ash`, `tide`, `wing`                              |
| clay tone    | The colour of a Kindled's clay: **Grey-ochre**, **Pale**, **Red** or **River-dark**. | `clayTone`; `clay-grey-ochre`, `clay-pale`, `clay-red`, `clay-river-dark` |
| Sparkglass   | The crystal that is both currency and fuel. A mass noun: "120 Sparkglass".           | `sparkglass`                                                              |
| Veil         | A ship's ward.                                                                       | `veil`                                                                    |
| deep-casting | Fishing in the Hollow.                                                               | `deepCasting`                                                             |
| Telling      | A season of the world (about nine months); items reset between Tellings.             | `telling`; ids `telling-1`, …                                             |

`player` stays the technical name in code for input and the controlled entity (`PlayerState`);
accounts and sessions are `account` and `session` (the `accounts` and `sessions` tables);
`kindled` is for in-world things, like a Kindled's Remembrance (the `kindled` table). Player-facing
text says the Kindled.

## Items

The M2 items ([`inventory.md`](inventory.md), `packages/shared/data/items.json`). Item ids are
kebab-case and never renamed once shipped (the ledger stores them).

| Term           | Meaning                                                                                                                | In code                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| sealed gin     | The currency unit: wild Sparkglass weighed and sealed at the Weighing. "120 sealed gin".                               | `sealed-gin`                      |
| wild sliver    | The smallest piece of wild Sparkglass.                                                                                 | `wild-sliver`                     |
| humming glass  | Wild Sparkglass worth three slivers (the book's "shard"; a Shard is always an island). Was "glass chip"; the id stays. | `glass-chip`                      |
| deep glass     | The largest grade of wild Sparkglass, worth nine slivers.                                                              | `deep-glass`                      |
| twisted log    | Wood (the first raft takes five).                                                                                      | `twisted-log`                     |
| black stone    | Stone; Works are built from it.                                                                                        | `black-stone`                     |
| streaked stone | Stone from a deeper quarry layer.                                                                                      | `streaked-stone`                  |
| grey seeds     | Seeds for a field.                                                                                                     | `grey-seeds`                      |
| pale grain     | What a field grows; Rations are cooked from it.                                                                        | `pale-grain`                      |
| item ledger    | The record of every item change (`inventory.apply`).                                                                   | `itemLedger`, table `item_ledger` |
| purse          | Where a Kindled's gin is; takes no slot, never lost.                                                                   | `purse`                           |
| pack           | What a Kindled carries abroad: 20 slots; death costs only what is in it.                                               | `pack`                            |
| store          | The holding store by the Writ post; reachable only on the holding.                                                     | `store`                           |
| basket         | A station's basket: what it makes, until the Kindled takes it to the store.                                            | `basket:<stationId>`              |

## Combat (the Hookblade)

| Term          | Meaning                                                                       | In code                   |
| ------------- | ----------------------------------------------------------------------------- | ------------------------- |
| Hook-thrust   | The Hookblade's heavy: a straight thrust that holds its target on the hook.   | `heavy`, `thrust`, `held` |
| Haul          | Ability slot 1: the hook on its chain, which pulls by weight class.           | `haul`                    |
| The Catch     | Ability slot 2 (locked placeholder).                                          | `the-catch`               |
| Turning Blade | Ability slot 3 (locked placeholder).                                          | `turning-blade`           |
| Ration        | The consumable: heals over time. Found in chests.                             | `ration`, `consumables`   |
| chest         | Opens on contact; scripted contents.                                          | `chest`, tile `C`         |
| Combat        | Input context: a hostile in the room is awake ([`controls.md`](controls.md)). | `combat`, `InputContext`  |
| Calm          | Input context otherwise; set `input.calmDelayMs` after the last hostile dies. | `calm`                    |

## Beings

| Term               | Meaning                                                | In code                                          |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------ |
| Husks              | One is a Husk. Combat rules: [`combat.md`](combat.md). | `husk`                                           |
| the Unwritten      |                                                        | `unwritten`                                      |
| the Choirs         | One is a Choir.                                        | `choir`                                          |
| Dream-Spawn        |                                                        | `dreamSpawn`                                     |
| the Three Withheld | **Coil Beneath**, **Unfelled**, **Eclipse**.           | `withheld`; `coilBeneath`, `unfelled`, `eclipse` |

## Retired terms

| Don't use                                            | Use                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| void, the Deep (the sea, the backdrop around a room) | the Hollow, `hollow`                                                             |
| island                                               | Shard, or holding for a player's own Shard                                       |
| tether as a noun, data ID or identifier              | Writ                                                                             |
| crystal                                              | Sparkglass                                                                       |
| fishing                                              | deep-casting                                                                     |
| tier of a Writ                                       | Writ line                                                                        |
| shard for a fragment of something                    | chip, piece (a Shard is always an island); the Sparkglass grade is humming glass |
| any other name or title for the deity                | the One                                                                          |

These stay as they are: the TypeScript keyword `void`; "hollow" as an adjective (a Husk's hollow
shell); the title "Islands of the One" and the repo, package and deploy names taken from it
(`islands-of-the-one`, `/opt/islands`).

## Writing the terms

- Proper nouns are capitalized: Hollow, Shard, Writ, Pillar, Sparkglass, Veil, Husk, Work. Lowercase:
  holding, deep-casting, and "lines" in Writ lines.
- "the" stays lowercase mid-sentence: the Hollow, the Kindled, the Choirs, the One.
