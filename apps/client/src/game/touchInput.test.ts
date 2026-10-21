import { describe, expect, it } from 'vitest';
import { TouchInput, touchSample } from './touchInput.js';
import { ABILITY_CONTROLS, touchLayout, type TouchControl, type TouchLayout } from './touchLayout.js';

/** The iPhone's UI grid (844 × 390 CSS @ 3: 633 × 292 UI px, 4/3 CSS px per UI px), the run's controls with no HUD in the way. */
const layout: TouchLayout = touchLayout({ w: 633, h: 292, cssPerUi: 4 / 3 }, { mode: 'run', abilities: ABILITY_CONTROLS });
const at = (id: string): TouchControl => {
  const c = layout.controls.find((k) => k.id === id);
  if (!c) throw new Error(id);
  return c;
};
const world = { overHud: false, stick: true };
const DEADZONE = 0.2;

describe('touch input: when each button fires', () => {
  it('LIGHT fires on press, is sent every tick while held, and its release fires nothing (GAME DESIGN, 2026-10-21)', () => {
    const t = new TouchInput(layout);
    const light = at('light');
    expect(t.down(1, light.cx, light.cy, 0, world)).toEqual({ kind: 'control', id: 'light' });
    // The first hit on the press itself, then held: the sim keeps attacking at the chain's pace.
    expect([...t.take().presses]).toEqual(['light']);
    expect([...t.take().presses]).toEqual(['light']);
    expect([...t.take().presses]).toEqual(['light']);
    t.up(1, light.cx, light.cy, 500);
    // The release only stops.
    expect([...t.take().presses]).toEqual([]);
    // A quick tap between two ticks: one hit, on the next tick.
    t.down(2, light.cx, light.cy, 600, world);
    t.up(2, light.cx, light.cy, 610);
    expect([...t.take().presses]).toEqual(['light']);
    expect([...t.take().presses]).toEqual([]);
  });

  it('DODGE fires on press; the item slots on press', () => {
    const t = new TouchInput(layout);
    const dodge = at('dodge');
    t.down(1, dodge.cx, dodge.cy, 0, world);
    expect([...t.take().presses]).toEqual(['dodge']);
    t.up(1, dodge.cx, dodge.cy, 50);
    expect([...t.take().presses]).toEqual([]);
    const item = at('item1');
    t.down(2, item.cx, item.cy, 60, world);
    expect([...t.take().presses]).toEqual(['item1']);
  });

  it('HEAVY is held from the touch down to the release, and a quick tap still holds one tick', () => {
    const t = new TouchInput(layout);
    const heavy = at('heavy');
    t.down(1, heavy.cx, heavy.cy, 0, world);
    expect(t.take().heavy).toBe(true);
    expect(t.take().heavy).toBe(true);
    t.up(1, heavy.cx, heavy.cy, 500);
    expect(t.take().heavy).toBe(false);
    // Down and up between two ticks: the charge still starts on the next tick, and lets go on the one after.
    t.down(2, heavy.cx, heavy.cy, 600, world);
    t.up(2, heavy.cx, heavy.cy, 610);
    expect(t.take().heavy).toBe(true);
    expect(t.take().heavy).toBe(false);
  });

  it('an ability fires on release, aimed like LIGHT', () => {
    const t = new TouchInput(layout);
    const haul = at('ability1');
    t.down(1, haul.cx, haul.cy, 0, world);
    t.move(1, haul.cx - 60, haul.cy);
    expect(t.take().aim).toBeCloseTo(Math.PI);
    t.up(1, haul.cx - 60, haul.cy, 300);
    const tick = t.take();
    expect([...tick.presses]).toEqual(['ability1']);
    expect(tick.aim).toBeCloseTo(Math.PI);
  });

  it('USE presses interact and the gear reports itself on a release still on the button; dragged off, nothing', () => {
    const t = new TouchInput(layout);
    const use = at('use');
    t.down(1, use.cx, use.cy, 0, world);
    expect(t.up(1, use.cx, use.cy, 50)).toEqual({ kind: 'control', id: 'use' });
    expect([...t.take().presses]).toEqual(['interact']);
    const gear = at('gear');
    t.down(2, gear.cx, gear.cy, 0, world);
    expect(t.up(2, gear.cx, gear.cy + 3, 50)).toEqual({ kind: 'control', id: 'gear' });
    t.down(3, gear.cx, gear.cy, 0, world);
    expect(t.up(3, gear.cx - 200, gear.cy + 100, 50)).toEqual({ kind: 'none' });
  });

  it('one finger owns one control: a second finger on a held button does nothing', () => {
    const t = new TouchInput(layout);
    const light = at('light');
    t.down(1, light.cx, light.cy, 0, world);
    expect([...t.take().presses]).toEqual(['light']);
    expect(t.down(2, light.cx + 2, light.cy, 10, world).kind).toBe('hud');
    t.up(2, light.cx + 2, light.cy, 20);
    // Still held by the first finger: the second one's lift stops nothing.
    expect([...t.take().presses]).toEqual(['light']);
    t.up(1, light.cx, light.cy, 30);
    expect([...t.take().presses]).toEqual([]);
  });
});

