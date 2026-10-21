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
| rotate           | build mode's R1 / L1 \*\* | build mode's R1 / L1 \*\*        | build mode's R1 / L1 \*\* |
| chart peek       | Circle                 | R3                              | Circle               |
| journal          | Down                   | Down                            | Down                 |
| inventory        | Touchpad               | Touchpad                        | Touchpad             |
| item 1 / 2       | Left / Right           | Left / Right                    | Left / Right         |
| aim              | right stick            | right stick                     | follows movement     |

\* Abilities 2 and 3 on buttons fire **only in Combat**; in Calm those buttons are free for menus
and interaction. In Faces, Cross is the dodge in Combat and interact in Calm; L3 is unbound.
\*\* Rotate turns build mode's ghost (M2 Task 6). On the keyboard it is the `rotate` action, R. On the pad
build mode has its own buttons like a menu, the same on every preset (GAME DESIGN 2026-10-19): R1 turns the
ghost clockwise and L1 back (`MENU_BUTTONS.tabNext`/`tabPrev`), Cross places, Circle leaves, nothing attacks
or dodges; so no preset binds `rotate` (Triangle in Calm clashed with Faces' heavy). On touch, the TURN button
beside the ghost.
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
ticks; Heavy is a held state (triggers by value). Light is a press that is also sent on every tick
its button is held, so holding light keeps attacking at the combo's pace on every device (GAME
DESIGN, 2026-10-21; `combat.md` §4). Light, dodge and ability presses are buffered by the sim
(`input.bufferMs`); item presses are not (they are instant and never queued).

## 5. The active device

