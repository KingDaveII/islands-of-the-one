# Controls

How input reaches the sim. The sim only ever sees one quantized input per tick (aim, movement,
buttons; [`combat.md`](combat.md) §1); everything here happens in the client
(`apps/client/src/game/controls.ts`, `gamepad.ts`). Gamepad bindings are **data**:
[`packages/shared/data/controls.json`](../../packages/shared/data/controls.json). Keyboard and
mouse bindings are fixed.

## 1. Keyboard and mouse

| Action                   | Key                                       |
| ------------------------ | ----------------------------------------- |
| Move                     | WASD / arrows (8 directions)              |
| Aim                      | mouse, 360°                               |
| Light                    | LMB, or J                                 |
| Hook-thrust (heavy)      | hold RMB, or K                            |
| Dodge                    | Space, or Shift                           |
| Haul (ability 1)         | E                                         |
| Abilities 2 / 3          | R / T (locked for now)                    |
| Item 1 / Item 2          | Q / F                                     |
| Interact, chart, journal | C, Tab, M (placeholders, no function yet) |
| Controls screen          | C on the start screen                     |
| Tuning / debug           | F2 / F3                                   |

## 2. Gamepad presets

The browser Gamepad API with the standard mapping. Glyph names are PlayStation-style in data and
in the UI (Cross, Circle, Square, Triangle, L1, R1, L2, R2, Up/Down/Left/Right); an Xbox pad maps the
same positions. L2/R2 are triggers: pressed past half travel.

`controls.json` holds the presets (`presets[]`, `defaultPreset`) and the keyboard hints
(`keyboard`). A preset has an `id`, a `name`, its `aim` mode and `bindings`: one glyph (or a list of
alternates) per action.

| Action           | **Triggers** (default) | **Faces** (the previous layout) | **Left-stick aim**   |
| ---------------- | ---------------------- | ------------------------------- | -------------------- |
| light            | R2                     | Square                          | R2                   |
| heavy (hold)     | L2                     | Triangle, R2                    | L2                   |
| dodge            | L1                     | Cross, L1                       | L1                   |
| ability 1 (Haul) | R1                     | Circle, R1                      | R1                   |
| ability 2 / 3    | Square / Triangle \*   | L2 / Up \*                      | Square / Triangle \* |
| interact         | Cross                  | Cross                           | Cross                |
| chart peek       | Circle                 | R3                              | Circle               |
| journal          | Down                   | Down                            | Down                 |
| item 1 / 2       | Left / Right           | Left / Right                    | Left / Right         |
| aim              | right stick            | right stick                     | follows movement     |

\* Abilities 2 and 3 on face buttons fire **only during an encounter** (a wave is up); outside one
those buttons are free for menus and interaction.

- The active preset is chosen on the **controls screen** (start screen → CONTROLS, or C; left/right
  or the D-pad to switch) or in the **F2 panel** (gamepad preset select), and remembered in
  `localStorage`.
- The HUD and the controls screen show the active preset's glyphs as **text labels** (R2, L2, …)
  while a gamepad is connected, and the keyboard keys otherwise, until a glyph sheet exists.
- Interact, chart peek and journal are bound in data but do nothing yet (chests open on contact).

## 3. Aim and the soft lock

- **Right stick deflected** (past the aim deadzone): direct 360° aim. `right-stick` presets only.
- **Right stick centered** (or always, in the `left-stick` preset): aim = **the move direction**,
  snapped to the nearest enemy (by distance) whose direction is within the soft-lock angle of it:
  `softlock.angleDeg` (15°) for right-stick presets, `softlock.leftStickAngleDeg` (20°) for the
  Left-stick preset, both in `tuning.json`. With no enemy in the angle the aim is just the move
  direction; with no movement the previous aim is kept.
- The soft lock never touches the **dodge**: a dodge rolls in the raw move direction (the sim's
  rule; aim is only its fallback when standing still).
- Mouse aim is unchanged and always direct; moving the mouse takes aim back from the stick.

## 4. Presses and ticks

Button presses are latched between sim ticks so none are lost when a frame runs zero or several
ticks; Heavy is a held state (triggers by value). Light, dodge and ability presses are buffered by
the sim (`input.bufferMs`); item presses are not (they are instant and never queued).
