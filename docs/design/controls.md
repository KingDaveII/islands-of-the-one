# Controls

How input reaches the sim. The sim only ever sees one quantized input per tick (aim, movement,
buttons; [`combat.md`](combat.md) §1); everything here happens in the client
(`apps/client/src/game/controls.ts`, `gamepad.ts`, `keyboard.ts`). Every binding is **data**:
[`packages/shared/data/controls.json`](../../packages/shared/data/controls.json) holds the gamepad
presets (`presets[]`) and the keyboard/mouse bindings (`keyboard`). A key or pad button is bound to
**one action only per input context** in each layout (`packages/shared/test/controls.test.ts`).

## 0. Input contexts: Combat and Calm

The sim computes an **input context** as part of its state (`state.context`,
[`glossary.md`](glossary.md)):

- **Combat**: at least one hostile enemy in the room is awake (spawned in and alive). An unstruck
  Glowing Shell is not hostile.
- **Calm**: everything else, including cleared rooms and haze-banks.

A room turns Combat the instant a hostile wakes, and Calm `input.calmDelayMs` (500, `tuning.json`)
after the last hostile dies. The client reads the context from the sim state and resolves a button
to an action with it; the input log records the resolved action (Dodge or Interact), so replays
stay deterministic and never need the context. The sim ignores an Interact sent in Combat.

A binding in `controls.json` is a key, a list of alternates, or keys per context
(`{ "combat": ["Cross", "L1"], "calm": "L1" }`; a context left out is unbound there). A key bound in
both contexts must map to exactly one action in each.

## 1. Keyboard and mouse

The `keyboard` block, one key per action. Move and aim are not actions and stay fixed.

| Action                 | Key                                     |
| ---------------------- | --------------------------------------- |
| Move                   | WASD / arrows (8 directions)            |
| Aim                    | mouse, 360°                             |
| Light                  | LMB                                     |
| Hook-thrust (heavy)    | hold RMB                                |
| Dodge                  | Space (both contexts)                   |
| Haul (ability 1)       | MMB (the middle button), or 1           |
| Abilities 2 / 3        | 2 / 3 (locked for now)                  |
| Item 1 / Item 2        | Q / F                                   |
| Interact               | E, Calm only (chests open on contact)   |
| Rotate                 | R (turns the ghost in build mode, [`holding.md`](holding.md) §12) |
| Chart peek             | hold Tab (no function yet)              |
| Journal                | J (no function yet)                     |
| Inventory              | I (opens and closes the inventory screen) |
| Menu                   | Esc (back, on the controls screen)      |
| Tuning / debug         | F2 / F3 (`tuning`, `debug`)             |
| Controls screen        | C on the start screen (`controls`)      |

The Haul's 1 is the only alternate (the middle button first: hints show its glyph); the old J/K
attacks and Shift dodge are gone. The menu keys (`menu`, `controls`, `tuning`, `debug`) are in the
same block so the start screen's hints draw them as glyphs through `keyboardBinding`. The middle button is captured on the game canvas, so it never
starts the browser's autoscroll.

## 2. Gamepad presets

The browser Gamepad API with the standard mapping. Glyph names are PlayStation-style in data and
in the UI (Cross, Circle, Square, Triangle, L1, R1, L2, R2, Up/Down/Left/Right); an Xbox pad maps the
same positions. L2/R2 are triggers: pressed past half travel.

`controls.json` holds the presets (`presets[]`, `defaultPreset`) and the keyboard bindings
(`keyboard`). A preset has an `id`, a `name`, its `aim` mode and `bindings`: one glyph (or a list of
alternates) per action. No button is bound twice within a preset.

| Action           | **Triggers** (default) | **Faces** (the previous layout) | **Left-stick aim**   |
| ---------------- | ---------------------- | ------------------------------- | -------------------- |
| light            | R1                     | Square                          | R1                   |
| heavy (hold)     | R2                     | Triangle, R2                    | R2                   |
| dodge            | L1                     | Cross (Combat), L1              | L1                   |
| ability 1 (Haul) | L2                     | Circle, R1                      | L2                   |
| ability 2 / 3    | Square / Triangle \*   | L2 / Up \*                      | Square / Triangle \* |
| interact         | Cross (Calm)           | Cross (Calm)                    | Cross (Calm)         |
| rotate           | Triangle (Calm)        | unbound \*\*                   | Triangle (Calm)      |
| chart peek       | Circle                 | R3                              | Circle               |
| journal          | Down                   | Down                            | Down                 |
| inventory        | Touchpad               | Touchpad                        | Touchpad             |
| item 1 / 2       | Left / Right           | Left / Right                    | Left / Right         |
| aim              | right stick            | right stick                     | follows movement     |

