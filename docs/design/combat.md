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
  - buttons: Light, Dodge, Ability 1–3 and Item 1–2 are "pressed this tick", Heavy is "held".

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
- **The backpedal costs speed** (GAME DESIGN 2026-10-17): free movement away from the aim is
  slower. The factor is 1 up to `player.backpedalFromDeg` (90°) between the movement and the aim,
  so strafing is never slowed; it eases down linearly to `player.backpedalFactor` (0.85) at
  `player.backpedalFullDeg` (135°) and stays there to 180° (`backpedalFactor` in
  `packages/sim/src/player.ts`, integer math on the 1/4096-turn angles). It applies **in Combat
  only** (GAME DESIGN's answer on #69): never in Calm, so never in a cleared room and never on the
  holding; and to the target speed of free movement only, the stick or keys in idle. The heavy's
  charge walk keeps its own `chargeMoveFactor` (0.45) with no backpedal on top; the dodge, the
  Haul's pull and every forced movement keep their full distances. With a gamepad stick centred
  the aim follows the movement, so that player is never slowed.
- The Kindled moves at `player.moveSpeed`: 100 sim px/s, 200 world px/s (GAME DESIGN 2026-10-16,
  down from 112). In an encounter, Combat and Calm alike, it always **runs** at that speed. Walking,
  and the automatic walk-to-run, happen only outside encounters (M2's holding). The run and walk
  cycles play by distance travelled ([`sprites.md`](sprites.md) §8).
- Keyboard (WASD) gives 8 directions at full magnitude. The gamepad left stick is fully analog, with
  a deadzone and 7 magnitude steps.
- Aim is independent of movement:
  - mouse, or gamepad right stick, 360°;
  - with the right stick centered, the gamepad aims where you walk, **soft-locked** to the nearest
    enemy within `softlock.angleDeg` of that direction (the client does this; the sim only sees the
    final aim). Presets and the soft lock: [`controls.md`](controls.md).
- A dodge always rolls in the movement direction, never the soft-locked aim (aim is only the
  fallback when standing still).
- Collision is circles vs. tile walls and circles vs. circles, all in the sim (no Phaser physics).
  Overlapping bodies are pushed apart in proportion to their `mass` (not knockback; see §6). A
  dodging player, or one using an ability, passes through Husks.
- **Chests are solid** (GAME DESIGN 2026-10-17): a chest is a small round pillar of
  `run.chestRadiusPx` that blocks the Kindled and every Husk alike, whatever they are doing, so it
  doubles as cover to circle around. After the walls, every body is pushed out of every chest as a
  circle, with the bodies' integer push-out, the chest taking none of it; a body a chest pushed gets
  a second wall pass. Projectiles and the Haul's hook pass over chests. The autopilot plans its paths
  around them as around walls.
- Sprites turn to the nearest of 8 facings; attack arcs, the aim reticle and telegraphs use the
  exact angle.

## 3. The move timing model

**Every move** has **startup → active → recovery**, stored in milliseconds in the data and turned
into ticks at load:

| Move            | Data                                          | Active means                                                  |
| --------------- | --------------------------------------------- | ------------------------------------------------------------- |
| Light 1–3       | `weapons.<id>.light[i].startupMs` …           | the arc hits                                                  |
| Heavy (tap)     | `weapons.<id>.heavy.tap.startupMs` …          | the thrust line hits                                          |
| Heavy (charged) | `weapons.<id>.heavy.charged.startupMs` …      | the thrust line hits                                          |
| Abilities 1–3   | `weapons.<id>.abilities[i].startupMs` …       | the ability moves and hits (Haul: the hook flies, then pulls) |
| Dodge           | `dodge.startupMs` / `activeMs` / `recoveryMs` | i-frames (recovery still slides)                              |
| Husk attacks    | `husks.<kind>.attack.startupMs` …             | startup = wind-up/telegraph, active = lunge/slam              |

Startup and active frames are committed; recovery is where cancels happen (§4).

**Armor frames.** Any player move can mark a window of its frames as armored with `armorStartMs`
and `armorEndMs` (counted from the start of the move; `0`/`0` means none). While armored, an enemy
hit still deals its damage (and its hitstop and the post-hit invulnerability), but it does **not**
interrupt the move: no hurt stun, no knockback, the buffer and combo are kept. Three things armor
the Hookblade: a **fully charged** heavy hold (from the moment the charge is full until the
release), the charged thrust's own window (`heavy.charged.armorStartMs`/`armorEndMs`, applied only
when it was released from a full charge), and the arrival of a Haul on a heavy target
(`haul.arrivalArmorMs`, a timer independent of the move).

## 4. Cancels and the input buffer

What may start, given what the player is doing:

| Current move                  | May start                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------- |
| idle                          | anything                                                                         |
| light, **recovery**           | a heavy, an ability, a dodge; the next light only from the **chain point** below |
| heavy, **recovery**           | the next light, a heavy, an ability, a dodge                                     |
| ability, **recovery**         | a dodge only                                                                     |
| charging a heavy              | a dodge only                                                                     |
| startup or active of any move | nothing                                                                          |
| dodge (any phase)             | nothing                                                                          |
| hurt                          | nothing                                                                          |

- So an attack can always be finished with an ability ("cancel into Haul"), but an ability is a
  commitment that only a dodge can get you out of, and only once it has done its job.
- **Light chain point** (Playtest 2). A light's recovery can be cancelled into the next light only
  once `input.lightChainMs` (30) of that recovery has passed; dodge, heavy and abilities still
  cancel on the first recovery tick. The delay is there so that a gamepad bumper and a mouse reach
  the same top light cadence: mashing and tapping every 150 ms give the same number of lights
  (`packages/sim/test/combat.test.ts`).
- **Input buffer.** Light, heavy, dodge and ability presses are buffered for `input.bufferMs`
  (about 120 ms). A press made shortly before an action becomes possible fires on the first tick it
  is: an ability pressed during a light's active frames comes out on its first recovery tick.
  - The latest press wins.
  - Buffered presses don't age during hitstop.
  - A buffered light waits for the chain point without aging, so it never expires in the gap
    between the first recovery tick and the chain point, even when `lightChainMs` is longer than
    `bufferMs`.
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
- **Heavy, the Hook-thrust:** a straight thrust. Its hitbox is a **rectangle**
  `heavy.thrust.lengthPx` long (from the player's center along the aim) and `heavy.thrust.widthPx`
  wide, against each Husk's circle, not a cone: what stands beside the line is missed.
  - **Tap:** released before `heavy.charge.minMs` of hold. Timing `heavy.tap.*`; damage is
    `heavy.tap.damageFactor` × the first light hit's damage; poise (shell) damage
    `heavy.tap.shellDamage`.
  - **Charge:** hold from `heavy.charge.minMs` to `heavy.charge.maxMs`, moving at
    `chargeMoveFactor`; the charge caps at the window and holding longer keeps it there. Release
    timing `heavy.charged.*`; damage scales linearly across the window from
    `damageFactorMin` to `damageFactorMax` × the first light hit, poise from `shellDamageMin` to
    `shellDamageMax`, shake likewise. **Armor frames once fully charged** (§3).
  - **On hit:** knockback is `heavy.knockbackPx` (0): the target is **held** on the hook for
    `heavy.holdMs`, frozen in place, then shoved `heavy.shovePx` along the thrust (a knockback, so
    weight-scaled: a Nutshell is held but never moves). Hitstop `heavy.hitstopMs` for both sides,
    then the hold counts. The hold interrupts whatever the Husk was doing, shell or not; a hold
    that broke a shell layer ends in that layer's stagger, otherwise the Husk goes back to chasing
    after a short cooldown. Lights on a held Husk don't end the hold (a break does).
  - Charge shows as three stage pips under the player and in the HUD: none while the hold is still
    a tap, then the window in thirds, all lit (and armored) at full.
- **Three ability slots** (`abilities[]`). Each slot is a full move: `startupMs`/`activeMs`/
  `recoveryMs`, its **own** `cooldownMs`, armor frames, and its hit (`hitRadiusPx`, `damage`,
  `shellDamage`, `knockbackPx`, `hitstopMs`, `shake`). There is **no mana or energy**: cooldowns are
  the only limit.
  - `kind` says how the sim runs it: `haul` (the hook, below, with its `haul` block), `spin`
    (hitting everything within `hitRadiusPx` without moving) or `none`. The old `dash-strike`
    (Lunge) is gone; its displacement code now pulls the player along the Haul's chain.
  - A `locked` slot exists in data and in the HUD but never executes; its press is swallowed.

**Hookblade** (the only weapon so far):

- **Light:** a 3-hit melee arc chain. The third hit is stronger, with more damage and knockback, a
  wider arc and longer hitstop.
- **Heavy:** the Hook-thrust above; the shell breaker.
- **Slot 1, "Haul":** fires the hook (`kind: haul`).
  - **Targeting:** on launch, the nearest hittable Husk inside a cone of `haul.coneDeg` around the
    aim and within `haul.rangePx` is locked and the hook flies at it; with nothing in the cone it
    flies along the aim. It travels at `haul.speed` for at most `activeMs`, never beyond the range,
    and stops at the **first** Husk its head (`hitRadiusPx`) touches, or at a wall (a miss).
    Only Husks are ever candidates: the Kindled, allies and pickups are never hooked. The head is
    `hitRadiusPx` wide (5 since Playtest 2, up from 4, so a hook thrown a touch off still lands).
  - **On hit:** the ability's damage/poise/hitstop land, then the pull by weight class:
    - **light:** the Husk slides along the chain to `haul.pullLightPx` from the player;
    - **medium:** `haul.pullMedium` of that distance;
    - **heavy:** the chain pulls the **player** instead, at the ability's `speed`, to
      `haul.playerPullDistancePx` from the Husk, with `haul.arrivalArmorMs` of armor on arrival.
      The Husk never moves.

    The target is staggered for `haul.staggerMs` (light/medium) or `haul.staggerHeavyMs` (heavy).
    These are the Haul's own per-class keys; `husks.weightClasses` scales knockback and shoves,
    not this pull. The pull extends the ability's active phase; recovery starts once the chain lets
    go.

  - **Combo step:** a light pressed within `haul.comboWindowMs` after the chain lets go starts at
    combo hit 3. Only a dodge cancels the Haul's recovery (§4), so in practice the press is
    buffered in the last part of the recovery, or made just after it.
  - **Cooldown** `cooldownMs` (8 s). A miss (range, wall, nothing hit) refunds `haul.missRefund` of
    it at once.
- **Slots 2 and 3, "The Catch" and "Turning Blade":** in data, locked placeholders. On a gamepad
  their face buttons only fire during an encounter.

## 6. Hits, hitstop, knockback, weight, poise

- **Hitstop** freezes attacker and target for the hit's `hitstopMs`:
  - light about 50 ms, the third hit and the Haul a bit more;
  - the Hook-thrust `heavy.hitstopMs` (120 ms), tap or charged, before the hold.

  It is per entity, in the sim: other Husks keep moving.
  **One swing freezes once.** When a swing (light, heavy or ability) hits several Husks, in the
  same tick or over its active frames, the player's hitstop plays once at the level of the
  **strongest** hit, never summed: a stronger later hit only tops the freeze up to its own level,
  a weaker one adds nothing. Every Husk the swing struck freezes at that same level.

- **Knockback is a distance.** A hit's `knockbackPx` is how far it pushes a **light**-class enemy,
  away from the attacker; a pull is the same push aimed at the attacker. The push is a short slide
  over `husks.knockbackMs` that starts when the target's hitstop ends, and walls stop it.
- **Weight classes.** Each enemy has a `weightClass`, and `husks.weightClasses` scales every
  knockback and shove by class: **light** moves the full distance (1), **medium** half (0.5),
  **heavy** not at all (0). The Haul's pull goes by class too, from its own keys (§5), and a heavy
  class turns the pull around onto the player. Starting values, both tunable: the Peeling is
  light, the Nutshell heavy.
- **Husk shells are armor-poise.** A Husk is a hollow shell (1–2 layers) around a bright core.
  - **Layer holds:** hits only chip the outermost layer. The Husk keeps attacking (super armor) and
    knockback is reduced (`armoredKnockbackFactor`).
  - **Layer breaks:** the Husk is **staggered** (`staggerMs`), which interrupts any wind-up or
    attack. Only `husks.shellBreakCoreFactor` of that hit's core damage lands.
  - **Shell gone:** core hits deal full damage and **flinch** (`flinchMs`), which also interrupts.
  - The **heavy** has high `shellDamage` (poise damage): it is the shell breaker. **Lights** are
    for the core.
  - **Regrow:** the Nutshell's inner layer regrows to full `husks.nutshell.innerRegrowMs` after the
    Husk was last hit, unless it was broken (0 stays 0). The outer layer never regrows. Both
    layers show as their own poise bar.
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
  - **+`sparkglassBonus` Sparkglass** (the "Sparkglass flare");
  - **`cooldownRefundMs` off every ability cooldown** (never below zero).
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
- **Nutshell** (heavy class): slow, with two shell layers (outer `shell[0]`, inner `shell[1]`,
  30 and 20) that crack separately; the inner one regrows (§6). Knockback never moves it; a Haul
  pulls the player to it instead.
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
  | `C`      | chest        |

- **Waves:** each room has its waves in `run.rooms[i].waves`. The door opens when the last wave is
  dead, and walking into it loads the next room. Room 3 is the tough one, with Nutshells.
- **Chests:** every room has one (`C`). A chest is solid (§2). It opens when the Kindled touches
  it, its edge within `run.chestOpenReachPx` of the chest's edge, at any time; it spills its items
  and stays standing with its lid open, **still solid**. Its contents are **scripted by the order
  chests are opened in the run**: `run.chests[n]` for the n-th chest, clamped to the last entry (the
  first chest gives 2 Rations). Room templates keep two tiles of floor clear all round every `C`
  (`CHEST_CLEAR_TILES`, `packages/shared/src/rooms.ts`), so a chest never closes a corridor;
  `packages/shared/test/rooms.test.ts` reports the templates that break it (GAME DESIGN owns the
  layouts).
- **End of a run:** death, or clearing room 3.
  - Sparkglass kept: 100% on a clear, `run.sparkglassKeptOnDeath` (50%) on death.
  - The results screen shows time, rooms, kills, perfect dodges and Sparkglass found/kept.

## 10. Consumables

Two item slots (`consumables.slots`), keyboard Q and F, gamepad D-pad left/right. Using an item is
instant (no move, not buffered, any time but dead); a press on an empty slot does nothing. Items
only come from chests for now, and they go onto a stack of the same item first (capped at its
`stackMax`), else into an empty slot.

- **Ration** (`consumables.ration`): heals `healFraction` of max HP spread evenly over `durationMs`
  (the heal pauses with hitstop, like everything else), never past max HP. Using another while one
  runs adds its heal to the pool and restarts the clock. Stacks to `stackMax` (5).

## 11. Feel toolkit (presentation)

The client adds juice from `tuning.json` → `juice`. None of it affects the sim. Colors and shapes
follow [`readability.md`](readability.md).

- Scaled screen shake, using the hit's `shake`.
- Hit flash: the struck target turns white for `juice.hitFlashFrames` (1–2) frames.
- Chipped-pixel shell particles, plus a ring and "CRACK"/"BREAK" when a layer breaks.
- Core flare on death.
- Perfect-dodge afterimage trail, flare and a tint during slow-mo.
- Slash crescents for lights; the thrust line and the drawn-back charge stance with the growing
  hook-tip pixel for the heavy; the Haul chain (links, hook glyph, taut on a hit).
- The charge meter under the player.
- Camera lead toward the aim.
- Render interpolation between ticks.

**Hitstop and slow-mo:**

- **Hitstop** is simulated: frozen entities.
- **Slow-mo** is the client stepping the sim more slowly in real time. The sim only counts down
  `slowmo` ticks, so replays are unaffected.

## 12. Tuning workflow

- **F2** opens the tuning panel: a slider for every numeric value in `tuning.json` (all move
  timings, cooldowns, armor windows, weight-class multipliers, the thrust, the Haul, the
  consumables, the Nutshell's layers and regrow, the soft-lock angles, …), a select for enums (an
  enemy's `weightClass`, an ability's `kind`), read-only flags (`locked`), and the gamepad preset.
  - Changes apply live and are recorded into the current run's record, so the run still replays.
  - New runs take the current values as their config.
  - **Export JSON** copies the values in the file's exact shape to paste over `tuning.json`.
- **F3** shows FPS, tick, entity count, seed, the last input, and the state hash.
