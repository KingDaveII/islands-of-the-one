# Visual readability

How the fight is drawn so that everything that matters reads at 1× (480 × 270) in a busy room.
Combat rules are in [`combat.md`](combat.md). Colors are the design-system tokens in
[`apps/client/src/palette.ts`](../../apps/client/src/palette.ts); never use a color that is not a
token.

Characters and enemies are still placeholder shapes (real sprite sheets come later), but they use
the palettes and outlines below.

## 1. Reserved signal colors

These colors mean one thing each and are used **for nothing else anywhere** (world, HUD, menus,
particles, text, dev panels):

| Signal                   | Color                                   | Use                                                                                                                    |
| ------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Hit flash                | `#FFFFFF` (signal-hit)                  | The struck target turns white for 1–2 frames during hitstop (`juice.hitFlashFrames`). The only pure white in the game. |
| Telegraph                | `#E0457B`, dark `#8E2550`               | Enemies flash and wind up in it before attacking; area attacks show a ground decal in it (dark edge) before they land. |
| Perfect-dodge afterimage | `#FFE7A3` with a 1 px `#2A2540` outline | The short trail of afterimages left by a perfect dodge. Without the outline it disappears on pale floors (1.2:1).      |

- Anything bright that is not a hit uses `hollow-light` (`#F4EFE6`), never white: the Hookblade, the
  reticle, text, health.
- The design system also lights a few UI states in spark-glow (`#FFE7A3`): the ready frame of an
  ability slot, a full heavy charge, a broken poise bar. Because that color is reserved for the
  trail here, those use `spark-amber` (ready, broken poise) and `hollow-light` (full charge)
  instead.

## 2. In the world

- **Silhouette first.** The player, enemies and pickups read as flat shapes.
- **Outlines.** Every character and enemy has a 1 px dark colored outline, never black. **The
  player always has the highest-contrast outline in the room**: `dream-night` (`#1C2147`), the
  darkest value. Husks use `hollow-deep` (`#2A2540`).
- **Grounding shadow.** Every character and enemy sits on a small dithered `hollow-deep` ellipse,
  soft and directly underneath (never cast sideways), so position reads on pale floors.
- **Husk cores.** The bright `husk-core` gets a 1 px `hollow-deep` ring wherever it shows, so it
  never merges with the pale floor.
- **Telegraphs.** During a wind-up the whole Husk turns telegraph pink (dark pink shade and
  outline) and pulls back from its target. It blinks while the attack still tracks the player and
  holds solid once the aim locks. Ground decals in the same colors: the Peeling's dotted lunge
  line, the Nutshell's slam circle (dark edge, filling in as the slam winds up).
- **Invulnerability.** The player flickers on alternate frames while invulnerable (dodge
  i-frames and the post-hit grace).
- **Poise.** A poise bar (16 × 2 inside a 1 px outline) appears over an enemy **only once it has
  taken damage**, **one bar per shell layer**, outermost on top (the Nutshell shows both of its
  layers; a broken layer is an empty track, and the inner one refills when it regrows). A crack
  notch below 30%; broken (staggered, held, or no shell left) lights the outline to mark the
  player's opening. The shell on the sprite shows the same state: one crack below 100%, three
  below 30%, fragments once broken.
- **Hook-thrust (heavy).** The charge is a drawn-back stance (the sprite steps 2 px away from the
  aim) with the **charge spark** from `hookblade-fx` at the hook tip, following the charge meter's
  three stages: `spark_0` from the start through the first stage, `spark_1` in the second,
  `spark_2` held at full charge; `spark-amber`, the full charge in `husk-core` (never spark-glow). The thrust is a **straight line** hitbox
  flash along the aim, as wide as the hitbox, in `hollow-light` with the player outline, where the
  light attack is an arc. A held Husk shows **pinned on the line**: the line runs out to it for the
  hold, and a `hollow-light` ring snaps shut on it.