\* Abilities 2 and 3 on buttons fire **only in Combat**; in Calm those buttons are free for menus
and interaction. In Faces, Cross is the dodge in Combat and interact in Calm; L3 is unbound.
\*\* Rotate (M2 Task 6, GAME DESIGN: Triangle in Calm) turns build mode's ghost. Faces binds Triangle
to heavy in both contexts, so the uniqueness test leaves rotate unbound there (the turn button beside
the ghost and R still turn it); GAME DESIGN has been asked for Faces' button.
Playtest 2 moved Triggers and Left-stick to light R1, heavy R2 (hold), Haul L2, dodge L1: the
attacks on the right hand, the hook and the roll on the left. Faces is unchanged.

- The active preset is chosen on the **controls screen** (start screen → CONTROLS, or C; left/right
  or the D-pad to switch) or in the **F2 panel** (gamepad preset select), and remembered in
  `localStorage` **by id only**: the bindings always come from `controls.json`, so a remembered
  preset never replays an old layout (`apps/client/src/game/controlsStore.test.ts`).
- The HUD, the controls screen, the start screen and the chest prompt show bindings as
  **controller glyphs** from `packages/shared/assets/controller-glyphs-12px.png` (1× beside body
  text, 2× on the controls screen), tinted with the UI ink: the active preset's buttons while a
  gamepad is connected, the keyboard keys and mouse buttons (`mouse_left`, `mouse_middle`,
  `mouse_right`) otherwise. Presets use the DualSense
  cells (`ps_*`); a pad whose id contains "Xbox" or "xinput" switches to the Xbox family (`xb_*`;
  the D-pad and stick cells serve both). A binding the sheet has no cell for (Select, F3) falls back
  to its text label. The mapping is `apps/client/src/render/glyphCells.ts`.
- Chart peek and journal are bound in data but do nothing yet. Interact reaches the sim (Calm only)
  but nothing in M1 needs it: chests, loot and traces open on contact with no prompt in both
  contexts. The **interact prompt** (the interact glyph and a word over the target,
  `juice.promptRangePx`) shows only in Calm, over things that need an interact press; the first is
  the Glowing Shell pickup in hour two (`apps/client/src/game/interact.ts`).

## 3. Aim and the soft lock

- **Right stick deflected** (past the aim deadzone): direct 360° aim. `right-stick` presets only.
- **Right stick centered** (or always, in the `left-stick` preset): aim = **the move direction**,
  snapped to the nearest enemy (by distance) whose direction is within the soft-lock angle of it:
  `softlock.angleDeg` (15°) for right-stick presets, `softlock.leftStickAngleDeg` (20°) for the
  Left-stick preset, both in `tuning.json`. With no enemy in the angle the aim is just the move
  direction; with no movement the previous aim is kept.
- The soft lock never touches the **dodge**: a dodge rolls in the raw move direction (the sim's
  rule; aim is only its fallback when standing still).
- Mouse aim is unchanged and always direct. Which one aims is decided by the **active device** (§5):
  the pad in pad mode, the mouse otherwise.
- **The aim you can see** (Playtest 2, [`readability.md`](readability.md) §2): the reticle is drawn
  on the gamepad too, `juice.padReticleDistPx` (32) out along the aim, snapped onto the soft-locked
  Husk while there is one. While the Haul is ready a faint dotted **Haul guide** runs from the
  player along the aim to `haul.rangePx`, so the throw can be seen before it is made; it hides
  during the cooldown. Both are pad-only: the mouse reticle sits on the pointer as before.

## 4. Presses and ticks

Button presses are latched between sim ticks so none are lost when a frame runs zero or several
ticks; Heavy is a held state (triggers by value). Light, dodge and ability presses are buffered by
the sim (`input.bufferMs`); item presses are not (they are instant and never queued).

## 5. The active device

The client keeps **one active device**: keyboard+mouse or gamepad (`apps/client/src/game/activeDevice.ts`,
tested in node). It switches on any key or mouse button, on mouse movement past a few px
(`MOUSE_SWITCH_PX`, counted since the last pad activity, so a nudge never flips it), and on any pad
button or a stick leaving its deadzone. A held button or a drifting stick is one event, not one per
frame, so the device never flickers; a pad going away hands it back to the keyboard.

- **Everything that shows bindings follows it live**, not on a scene change: the HUD's key hints,
  the start screen's hint lines, the controls screen (its lit column header and footer) and the
  results screen's continue hint. The pad glyphs follow the connected pad's family.
- **The aim and the reticle follow it**: in a run the OS cursor is always hidden; the reticle sits
  on the mouse in mouse mode and on the pad aim in pad mode (§3).
- **Menus**: the OS cursor shows in mouse mode and hides in pad mode. They stay navigable on the
  pad with a fixed convention (`MENU_BUTTONS` in `gamepad.ts`, not bindings): Cross or Start
  confirms, Circle goes back, Triangle opens the controls screen from the start screen, Square the inventory screen
  (the `inventory` binding, I and the DualSense Touchpad, opens and closes it too; on the inventory screen
  Cross moves a stack, Square one item, L1/R1 switch tabs; [`inventory.md`](inventory.md)), the D-pad
  (left/right) steps through choices (the weapon on the start screen, the preset on the controls
  screen).
