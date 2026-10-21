import { softLockPick, type LockCandidate } from './gamepad.js';
import { isTap, stickKnob, stickVector, touchZone, type TouchControlId, type TouchLayout, type TouchZone } from './touchLayout.js';

/**
 * Touches turned into the sampler's input (M2 Task 10, docs/design/controls.md
 * §6), pure so it is tested in node. ui/touchControls.ts feeds it the
 * pointer events (UI px, a clock in ms) and `Controls.sample` reads it once
 * per tick through `touchSample`, as it reads a pad: one finger owns one
 * control until it lifts, presses are latched between ticks (controls.md §4).
 *
 * When each fires: LIGHT on **press** and held while the finger stays down
 * (the sim keeps attacking at the chain's own pace; a drag aims each next
 * hit; the release only stops, GAME DESIGN 2026-10-21), an ability on
 * **release** (aimed by the drag if the finger left the button, else by the
 * soft lock), HEAVY **held** from the touch down to the release (the charge
 * starts on press, the drag aims it, the release fires it, like a held R2),
 * DODGE and the item slots on **press**, USE and the gear on a release still
 * on the button.
 */

/** What a finger is doing. */
type Finger =
  | { kind: 'stick'; anchor: Pt; at: Pt; down: Timed; travelled: number }
  | { kind: 'control'; id: TouchControlId; centre: Pt; at: Pt; dragged: boolean; down: Timed; travelled: number }
  | { kind: 'tap'; down: Timed; at: Pt; travelled: number }
  | { kind: 'none' };

interface Pt {
  x: number;
  y: number;
}
interface Timed extends Pt {
  t: number;
}

/** The sampler's actions a touch control can press (USE is the interact press). */
export type TouchPress = 'light' | 'dodge' | 'ability1' | 'ability2' | 'ability3' | 'item1' | 'item2' | 'interact';

/** The controls that aim: a drag off them aims, a tap fires at the soft lock. */
const AIMING: ReadonlySet<TouchControlId> = new Set(['light', 'heavy', 'ability1', 'ability2', 'ability3']);
/** Fired on release. */
const ON_RELEASE: ReadonlySet<TouchControlId> = new Set(['ability1', 'ability2', 'ability3']);
/** Fired on press (LIGHT is also sent every tick it is held, see `take`). */
const ON_PRESS: Partial<Record<TouchControlId, TouchPress>> = { light: 'light', dodge: 'dodge', item1: 'item1', item2: 'item2' };

/** What a finger's release came to, for the layer: a tap on the world, a control let go on itself, or nothing. */
export type TouchRelease = { kind: 'tap'; x: number; y: number } | { kind: 'control'; id: TouchControlId } | { kind: 'none' };

export class TouchInput {
  private fingers = new Map<number, Finger>();
  /** Presses since the last sample. */
  private latched = new Set<TouchPress>();
  /** HEAVY went down since the last sample: held for at least one tick, so a quick tap still charges and fires. */
  private heavyLatched = false;
  /** The aim of a dragged button let go since the last sample: the tick it fires on aims there. */
  private releaseAim: number | null = null;
  /**
   * The Kindled's facing on touch: the stick's last direction (radians, screen axes), kept while standing still. A tap
   * fires this way (soft-locked), never at a stale aim a dragged attack or a lock left behind (David's playtest,
   * 2026-10-21). Null until the stick has moved.
   */
  facing: number | null = null;

  constructor(public layout: TouchLayout) {}