describe('touch input: the aim', () => {
  const enemies = [{ id: 7, dx: 100, dy: 20 }];

  it("a tap that never left the button fires at the soft lock: the stick's direction snapped onto an enemy within 20°", () => {
    const t = new TouchInput(layout);
    // The stick held right.
    t.down(1, 60, 200, 0, world);
    t.move(1, 60 + 40, 200);
    const light = at('light');
    t.down(2, light.cx, light.cy, 10, world);
    t.move(2, light.cx + 3, light.cy + 2);
    t.up(2, light.cx + 3, light.cy + 2, 90);
    const tick = touchSample(t, enemies, 20, DEADZONE);
    expect([...tick.presses]).toEqual(['light']);
    expect(tick.aim).toBeCloseTo(Math.atan2(20, 100));
    expect(tick.lockTarget).toBe(7);
    expect(tick.move?.x).toBeCloseTo(1);
    // Outside the angle: the move direction itself.
    const far = touchSample(t, [{ id: 8, dx: 0, dy: 100 }], 20, DEADZONE);
    expect(far.aim).toBeCloseTo(0);
    expect(far.lockTarget).toBe(-1);
  });

  it('LIGHT held and dragged off aims each next hit in the drag direction; the release only stops', () => {
    const t = new TouchInput(layout);
    t.down(1, 60, 200, 0, world);
    t.move(1, 100, 200);
    const light = at('light');
    t.down(2, light.cx, light.cy, 0, world);
    // Within aimDragCssPx of the centre: not a drag yet (the soft lock aims).
    t.move(2, light.cx - layout.aimDrag + 1, light.cy);
    const first = touchSample(t, enemies, 20, DEADZONE);
    expect([...first.presses]).toEqual(['light']);
    expect(first.aim).toBeCloseTo(Math.atan2(20, 100));
    // Past it, straight up: the aim is the drag's, the lock lets go, and LIGHT is still held.
    t.move(2, light.cx, light.cy - 50);
    const held = touchSample(t, enemies, 20, DEADZONE);
    expect(held.aim).toBeCloseTo(-Math.PI / 2);
    expect(held.lockTarget).toBe(-1);
    expect([...held.presses]).toEqual(['light']);
    // Dragged round to the up-left: the next hit goes there.
    t.move(2, light.cx - 50, light.cy - 50);
    expect(touchSample(t, enemies, 20, DEADZONE).aim).toBeCloseTo((-3 * Math.PI) / 4);
    t.up(2, light.cx - 50, light.cy - 50, 400);
    // The release fires nothing and leaves no aim of its own: back to the soft lock.
    const after = touchSample(t, enemies, 20, DEADZONE);
    expect([...after.presses]).toEqual([]);
    expect(after.aim).toBeCloseTo(Math.atan2(20, 100));
  });

  it('HEAVY pressed, dragged and released fires its thrust in the drag direction', () => {
    const t = new TouchInput(layout);
    const heavy = at('heavy');
    t.down(1, heavy.cx, heavy.cy, 0, world);
    t.move(1, heavy.cx, heavy.cy + 40);
    const charging = touchSample(t, [], 20, DEADZONE);
    expect(charging.heavy).toBe(true);
    expect(charging.aim).toBeCloseTo(Math.PI / 2);
    t.up(1, heavy.cx, heavy.cy + 40, 700);
    const release = touchSample(t, [], 20, DEADZONE);
    expect(release.heavy).toBe(false);
    expect(release.aim).toBeCloseTo(Math.PI / 2);
  });

  it('standing still keeps the previous aim; a lock on a Husk that is gone lets go', () => {
    const t = new TouchInput(layout);
    const still = touchSample(t, enemies, 20, DEADZONE, 7);
    expect(still.aim).toBeNull();
    expect(still.lockTarget).toBeUndefined();
    expect(still.move).toBeNull();
    expect(touchSample(t, [], 20, DEADZONE, 7).lockTarget).toBe(-1);
  });

  it('the stick anchors on the left half, releases with the finger, and a still, short touch is a tap', () => {
    const t = new TouchInput(layout);
    expect(t.down(1, 80, 150, 0, world)).toEqual({ kind: 'stick' });
    t.move(1, 80, 150 - 200);
    const s = t.stick();
    expect(s?.anchor).toEqual({ x: 80, y: 150 });
    expect(s?.knob.y).toBeCloseTo(150 - layout.stickRadius);
    expect(t.up(1, 80, -50, 900)).toEqual({ kind: 'none' });
    expect(t.stick()).toBeNull();
    // A left-half tap is a tap too (tap to walk anywhere on the world).
    t.down(2, 80, 150, 1000, world);
    expect(t.up(2, 81, 151, 1100)).toEqual({ kind: 'tap', x: 80, y: 150 });
    // A right-half drag is not.
    t.down(3, 400, 100, 2000, world);
    t.move(3, 440, 100);
    expect(t.up(3, 400, 100, 2050)).toEqual({ kind: 'none' });
  });
});