The client keeps **one active device**: keyboard+mouse, gamepad or touch (`apps/client/src/game/activeDevice.ts`,
tested in node). It switches on any key or mouse button, on mouse movement past a few px
(`MOUSE_SWITCH_PX`, counted since the last pad or touch activity, so a nudge never flips it), on any pad
button or a stick leaving its deadzone, and on a finger down (a pointer whose `pointerType` is touch, §6).
Pointer events, not mouse events, so the mouse events a browser makes up after a tap never count; and a key
typed into a form input never counts (on a phone it is the phone's own keyboard). A held button or a drifting stick is one event, not one per
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

## 6. Touch

M2 Task 10. Touch is the third device, next to keyboard+mouse and the pad, and every M2 screen plays with fingers
alone, in landscape. The model is GAME DESIGN's touch column (Game design → Controls, 2026-10-20):

| Action                        | Touch                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Move, dodge direction         | floating left stick, anchored where the thumb lands                              |
| Aim                           | the attack and ability buttons: a tap fires at the move direction with the 20° soft lock; press, drag off the button and release fires in the drag direction |
| Light                         | big button under the right thumb: fires on press, keeps attacking while held (a drag aims each next hit), the release only stops |
| Heavy (hold to charge)        | second big button, left of LIGHT: press starts the charge, drag aims, release fires |
| Dodge                         | button above LIGHT (fires on press; its direction is the stick's, never the aim) |
| Ability (one slot in M1)      | an arc of up to three small buttons round LIGHT, aimed like LIGHT                |
| Item 1 / 2                    | two slots, top right (fire on press)                                             |
| Interact                      | tap the thing, or the USE button (whenever a prompt is up)                        |
| Inventory                     | the pack button, bottom right                                                    |
| Menu                          | the gear, top right (the `menu` binding, Esc)                                    |

There is **no right stick** (GAME DESIGN: "the buttons are the aim"), no cancel gesture in M2 and no haptics.

**The sim never knows.** Touch feeds `Controls.sample` like the pad (`game/touchInput.ts`, pure, tested in node):
the stick's deflection goes through `quantizeMove` with the stick deadzone (0.2), so the roam's walk/run rule
(`roam.walkStickMax`) applies unchanged; the buttons are presses and holds latched between ticks (§4); LIGHT is
pressed on the touch down and sent every tick while the finger stays on it (a quick tap is one hit); HEAVY is held
from the touch down to the release (and for at least one tick, so a quick tap still charges and fires). With no
button dragged the aim is the pad's centred-stick rule with `softlock.leftStickAngleDeg` (20°, `Controls.softLockDeg`);
while a LIGHT, HEAVY or ability touch is dragged past `touch.aimDragCssPx` from the button's centre, the aim is the
drag's direction, and the tick a dragged HEAVY or ability lets go fires there (a held LIGHT aims each next hit by
the drag; its release fires nothing). The input log records the same resolved
actions; nothing under `packages/sim` changed.

**The zones** (`touchZone`): a touch that starts on a showing control is that control's, and stays its while dragged
off; on a HUD zone (an interactive object under it: the pack, the chip, the Writ, a panel's button) it is theirs;
anywhere else on the left half it anchors the stick (the base stays, the knob clamps at the travel); anywhere else
on the right half it is a tap or nothing. A still, short touch (within `touch.tapMaxMs` and `touch.tapMaxCssPx`,
timed by the browser's event times) is a tap wherever it started, so tap to walk works on the whole island
(holding.md §6). One finger owns one control until it lifts; three touch pointers are on (`activePointers`). A
paused scene lets every finger go.

**The layer** (`ui/touchControls.ts`, on the UI camera; its layout pure in `game/touchLayout.ts`): shown only while
touch is the device. Every number is the `touch` block of `controls.json`, in CSS px (a thumb's size doesn't
change with the screen), converted to whole UI px at layout (`controlPx`): every control at least
`buttonMinCssPx` (56) across, the stick's travel `stickRadiusCssPx` (48), each control's centre an offset in from
its screen corner (`buttons`). The top right first (the gear, then the item slots in a row), then the cluster from
LIGHT out: a control whose place is off the screen, over a HUD panel, over the top centre band (`topCentreClear`)
or over a control placed before it (`gapCssPx` apart) moves to the nearest free place inwards from its corner. The
controls don't widen the camera's safe margins. In a run: LIGHT, HEAVY, DODGE, the ability arc (the unlocked abilities only: locked slots never show on touch, so
M2's arc is the Haul alone and it grows as abilities unlock; GAME DESIGN, 2026-10-21), USE (above DODGE,
only while a prompt is up), the item slots and the gear; on the holding: USE alone (`useAlone`, over the pack
button) and the gear. ART's look (2026-10-20): the plain HUD panel as discs (the attacks, DODGE, the abilities,
USE) and chamfered squares (the gear, the item slots), a 50 % checker dither of ui-panel for every fill (every
other pixel shows the world), a solid dream-night outline, a 1 px bevel ring just inside it all the way round (hollow-dusk on the
top-left half, `uiBevelLight`, hollow-below on the rest; ART on #134: it reads on the Hollow margin and on the pale
floor alike), a hard 1 px drop shadow; ART's touch-glyph sheet (`touch-glyphs-16px.png`, #133) centred on each at 1
UI px per px, LIGHT and HEAVY from the 24 px sheet (`touch-glyphs-24px.png`, #135) on a button at least
`touch.glyphLargeMinUiPx` (48) across, the item slots
the item's icon and count. Pressed: no shadow, the content 1 px down and right, the bevel's light bottom and right, never
a colour flash. A cooldown is a solid dream-night sweep over the time left, clockwise from 12 o'clock, with whole
seconds on top and the frame lit briefly when it is back; a locked slot shows the hollow-dusk lock. The stick
(only while held): a 2 px ring (dream-night outside, hollow-below inside) the size of its travel with the dither
inside, and a raised knob, 40 % of the travel: hollow-below, lighter than the base, lit top-left in
hollow-dusk, with the dream-night outline (ART on #134). While the arc's second slot is hidden (locked), HEAVY takes
its place, off the room's bottom-right edge. No alpha anywhere.

**The aim you can see:** in touch mode the pad's reticle shows along the aim (§3), and while a button is dragged a
short dotted aim line runs from the Kindled along it, `touch.aimLinePx` (56) world px, in the Haul guide's style.
The OS cursor stays hidden in a run.

**Hints:** in touch mode the key and pad hint lines hide (the run HUD's, the menus' footers) and the world prompt
shows its verb alone. Where a hint was the only way to learn an action a touch line takes its place: "Tap to
continue" on the results screen (GAME DESIGN's), "tap  <  >  to switch" on the controls screen, the inventory's
"tap move · hold one · drag between panes · tap a tab". A screen whose only way back was a key gets a BACK button
on touch (the inventory, the controls screen: `touchBackButton`, render/menus.ts). The controls screen has a third
column, Touch, from the table above (the button's glyph, or a word). In a run the gear leaves for the start screen
(a run has no pause yet), but only on a second tap within `touch.leaveConfirmMs` (2000): the first shows "Tap again
to leave the run." on a plain panel on the gear's own row, its right edge against the gear (the ROOM readout
hides for those 2 s and comes back on the same frame as the line leaves, never a control covered; centred on that row when it doesn't fit there; `notePlace`, ART on #136), and after the window the gear resets (GAME DESIGN, 2026-10-21; `TapAgain`,
`game/tapAgain.ts`). Once deaths cost the pack, leaving a run will count as a death (GAME DESIGN's note; nothing in
M2).

**The page** (`apps/client/index.html`): no browser gestures over the game (`touch-action: none`,
`overscroll-behavior: none`, no long-press callout or text selection, no tap flash), the form inputs opting back
in so typing, selecting and pasting work. **Landscape only:** on a touch screen held upright the game waits under
one line, "Turn your phone sideways." (GAME DESIGN's), BitmapText on the Hollow, every running scene paused under
it and the form inputs hidden (`ui/portrait.ts`); turning back resumes them where they were. On the first touch on
the canvas the page asks for full screen where the browser allows it (Android), then locks to landscape where
full screen allows it; a refusal is ignored. iOS Safari has none for pages: the web app manifest
(`public/manifest.webmanifest`: `display: fullscreen`, `orientation: landscape`, the Hollow's background) and the
`apple-mobile-web-app-capable` and status-bar meta tags make "Add to Home Screen" open the game full screen. The
home-screen icons join the manifest when ART delivers them. The viewport stays the default (no `viewport-fit=cover`),
so the browser keeps the game inside the safe area.

**Tests:** `activeDevice.test.ts` (touch), `touchLayout.test.ts` (the four test screens, 844 × 390 @ 3,
915 × 412 @ 2.6, 1180 × 820 @ 2 and 667 × 375 @ 2, in both modes against the HUD's own panel rectangles,
`runHudRects` and `hudRects`; the sizes; the zones; the stick; a tap and a drag), `touchInput.test.ts` (when each
button fires, the soft-locked aim of a tap, the aim of a drag, HEAVY's hold), `path.test.ts` (holding.md §6),
`orientation.test.ts`, `manifest.test.ts`. `tools/screenshots-m2-10.mjs` plays it on an emulated phone (Playwright
`hasTouch`, several fingers as TouchEvents on the canvas); shots: `docs/screenshots/m2-10/`.