  /**
   * A finger down at (x, y) UI px at `t` ms. `overHud` says an interactive
   * object of the scene is under it; `stick` whether a stick may anchor
   * (none while a panel is open); `showing` which controls are drawn.
   */
  down(
    id: number,
    x: number,
    y: number,
    t: number,
    opts: { overHud: boolean; stick: boolean; showing?: (id: TouchControlId) => boolean },
  ): TouchZone {
    if (this.fingers.has(id)) this.cancel(id);
    const zone = touchZone(this.layout, x, y, opts);
    const at = { x, y };
    const down = { x, y, t };
    if (zone.kind === 'control') {
      // One finger per control: a second finger on a held control does nothing.
      if ([...this.fingers.values()].some((f) => f.kind === 'control' && f.id === zone.id)) {
        this.fingers.set(id, { kind: 'none' });
        return { kind: 'hud' };
      }
      const c = this.layout.controls.find((k) => k.id === zone.id);
      this.fingers.set(id, { kind: 'control', id: zone.id, centre: { x: c?.cx ?? x, y: c?.cy ?? y }, at, dragged: false, down, travelled: 0 });
      const press = ON_PRESS[zone.id];
      if (press) this.latched.add(press);
      if (zone.id === 'heavy') this.heavyLatched = true;
    } else if (zone.kind === 'stick') {
      // Only one stick: a second left-half finger is a tap candidate.
      if ([...this.fingers.values()].some((f) => f.kind === 'stick')) this.fingers.set(id, { kind: 'tap', down, at, travelled: 0 });
      else this.fingers.set(id, { kind: 'stick', anchor: { x, y }, at, down, travelled: 0 });
    } else if (zone.kind === 'tap') this.fingers.set(id, { kind: 'tap', down, at, travelled: 0 });
    else this.fingers.set(id, { kind: 'none' });
    return zone;
  }

  move(id: number, x: number, y: number): void {
    const f = this.fingers.get(id);
    if (!f || f.kind === 'none') return;
    f.travelled = Math.max(f.travelled, Math.hypot(x - f.down.x, y - f.down.y));
    f.at = { x, y };
    if (f.kind === 'control' && AIMING.has(f.id) && Math.hypot(x - f.centre.x, y - f.centre.y) > this.layout.aimDrag) f.dragged = true;
  }

  /** A finger lifted at (x, y) at `t` ms. */
  up(id: number, x: number, y: number, t: number): TouchRelease {
    this.move(id, x, y);
    const f = this.fingers.get(id);
    this.fingers.delete(id);
    if (!f) return { kind: 'none' };
    const tap = (): boolean => f.kind !== 'none' && isTap(this.layout, f.down, { x, y, t }, f.travelled);
    if (f.kind === 'tap' || f.kind === 'stick') return tap() ? { kind: 'tap', x: f.down.x, y: f.down.y } : { kind: 'none' };
    if (f.kind !== 'control') return { kind: 'none' };
    // A release that fires (an ability, HEAVY) fires where the drag aimed; LIGHT's release only stops.
    if (f.dragged && (ON_RELEASE.has(f.id) || f.id === 'heavy')) this.releaseAim = this.dragAngle(f);
    if (ON_RELEASE.has(f.id)) this.latched.add(f.id as TouchPress);
    if (f.id === 'use' || f.id === 'gear') {
      const c = this.layout.controls.find((k) => k.id === f.id);
      const on = c ? Math.hypot(x - c.cx, y - c.cy) <= c.size / 2 + this.layout.tapMove : false;
      if (on && f.id === 'use') this.latched.add('interact');
      return on ? { kind: 'control', id: f.id } : { kind: 'none' };
    }
    return { kind: 'control', id: f.id };
  }

  /** Interact from outside the buttons: a tap on the prompted thing (the scene decides what it landed on). */
  pressInteract(): void {
    this.latched.add('interact');
  }

  /** A finger lost without a release (the browser cancelled it): it fires nothing. */
  cancel(id: number): void {
    this.fingers.delete(id);
  }

  /** Every finger let go without firing (the scene shut down, the layer hid, the page lost focus). */
  cancelAll(): void {
    this.fingers.clear();
    this.latched.clear();
    this.heavyLatched = false;
    this.releaseAim = null;
  }

  private dragAngle(f: Extract<Finger, { kind: 'control' }>): number {
    return Math.atan2(f.at.y - f.centre.y, f.at.x - f.centre.x);
  }

  /** The stick while a finger holds it: its anchor, knob and deflection (length ≤ 1). */
  stick(): { anchor: Pt; knob: Pt; vector: Pt } | null {
    for (const f of this.fingers.values())
      if (f.kind === 'stick') {
        const r = this.layout.stickRadius;
        return { anchor: f.anchor, knob: stickKnob(f.anchor, f.at, r), vector: stickVector(f.anchor, f.at, r) };
      }
    return null;
  }

  /** Whether a control is held down by a finger (drawn pressed). */
  held(id: TouchControlId): boolean {
    for (const f of this.fingers.values()) if (f.kind === 'control' && f.id === id) return true;
    return false;
  }

