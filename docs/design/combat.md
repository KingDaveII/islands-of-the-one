# Combat design (M1)

The rules every combat change builds on. Numbers live in
[`packages/shared/data/tuning.json`](../../packages/shared/data/tuning.json) and are referenced
here by key (`dodge.iframesMs`), never copied, so this document cannot drift from the game.

Goal: combat that feels modern and punchy. Spend effort on **feel**, not on the number of systems.

## 1. Simulation and determinism

All gameplay runs in `packages/sim`, a deterministic simulation. The client only feeds inputs and
renders state; it never decides an outcome.

- **Fixed 60 Hz tick.** Time is counted in ticks. Tuning is written in ms and converted with
  `msToTicks` (rounded), so values like 50 ms become 3 ticks.
- **Integers only.** Positions and velocities are sub-pixel integers (`SUB` = 256 per pixel), angles
  are 1/4096 of a turn, and fractions are stored as permille. Any non-integer in the state fails the
  hash.
- **No engine-dependent math.**
  - The sim never uses `Math.random`, `Date.now`, `performance.now`, timers or floating-point time.
  - It never uses `Math.sin`/`cos`/`atan2`/`sqrt`: these differ between browsers. Use the sim's own
    lookup tables (`trig.ts`: sin/cos/atan2 on 1/4096 turn) and the exact integer `isqrt`.
  - ESLint enforces all of this in `packages/sim/src`.
- **Seeded RNG.** Randomness comes from the run's mulberry32 state (`rng.ts`), which is part of the
  hashed state.
- **No order-dependent containers.** The state is plain arrays/objects (no `Map`/`Set`), iterated
  in array order.
- **Quantized input.** Each tick's input is one packed uint32:
  - aim angle: 1/4096 turn;
  - movement: direction in 1/256 turn plus magnitude 0–7;
  - buttons: Light, Dodge and Ability 1–3 are "pressed this tick", Heavy is "held".

  The client does the float→integer quantization (`apps/client/src/game/quantize.ts`).

- **Run record = seed + config + input log.** `RunRecord` holds the seed, the full tuning, the room
  templates, one input per tick, and every live tuning change with the tick it applied. Replaying a
  record reproduces the same final state hash on any machine. Tests check this, including runs with
  mid-run tuning changes.
- **Every sim change needs a replay test.** The golden hash (`packages/sim/test/run.test.ts`) uses a
  frozen copy of the tuning, so balance edits don't churn it. Update it only for an intentional
  change to sim code, and say so in the commit.

## 2. Movement and aim

- Free analog movement at any angle, with `player.acceleration` toward the target velocity and
  `player.friction` when there is no input. Turning through acceleration is the smoothing for
  keyboard play.
- Keyboard (WASD) gives 8 directions at full magnitude. The gamepad left stick is fully analog, with
  a deadzone and 7 magnitude steps.
- Aim is independent of movement:
  - mouse, or gamepad right stick, 360°;
  - with no right-stick input, the gamepad aims where you walk.
- Collision is circles vs. tile walls and circles vs. circles, all in the sim (no Phaser physics).
  Overlaps are split by `weight`. A dodging or lunging player passes through Husks.
- Shapes are drawn at the nearest of 8 facings. Attack arcs and telegraphs use the exact angle.

## 3. Actions, commitment and the input buffer

Each attack has **startup → active → recovery** frames.

- **Startup and active frames are committed.** Nothing cancels them.
- **Recovery is the cancel window.** From recovery you may dodge, continue the combo, start a heavy
  or use an ability.
- **Input buffer.** Light, heavy, dodge and ability presses are buffered for `input.bufferMs`
  (about 120 ms). A press made shortly before an action becomes possible fires on the first tick it
  is.
  - The latest press wins.
  - Buffered presses don't age during hitstop.
  - Getting hit clears the buffer.

## 4. Weapons and abilities model

A weapon defines the class. Every weapon (`weapons.<id>`) has:

- **Light combo:** `light[]`, chained by pressing again in recovery. The chain survives
  `comboResetMs` of idling; after the last step it wraps to the first.
- **Charged heavy:**
  - hold to charge up to `heavy.fullChargeMs`, moving at `chargeMoveFactor`;
  - release to strike;
  - damage, shell damage, knockback, hitstop and shake all scale linearly with charge between their
    `*Min` and `*Max` values;
  - charge is shown on the player (a ring) and in the HUD.
- **Three ability slots** (`abilities[]`), each `{ id, name, locked }`. Ability parameters live
  under the top-level `abilities.<id>`. A locked slot exists in data and in the HUD but swallows its
  input.

**Hookblade** (M1, the only weapon):

- **Light:** a 3-hit melee arc chain. The third hit is stronger, with more damage and knockback, a
  wider arc and longer hitstop.
- **Heavy:** a wide, strong arc.
- **Slot 1, "Lunge":** a short dash-strike along the aim direction that hits each Husk once, then
  goes on cooldown (`abilities.lunge.cooldownMs`).
- **Slots 2 and 3:** locked (planned: spinning sweep, TBD).

