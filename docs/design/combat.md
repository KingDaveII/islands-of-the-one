# Combat design

The rules every combat change builds on. Numbers live in
[`packages/shared/data/tuning.json`](../../packages/shared/data/tuning.json) and are referenced
here by key (`dodge.activeMs`), never copied, so this document cannot drift from the game. How the
fight is drawn so it stays readable is in [`readability.md`](readability.md).

Goal: combat that feels modern and punchy. Spend effort on **feel**, not on the number of systems.

## 1. Simulation and determinism

All gameplay runs in `packages/sim`, a deterministic simulation. The client only feeds inputs and
renders state; it never decides an outcome.

- **Fixed 60 Hz tick.** Time is counted in ticks. Every duration in the data is written in ms and
  converted with `msToTicks` (rounded) when the tuning is compiled at load, so values like 50 ms
  become 3 ticks.
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

- **Run record = seed + config + input log.** `RunRecord` holds the seed, the weapon, the full
  tuning, the room templates, one input per tick, and every live tuning change with the tick it
  applied. Replaying a record reproduces the same final state hash on any machine. Tests check this,
  including runs with mid-run tuning changes.
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
  Overlapping bodies are pushed apart in proportion to their `mass` (not knockback; see §6). A
  dodging player, or one using an ability, passes through Husks.
- Sprites turn to the nearest of 8 facings; attack arcs, the aim reticle and telegraphs use the
  exact angle.

## 3. The move timing model

**Every move** has **startup → active → recovery**, stored in milliseconds in the data and turned
into ticks at load:

| Move          | Data                                          | Active means                                     |
| ------------- | --------------------------------------------- | ------------------------------------------------ |
| Light 1–3     | `weapons.<id>.light[i].startupMs` …           | the arc hits                                     |
| Heavy         | `weapons.<id>.heavy.startupMs` …              | the arc hits                                     |
| Abilities 1–3 | `weapons.<id>.abilities[i].startupMs` …       | the ability moves and hits                       |
| Dodge         | `dodge.startupMs` / `activeMs` / `recoveryMs` | i-frames (recovery still slides)                 |
| Husk attacks  | `husks.<kind>.attack.startupMs` …             | startup = wind-up/telegraph, active = lunge/slam |

Startup and active frames are committed; recovery is where cancels happen (§4).

**Armor frames.** Any player move can mark a window of its frames as armored with `armorStartMs`
and `armorEndMs` (counted from the start of the move; `0`/`0` means none). While armored, an enemy
hit still deals its damage (and its hitstop and the post-hit invulnerability), but it does **not**
interrupt the move: no hurt stun, no knockback, the buffer and combo are kept. The Hookblade uses no
armor yet; the mechanic is there for heavier weapons.

## 4. Cancels and the input buffer

What may start, given what the player is doing:

| Current move                  | May start                                    |
| ----------------------------- | -------------------------------------------- |
| idle                          | anything                                     |
| light or heavy, **recovery**  | the next light, a heavy, an ability, a dodge |
| ability, **recovery**         | a dodge only                                 |
| charging a heavy              | a dodge only                                 |
| startup or active of any move | nothing                                      |
| dodge (any phase)             | nothing                                      |
| hurt                          | nothing                                      |

- So an attack can always be finished with an ability ("cancel into Lunge"), but an ability is a
  commitment that only a dodge can get you out of, and only once it has done its job.
- **Input buffer.** Light, heavy, dodge and ability presses are buffered for `input.bufferMs`
  (about 120 ms). A press made shortly before an action becomes possible fires on the first tick it
  is: an ability pressed during a light's active frames comes out on its first recovery tick.
  - The latest press wins.
  - Buffered presses don't age during hitstop.
  - Getting hit (without armor) clears the buffer.

## 5. Weapons and abilities

**One weapon per run.** It is picked on the start screen and is part of the run config and the
record; it never changes mid-run (live tuning edits change its numbers, not which weapon is held).
`weaponRoster` lists what the picker shows; locked entries are placeholders. A run can only start
with an unlocked weapon that has data in `weapons`.

Every weapon (`weapons.<id>`) has a `name`, a rarity `tier`, a stat line (`blurb`) and `lore` for the
picker, and:

- **Light combo:** `light[]`, chained by pressing again in recovery. The chain survives
  `comboResetMs` of idling; after the last step it wraps to the first.
- **Charged heavy:**
  - hold to charge up to `heavy.fullChargeMs`, moving at `chargeMoveFactor`;
  - release to strike;
  - damage, shell damage, knockback, hitstop and shake all scale linearly with charge between their
    `*Min` and `*Max` values;
  - charge shows as three stage pips under the player and in the HUD.
- **Three ability slots** (`abilities[]`). Each slot is a full move: `startupMs`/`activeMs`/
  `recoveryMs`, its **own** `cooldownMs`, armor frames, and its hit (`hitRadiusPx`, `damage`,
  `shellDamage`, `knockbackPx`, `hitstopMs`, `shake`). There is **no mana or energy**: cooldowns are
  the only limit.
  - `kind` says how the sim runs it: `dash-strike` (move along the aim at `speed` during active,
    hitting everything within `hitRadiusPx`), `spin` (the same without moving) or `none`.
  - A `locked` slot exists in data and in the HUD but never executes; its press is swallowed.

**Hookblade** (the only weapon so far):

- **Light:** a 3-hit melee arc chain. The third hit is stronger, with more damage and knockback, a
  wider arc and longer hitstop.
- **Heavy:** a wide, strong arc; the shell breaker.
- **Slot 1, "Lunge":** a `dash-strike` along the aim that hits each Husk once. Cancelling light
  recovery into it is the Hookblade's gap closer after the third hit knocks a Husk away.
