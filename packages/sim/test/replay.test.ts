import { describe, expect, it } from 'vitest';
import { createSim, hashState, replay, step, type SimInput } from '../src/index.js';

const inputs: SimInput[] = [
  { tick: 0, command: 3 },
  { tick: 5, command: -2 },
  { tick: 5, command: 7 },
  { tick: 42, command: 1 },
];

describe('replay', () => {
  it('is deterministic: same seed + inputs => identical state', () => {
    const a = replay(1234, 100, inputs);
    const b = replay(1234, 100, inputs);
    expect(a).toEqual(b);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('matches step-by-step execution', () => {
    let state = createSim(1234);
    for (let i = 0; i < 100; i++) state = step(state, inputs);
    expect(state).toEqual(replay(1234, 100, inputs));
  });

  it('diverges with a different seed or input log', () => {
    const base = hashState(replay(1234, 100, inputs));
    expect(hashState(replay(4321, 100, inputs))).not.toBe(base);
    expect(hashState(replay(1234, 100, inputs.slice(1)))).not.toBe(base);
  });

  it('is pinned to a golden hash', () => {
    expect(hashState(replay(1234, 100, inputs))).toMatchInlineSnapshot(`3911552742`);
  });
});