## 5. Dodge and perfect dodge

- A dodge rolls in the movement direction (or the aim direction when standing still) at
  `dodge.speed` for `dodge.durationMs`.
  - **I-frames:** `dodge.iframesMs`.
  - **Cooldown:** `dodge.cooldownMs`, counted after the roll ends.
- **Perfect dodge:** the dodge started within `perfectDodge.windowMs` (generous, about 130 ms)
  before an enemy attack would connect. "Connect" uses a near-miss margin of
  `perfectDodge.marginPx`, so near misses count too. Rewards:
  - the attack is voided;
  - brief **slow-mo**: `slowmoMs` of real time played at `slowmoScale`;
  - **+`sparkglassBonus` Sparkglass** (the "Sparkglass flare").
- Dodging earlier than the window still avoids damage while the i-frames last, but it isn't
  perfect.

## 6. Hits, hitstop, knockback, poise

- **Hitstop** freezes both attacker and target for the strike's `hitstopMs`:
  - light about 50 ms, the third hit and Lunge a bit more;
  - heavy about 70–110 ms by charge.

  It is per entity, in the sim: other Husks keep moving.

- **Knockback** is an impulse along the attacker→target line, divided by the target's `weight`.
- **Husk shells are armor-poise.** A Husk is a hollow shell (1–2 layers) around a bright core.
  - **Layer holds:** hits only chip the outermost layer. The Husk keeps attacking (super armor) and
    knockback is reduced (`armoredKnockbackFactor`).
  - **Layer breaks:** the Husk is **staggered** (`staggerMs`), which interrupts any wind-up or
    attack. Only `husks.shellBreakCoreFactor` of that hit's core damage lands.
  - **Shell gone:** core hits deal full damage and **flinch** (`flinchMs`), which also interrupts.
  - The **heavy** has high `shellDamage`: it is the shell breaker. **Lights** are for the core.
- **Fair telegraphs.** Every Husk attack has a wind-up with a blinking flash and a ground marker:
  - the Peeling's lunge line;
  - the Nutshell's slam circle filling in.

  Attacks only track the player for the first `trackMs` of the wind-up, then lock. If you see it,
  you can dodge it.

- **Player hit:**
  - damage, knockback, a short stun (`hurtStunMs`), then `hurtInvulnMs` of mercy invulnerability;
  - at 0 HP the run ends.

## 7. Enemies: the Husks

Hollow translucent shells with one bright core. They are drawn to the Sparkglass the player carries:
pursuit speed and attack cadence scale by `aggroPerSparkglass` per shard, capped at `aggroMax`.

- **Peeling:** a small, fast swarmer with a weak single-layer shell that comes in groups.
  - Short lunge attack: `windupMs`, then a dash of `lungeSpeed` × `lungeMs`.
  - Circles at the edge of its range while its attack cools down.
- **Nutshell:** slow, with two shell layers (outer, inner) that crack separately; the HP of each
  layer is shown separately.
  - Heavy slam: a long telegraph (`windupMs`), then a circle of `slamRadiusPx` just ahead of it.

## 8. Run structure

- **Rooms:** 3 rooms stitched from the hand-made templates in
  [`rooms.json`](../../packages/shared/data/rooms.json), chosen and ordered by the seed.

  | Tile     | Meaning      |
  | -------- | ------------ |
  | `#`, `o` | wall         |
  | `.`      | floor        |
  | `P`      | player start |
  | `S`      | spawn point  |
  | `D`      | exit door    |

- **Waves:** each room has its waves in `run.rooms[i].waves`. The door opens when the last wave is
  dead, and walking into it loads the next room. Room 3 is the tough one, with Nutshells.
- **End of a run:** death, or clearing room 3.
  - Sparkglass kept: 100% on a clear, `run.sparkglassKeptOnDeath` (50%) on death.
  - The results screen shows time, rooms, kills, perfect dodges and Sparkglass found/kept.

## 9. Feel toolkit (presentation)

The client adds juice from `tuning.json` → `juice`. None of it affects the sim.

- Scaled screen shake, using the hit's `shake`.
- Hit flash.
- Chipped-pixel shell particles, plus a ring and "CRACK"/"BREAK" when a layer breaks.
- Core flare on death.
- Dodge afterimages and a squash shape.
- Slash crescents.
- A charge ring.
- Perfect-dodge flare with a violet tint during slow-mo.
- Camera lead toward the aim.
- Render interpolation between ticks.

**Hitstop and slow-mo:**

- **Hitstop** is simulated: frozen entities.
- **Slow-mo** is the client stepping the sim more slowly in real time. The sim only counts down
  `slowmo` ticks, so replays are unaffected.

## 10. Tuning workflow

- **F2** opens a slider for every numeric value in `tuning.json`.
  - Changes apply live and are recorded into the current run's record, so the run still replays.
  - New runs take the current values as their config.
  - **Export JSON** copies the values in the file's exact shape to paste over `tuning.json`.
- **F3** shows FPS, tick, entity count, seed, the last input, and the state hash.
