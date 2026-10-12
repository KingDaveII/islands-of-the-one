import { roomTemplates } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  autopilot,
  BUTTON_MASK,
  createRun,
  decodeInput,
  encodeInput,
  hashRunState,
  isAwakeHostile,
  replayRun,
  stepRun,
  type SimEvent,
} from '../src/index.js';
import { addHusk, arena, Button, input, step, steps, stepUntil, tuning, WEAPON } from './helpers.js';

/**
 * The input context (docs/design/controls.md): Combat while a hostile is
 * awake, Calm `input.calmDelayMs` after the last one dies. The sim computes
 * it as part of its state, so the client resolves buttons with it and the
 * input log replays exactly.
 */
describe('input context', () => {
  it('starts Calm, turns Combat the tick a hostile is awake, and Calm calmDelayMs after the last dies', () => {
    const run = arena();
    const s = run.state;
    expect(s.context).toBe('calm');
    expect(run.params.calmDelayTicks).toBe(30);

    // A spawning Husk is not awake yet.
    const h = addHusk(run, 'peeling', 60, { action: 'spawn', t: 0 });
    expect(isAwakeHostile(h)).toBe(false);
    let events = step(run);
    expect(s.context).toBe('calm');
    expect(events.filter((e) => e.type === 'context')).toEqual([]);

    // It wakes (chase): Combat the same tick.
    events = stepUntil(run, () => h.action !== 'spawn', 120);
    expect(s.context).toBe('combat');
    expect(events.filter((e) => e.type === 'context')).toEqual([{ type: 'context', context: 'combat' }]);

    // Kill it: Combat holds for the calm delay, then Calm.
    h.core = 0;
    step(run);
    expect(s.husks).toEqual([]);
    expect(s.context).toBe('combat');
    expect(s.calmTimer).toBe(run.params.calmDelayTicks - 1);
    events = steps(run, run.params.calmDelayTicks - 2);
    expect(s.context).toBe('combat');
    expect(events.filter((e) => e.type === 'context')).toEqual([]);
    events = step(run);
    expect(s.context).toBe('calm');
    expect(s.calmTimer).toBe(0);
    expect(events.filter((e) => e.type === 'context')).toEqual([{ type: 'context', context: 'calm' }]);

    // A second hostile waking turns it Combat again at once (no delay the other way).
    addHusk(run, 'nutshell', 80);
    step(run);
    expect(s.context).toBe('combat');
    expect(s.calmTimer).toBe(run.params.calmDelayTicks);
  });

  it('a hostile dying and another waking within the delay keeps Combat with the timer reset', () => {
    const run = arena();
    const s = run.state;
    const a = addHusk(run, 'peeling', 60);
    step(run);
    expect(s.context).toBe('combat');
    a.core = 0;
    steps(run, 10);
    expect(s.context).toBe('combat');
    addHusk(run, 'peeling', 60);
    steps(run, 40);
    expect(s.context).toBe('combat');
    expect(s.calmTimer).toBe(run.params.calmDelayTicks);
  });

  it('the calm delay is tuning (0 = Calm the tick after the last hostile dies)', () => {
    const t = JSON.parse(JSON.stringify(tuning)) as typeof tuning;
    t.input.calmDelayMs = 0;
    const run = arena(t);
    const h = addHusk(run, 'peeling', 60);
    step(run);
    expect(run.state.context).toBe('combat');
    h.core = 0;
    step(run);
    expect(run.state.context).toBe('calm');
  });

  it('the context and timer are part of the hashed state', () => {
    const a = arena();
    const b = arena();
    addHusk(a, 'peeling', 60);
    addHusk(b, 'peeling', 60);
    step(a);
    step(b);
    expect(hashRunState(a.state)).toBe(hashRunState(b.state));
    b.state.context = 'calm';
    expect(hashRunState(a.state)).not.toBe(hashRunState(b.state));
    b.state.context = 'combat';
    b.state.calmTimer = 1;
    expect(hashRunState(a.state)).not.toBe(hashRunState(b.state));
  });

  it('replays the switch in both directions: same inputs => same context trace and hash', () => {
    const run = createRun({ seed: 77, tuning, rooms: roomTemplates, weapon: WEAPON });
    const trace: [number, string][] = [];
    const record = (events: SimEvent[]) => {
      for (const e of events) if (e.type === 'context') trace.push([run.state.tick, e.context]);
    };
    // Through the first wave (Calm → Combat → Calm between waves → Combat ...).
    for (let i = 0; i < 60 * 40 && run.state.status === 'playing'; i++) {
      record(stepRun(run, autopilot(run.state, run.params)));
      if (trace.length >= 4) break;
    }
    expect(trace.map(([, c]) => c)).toEqual(['combat', 'calm', 'combat', 'calm']);
    // The Calm switch comes calmDelayTicks after the last kill, never sooner.
    const calmAt = trace[1]?.[0] ?? 0;
    const combatAt = trace[0]?.[0] ?? 0;
    expect(calmAt - combatAt).toBeGreaterThan(run.params.calmDelayTicks);

    const again = replayRun(run.record);
    const replayTrace: [number, string][] = [];
    const replay = createRun({ seed: 77, tuning, rooms: roomTemplates, weapon: WEAPON });
    for (const packed of run.record.inputs) {
      for (const e of stepRun(replay, packed)) if (e.type === 'context') replayTrace.push([replay.state.tick, e.context]);
    }
    expect(replayTrace).toEqual(trace);
    expect(hashRunState(again.state)).toBe(hashRunState(run.state));
    expect(again.state.context).toBe(run.state.context);
  });
});

describe('the Interact button', () => {
  it('packs as bit 8 of the buttons and survives the uint32 round trip', () => {
    expect(Button.Interact).toBe(256);
    expect(BUTTON_MASK).toBe(0x1ff);
    const packed = encodeInput({ aim: 4095, moveDir: 255, moveMag: 7, buttons: Button.Interact | Button.Light });
    expect(packed).toBeGreaterThan(0);
    expect(decodeInput(packed)).toEqual({ aim: 4095, moveDir: 255, moveMag: 7, buttons: Button.Interact | Button.Light });
  });

  it('is accepted in Calm (an interact event) and ignored in Combat', () => {
    const run = arena();
    expect(run.state.context).toBe('calm');
    const calm = stepRun(run, input(Button.Interact));
    expect(calm).toContainEqual({ type: 'interact', x: run.state.player.x, y: run.state.player.y });

    // Two identical runs in Combat: one presses Interact, the other nothing. Their states stay the same.
    const twin = arena();
    stepRun(twin, input(Button.Interact));
    addHusk(run, 'peeling', 80);
    addHusk(twin, 'peeling', 80);
    step(run);
    step(twin);
    expect(run.state.context).toBe('combat');
    expect(hashRunState(twin.state)).toBe(hashRunState(run.state));
    const combat = stepRun(run, input(Button.Interact));
    step(twin);
    expect(combat.filter((e) => e.type === 'interact')).toEqual([]);
    expect(hashRunState(twin.state)).toBe(hashRunState(run.state));
  });
});
