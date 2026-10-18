# Art jobs

ART DIRECTION's art jobs as they were run. Each one is a prompt David pastes into a Claude Code session, which generates with the PixelLab MCP, pushes `art/<job-name>` and opens a draft PR "Asset: <job-name>". The raw outputs sit in `art/raw/<job-name>/`; the results, the boards and the verdicts are in the Game Design Book's Art tab.

| Job | What | PR |
|---|---|---|
| [g13b-job0](g13b-job0.md) | PixelLab plumbing and costs | #23 |
| [g13b-job1](g13b-job1.md) | 15 assets twice: (b) text only vs (c) anchors + palette | #25 |
| [g13b-job2](g13b-job2.md) | Size control; the player's walk, attack, outfit transfer, portrait | #26 |
| [g13b-job3](g13b-job3.md) | Option B at true size: Kesh, Tally, the clerk | #27 |
| [g13b-job4](g13b-job4.md) | The player at 45 px; Tally re-run | #29 |
| [ss01-kindled-ash](ss01-kindled-ash.md) | SS-01: the player's M1 sheet at B, every M1 animation, as a draft recipe | #37 |
| [kindled-ash-finish](kindled-ash-finish.md) | SS-01 part 2: the finished kindled-ash sheet (remaps, gaps, skin), no generations | #39 |
| [run-kindled-ash](run-kindled-ash.md) | The player's run (8 frames, 8 facings) into the finished kindled-ash recipe, and the measured stride of walk and run | #46 |
| [husks-m1](husks-m1.md) | The Peeling and the Nutshell at B: bases, east-only animations, draft recipes | #55 |
| [tiles-cave](tiles-cave.md) | Raw material for the cave tiles (floor texture, wall, north door) and the chest; ART composes the pieces after G1.5e | #56 |
| [run-back-kindled-ash](run-back-kindled-ash.md) | The player's backpedal (`run_back`, 4 frames, 8 facings) into the kindled-ash recipe, and its stride | #74 |
| [holding](holding.md) | Raw material for the starting holding: the ground texture and five props (Writ post, twisted tree, stone outcrop, holding store, Kesh's rock); ART composes the shore and cleans the props | #82 |
| [kesh](kesh.md) | Raw material for Old Kesh fishing on his rock: a seated Fishing state and the `fish`, `talk` and `toss` animations (south-east); ART composes `npc-kesh` after Task 4b's contract | #90 |
| [field-pieces](field-pieces.md) | Raw material for the field's upgrade pieces: Seed jars (two facings), Threshing floor, Clay channel; ART draws the channel's turned facing and the chaff spiral and writes the recipes after Task 6's contract | (to run) |

The current rules (heights, canvas sizes, colours) are in `art/anchors/style-sheet.md`, not in these prompts. New jobs start from the shared header in these prompts and the style sheet.