- **Haul.** The chain and hook are the `hookblade-fx` sheet (`packages/shared/assets`), white on
  transparent and tinted at draw time: one `chain_link` per 16 px from the hand to the hook, the
  `hook` cell rotated to the throw angle around its shank end, all in `hollow-light` with a 1 px
  player outline. On a hit every link swaps to `chain_link_taut` in `spark-amber`, the hook to
  `hook_set`, over a straight `spark-amber` line while the target, or the player, slides along it.
  No new signal color: the chain is the player's weapon, so it uses the weapon's tokens.
- **Chests.** A banded `hollow-below` box with a `dream-night` outline and a blinking
  `spark-amber` clasp; opened, the lid stands up and the inside is the Hollow.
- **Aim.** The reticle marks the exact 360° aim: four broken rims on the diagonals around a spark,
  `hollow-light` with a `ui-outline` outline (never a cross or plus). Sprites turn to the nearest of
  8 facings, in sheet order **S, SE, E, NE, N, NW, W, SW** (`apps/client/src/render/facing.ts`).
- **Room.** Pale `hollow-lavender` floors with `hollow-light` flecks and a dithered edge where they
  meet walls; walls show a `hollow-below` face with `hollow-deep` lines; outside the room is
  `hollow-deep`.
- Pixel rules: whole game pixels only, flat shading in 2–3 steps, dithering instead of gradients,
  integer zoom (×4 at 1080p).

## 3. HUD

HUD elements sit in the **four screen corners**, 8 px in from the edge, and never over the center
of the screen where the fight happens:

| Corner       | Contents                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Top left     | HP bar (64 px, ticks every 10 HP, recent loss in ember, all ember below 25%), the dodge slot and the two consumable slots (icon, count; sunken when empty, lit while a Ration heals) |
| Bottom left  | The weapon: name and tier pips, light combo pips, heavy charge meter (3 stages of the charge window), 3 ability slots                                                                |
| Top right    | Room counter, "ROOM 2/3"                                                                                                                                                             |
| Bottom right | Sparkglass counter                                                                                                                                                                   |

- **Ability slots** (20 × 20; the dodge slot is 14 × 14): the cooldown sweep darkens the remaining
  time clockwise from 12 o'clock, with whole seconds on top. Locked slots show a lock in
  `hollow-dusk` in a sunken frame, with no key hint. A slot's frame lights briefly when it comes
  back.
- **Party portraits** are hidden in solo.
- **Key hints** are text labels until a glyph sheet exists: the active gamepad preset's glyphs
  (R2, L2, L1, …) while a pad is connected, else the keyboard keys (LMB, RMB, SPC, E, Q, F). See
  [`controls.md`](controls.md).

## 4. Panels and type

- **Panels** are dark fired clay: `hollow-deep` face, a raised 1 px `hollow-below` bevel on the top
  and left, a 1 px `dream-night` outline with chamfered corners and a hard 1 px drop shadow. Menu
  panels add a thin glowing `spark-amber` rim, cracked open at the corners; HUD clusters use the
  plain variant so the rim doesn't compete with the fight.
- **Fonts** (both SIL OFL, self-hosted in `apps/client/public/fonts`):
  - **Silkscreen** for labels and numbers;
  - **Tiny5** for sentences (stats, descriptions, lore), 11 px line pitch.

  Both are pixel-exact only at multiples of 8 px: labels and numbers 8 px, titles 16 px, the title
  screen 24 px (drawn as the 8 px face scaled by a whole number, with partial pixels snapped off).

- **Lore and flavor text** is muted `hollow-dusk` (`#A99FC4`), always below a divider, never italic.
- **Rarity** also shows as tier pips, never by color alone.

## 5. Start screen

One weapon per run: the start screen shows the weapon roster as cards. The Hookblade card has its
tier pips, a Tiny5 stat line and its lore below a divider; the other weapons show as locked
("???", a lock, no stats). Only an unlocked weapon can be picked, and it can't be swapped mid-run.