- **Slots 2 and 3:** in data, locked (spinning sweep, TBD).

## 6. Hits, hitstop, knockback, weight, poise

- **Hitstop** freezes attacker and target for the hit's `hitstopMs`:
  - light about 50 ms, the third hit and Lunge a bit more;
  - heavy about 70–110 ms by charge.

  It is per entity, in the sim: other Husks keep moving.
  **One swing freezes once.** When a swing (light, heavy or ability) hits several Husks, in the
  same tick or over its active frames, the player's hitstop plays once at the level of the
  **strongest** hit, never summed: a stronger later hit only tops the freeze up to its own level,
  a weaker one adds nothing. Every Husk the swing struck freezes at that same level.

- **Knockback is a distance.** A hit's `knockbackPx` is how far it pushes a **light**-class enemy,
  away from the attacker; a pull is the same push aimed at the attacker. The push is a short slide
  over `husks.knockbackMs` that starts when the target's hitstop ends, and walls stop it.
- **Weight classes.** Each enemy has a `weightClass`, and `husks.weightClasses` scales every pull
  and knockback by class: **light** moves the full distance (1), **medium** half (0.5), **heavy**
  not at all (0). Starting values, both tunable: the Peeling is light, the Nutshell heavy.
- **Husk shells are armor-poise.** A Husk is a hollow shell (1–2 layers) around a bright core.
  - **Layer holds:** hits only chip the outermost layer. The Husk keeps attacking (super armor) and
    knockback is reduced (`armoredKnockbackFactor`).
  - **Layer breaks:** the Husk is **staggered** (`staggerMs`), which interrupts any wind-up or
    attack. Only `husks.shellBreakCoreFactor` of that hit's core damage lands.
  - **Shell gone:** core hits deal full damage and **flinch** (`flinchMs`), which also interrupts.
  - The **heavy** has high `shellDamage`: it is the shell breaker. **Lights** are for the core.
- **Fair telegraphs.** Every Husk attack has a wind-up (its `attack.startupMs`) shown in the
  telegraph color, with a ground decal: the Peeling's dotted lunge line, the Nutshell's slam
  circle filling in. Attacks only track the player for the first `trackMs` of the wind-up, then
  lock (the flash turns solid). If you see it, you can dodge it.
- **Player hit:**
  - damage, knockback, a short stun (`hurtStunMs`), then `hurtInvulnMs` of mercy invulnerability
    (during armor frames: damage and invulnerability only);
  - at 0 HP the run ends.

## 7. Dodge and perfect dodge

- A dodge rolls in the movement direction (or the aim direction when standing still) at
  `dodge.speed`. Its timing follows §3: `startupMs` (no i-frames yet), `activeMs` (**i-frames**),
  `recoveryMs` (still sliding, vulnerable), then it exits at `exitSpeedFactor` of its speed.
  - **Cooldown:** `dodge.cooldownMs`, counted after the roll ends.
  - Dodge cancels attack and ability recovery and a heavy charge; nothing cancels a dodge.
- **Perfect dodge:** the i-frames started within `perfectDodge.windowMs` (generous, about 130 ms)
  before an enemy attack would connect. "Connect" uses a near-miss margin of
  `perfectDodge.marginPx`, so near misses count too. Rewards:
  - the attack is voided;
  - brief **slow-mo**: `slowmoMs` of real time played at `slowmoScale`;
  - **+`sparkglassBonus` Sparkglass** (the "Sparkglass flare").
- Dodging earlier than the window still avoids damage while the i-frames last, but it isn't
  perfect.

## 8. Enemies: the Husks

Translucent hollow shells with one bright core. They are drawn to the Sparkglass the player carries:
pursuit speed and attack cadence scale by `aggroPerSparkglass` per Sparkglass carried, capped at
`aggroMax`.

- **Peeling** (light class): a small, fast swarmer with a weak single-layer shell that comes in
  groups.
  - Short lunge attack: `attack.startupMs` of wind-up, then a dash at `lungeSpeed` for
    `attack.activeMs`.
  - Circles at the edge of its range while its attack cools down.
- **Nutshell** (heavy class): slow, with two shell layers (outer, inner) that crack separately.
  Knockback never moves it.
  - Heavy slam: a long telegraph (`attack.startupMs`), then a circle of `slamRadiusPx` just ahead
    of it for `attack.activeMs`.

## 9. Run structure

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

## 10. Feel toolkit (presentation)

The client adds juice from `tuning.json` → `juice`. None of it affects the sim. Colors and shapes
follow [`readability.md`](readability.md).

- Scaled screen shake, using the hit's `shake`.
- Hit flash: the struck target turns white for `juice.hitFlashFrames` (1–2) frames.
- Chipped-pixel shell particles, plus a ring and "CRACK"/"BREAK" when a layer breaks.
- Core flare on death.
- Perfect-dodge afterimage trail, flare and a tint during slow-mo.
- Slash crescents; the charge meter under the player.
- Camera lead toward the aim.
- Render interpolation between ticks.

**Hitstop and slow-mo:**

- **Hitstop** is simulated: frozen entities.
- **Slow-mo** is the client stepping the sim more slowly in real time. The sim only counts down
  `slowmo` ticks, so replays are unaffected.

## 11. Tuning workflow

- **F2** opens the tuning panel: a slider for every numeric value in `tuning.json` (all move
  timings, cooldowns, armor windows, weight-class multipliers, …), a select for enums (an enemy's
  `weightClass`, an ability's `kind`), and read-only flags (`locked`).
  - Changes apply live and are recorded into the current run's record, so the run still replays.
  - New runs take the current values as their config.
  - **Export JSON** copies the values in the file's exact shape to paste over `tuning.json`.
- **F3** shows FPS, tick, entity count, seed, the last input, and the state hash.