  /**
   * Where an aiming button's knob sits while a finger holds it (UI px from the button's centre): toward the finger,
   * clamped so the knob of radius `knobR` stays inside the button; null while it isn't held. The attack buttons read as
   * little sticks (David's playtest, 2026-10-21).
   */
  knobOffset(id: TouchControlId, knobR: number): Pt | null {
    if (!AIMING.has(id)) return null;
    for (const f of this.fingers.values())
      if (f.kind === 'control' && f.id === id) {
        const c = this.layout.controls.find((k) => k.id === id);
        if (!c) return null;
        const dx = f.at.x - f.centre.x;
        const dy = f.at.y - f.centre.y;
        const max = Math.max(0, c.size / 2 - knobR - 1);
        const d = Math.hypot(dx, dy);
        return d <= max || d === 0 ? { x: dx, y: dy } : { x: (dx / d) * max, y: (dy / d) * max };
      }
    return null;
  }

  /** The aim of a button being dragged off (radians, screen axes), or null. */
  dragAim(): number | null {
    for (const f of this.fingers.values()) if (f.kind === 'control' && f.dragged) return this.dragAngle(f);
    return null;
  }

  /** Whether any finger is down (the layer keeps drawing it). */
  get active(): boolean {
    return this.fingers.size > 0;
  }

  /**
   * The latched part of one tick, consumed: the presses since the last
   * sample (with LIGHT while it is held), HEAVY held (or tapped since), and
   * the aim a released drag left for this tick (else the drag in progress,
   * else null).
   */
  take(): { presses: Set<TouchPress>; heavy: boolean; aim: number | null } {
    const presses = this.latched;
    this.latched = new Set();
    if (this.held('light')) presses.add('light');
    const heavy = this.held('heavy') || this.heavyLatched;
    this.heavyLatched = false;
    const aim = this.releaseAim ?? this.dragAim();
    this.releaseAim = null;
    return { presses, heavy, aim };
  }
}

/** One tick of touch input as the sampler takes it: the move (the stick's deflection, or none), the presses, HEAVY, and the aim. */
export interface TouchTick {
  /** The stick's deflection (length ≤ 1), or null with no finger on it. */
  move: Pt | null;
  presses: Set<TouchPress>;
  heavy: boolean;
  /** The aim in radians, or null to keep the previous one (standing still, nothing dragged). */
  aim: number | null;
  /** The Husk the soft lock snapped to: its id, -1 for none, or undefined to keep the previous lock. */
  lockTarget: number | undefined;
}

/**
 * Aim by button (GAME DESIGN, controls.md §6): a button dragged off aims in
 * the drag's direction (the sampler quantizes it like the pad's right stick);
 * with none dragged the aim is the stick's direction snapped onto an enemy
 * within `softLockDeg`, and standing still the Kindled's facing (the stick's
 * last direction, `TouchInput.facing`) snapped the same way, so a tap always
 * attacks where the Kindled moves or faces, never at an aim a drag or a lock
 * left behind (David's playtest, 2026-10-21). Before the stick has moved the
 * previous aim is kept (null); a lock on a Husk that is gone lets go.
 */
export function touchSample(
  input: TouchInput,
  enemies: readonly LockCandidate[],
  softLockDeg: number,
  deadzone: number,
  lockTargetId = -1,
): TouchTick {
  const { presses, heavy, aim } = input.take();
  const stick = input.stick();
  const move = stick ? stick.vector : null;
  const moving = move !== null && Math.hypot(move.x, move.y) > deadzone;
  if (moving) input.facing = Math.atan2(move.y, move.x);
  if (aim !== null) return { move, presses, heavy, aim, lockTarget: -1 };
  // No button dragged: the move direction, or standing still the facing (the stick's last direction), soft-locked.
  const toward = moving ? Math.atan2(move.y, move.x) : input.facing;
  if (toward !== null) {
    const lock = softLockPick(toward, enemies, softLockDeg);
    return { move, presses, heavy, aim: lock.angle, lockTarget: lock.target?.id ?? -1 };
  }
  const gone = lockTargetId >= 0 && !enemies.some((e) => e.id === lockTargetId);
  return { move, presses, heavy, aim: null, lockTarget: gone ? -1 : undefined };
}
