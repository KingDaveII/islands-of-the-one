import { Rng } from './rng.js';

/**
 * Placeholder deterministic simulation. The real game sim will grow here;
 * for M0 it only proves the contract: same seed + same inputs => same state.
 */

export interface SimInput {
  tick: number;
  /** Arbitrary integer command, e.g. an encoded player action. */
  command: number;
}

export interface SimState {
  tick: number;
  rngState: number;
  value: number;
}

export function createSim(seed: number): SimState {
  return { tick: 0, rngState: new Rng(seed).getState(), value: 0 };
}

export function step(state: SimState, inputs: readonly SimInput[]): SimState {
  const rng = Rng.fromState(state.rngState);
  let value = state.value;
  for (const input of inputs) {
    if (input.tick !== state.tick) continue;
    value = (value + input.command * rng.int(1, 6)) | 0;
  }
  value = (value + rng.int(0, 9)) | 0;
  return { tick: state.tick + 1, rngState: rng.getState(), value };
}

/** Run a full replay from a seed and an input log. */
export function replay(seed: number, ticks: number, inputs: readonly SimInput[]): SimState {
  let state = createSim(seed);
  for (let i = 0; i < ticks; i++) {
    state = step(state, inputs);
  }
  return state;
}

/** Stable hash of a sim state (FNV-1a over its integer fields). */
export function hashState(state: SimState): number {
  let h = 0x811c9dc5;
  for (const n of [state.tick, state.rngState, state.value]) {
    h = Math.imul(h ^ (n >>> 0), 0x01000193) >>> 0;
  }
  return h;
}
