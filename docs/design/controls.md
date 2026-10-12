# Controls

How input reaches the sim. The sim only ever sees one quantized input per tick (aim, movement,
buttons; [`combat.md`](combat.md) §1); everything here happens in the client
(`apps/client/src/game/controls.ts`, `gamepad.ts`, `keyboard.ts`). Every binding is **data**:
[`packages/shared/data/controls.json`](../../packages/shared/data/controls.json) holds the gamepad
presets (`presets[]`) and the keyboard/mouse bindings (`keyboard`). A key or pad button is bound to
**one action only** per layout (`packages/shared/test/controls.test.ts`).

## 1. Keyboard and mouse

The `keyboard` block, one key per action. Move and aim are not actions and stay fixed.

| Action                 | Key                                     |
| ---------------------- | --------------------------------------- |
| Move                   | WASD / arrows (8 directions)            |
| Aim                    | mouse, 360°                             |
| Light                  | LMB                                     |
| Hook-thrust (heavy)    | hold RMB                                |
| Dodge                  | Space                                   |
| Haul (ability 1)       | 1                                       |
| Abilities 2 / 3        | 2 / 3 (locked for now)                  |
| Item 1 / Item 2        | Q / F                                   |
| Interact               | E (chests still open on contact)        |
| Chart peek             | hold Tab (no function yet)              |
| Journal                | J (no function yet)                     |
| Menu                   | Esc (back, on the controls screen)      |
| Tuning / debug         | F2 / F3 (F3 is a dev key, not in data)  |
| Controls screen        | C on the start screen (a menu shortcut) |

There are no alternates: the old J/K attacks and Shift dodge are gone.

## 2. Gamepad presets

The browser Gamepad API with the standard mapping. Glyph names are PlayStation-style in data and
in the UI (Cross, Circle, Square, Triangle, L1, R1, L2, R2, Up/Down/Left/Right); an Xbox pad maps the
same positions. L2/R2 are triggers: pressed past half travel.

`controls.json` holds the presets (`presets[]`, `defaultPreset`) and the keyboard bindings
(`keyboard`). A preset has an `id`, a `name`, its `aim` mode and `bindings`: one glyph (or a list of
alternates) per action. No button is bound twice within a preset.

| Action           | **Triggers** (default) | **Faces** (the previous layout) | **Left-stick aim**   |
| ---------------- | ---------------------- | ------------------------------- | -------------------- |
| light            | R2                     | Square                          | R2                   |
| heavy (hold)     | L2                     | Triangle, R2                    | L2                   |
| dodge            | L1                     | Cross, L1                       | L1                   |
| ability 1 (Haul) | R1                     | Circle, R1                      | R1                   |
| ability 2 / 3    | Square / Triangle \*   | L2 / Up \*                      | Square / Triangle \* |
| interact         | Cross                  | L3 (Cross is the dodge there)   | Cross                |
| chart peek       | Circle                 | R3                              | Circle               |
| journal          | Down                   | Down                            | Down                 |
| item 1 / 2       | Left / Right           | Left / Right                    | Left / Right         |
| aim              | right stick            | right stick                     | follows movement     |

\* Abilities 2 and 3 on face buttons fire **only during an encounter** (a wave is up); outside one
those buttons are free for menus and interaction.

- The active preset is chosen on the **controls screen** (start screen → CONTROLS, or C; left/right
  or the D-pad to switch) or in the **F2 panel** (gamepad preset select), and remembered in
  `localStorage`.
- The HUD, the controls screen, the start screen and the chest prompt show bindings as
  **controller glyphs** from `packages/shared/assets/controller-glyphs-12px.png` (1× beside body
  text, 2× on the controls screen), tinted with the UI ink: the active preset's buttons while a
  gamepad is connected, the keyboard keys and mouse buttons otherwise. Presets use the DualSense
  cells (`ps_*`); a pad whose id contains "Xbox" or "xinput" switches to the Xbox family (`xb_*`;
  the D-pad and stick cells serve both). A binding the sheet has no cell for (Select, F3) falls back
  to its text label. The mapping is `apps/client/src/render/glyphCells.ts`.
- Interact, chart peek and journal are bound in data but do nothing yet (chests open on contact;
  the interact prompt already shows over a closed chest in reach, `juice.promptRangePx`).

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
