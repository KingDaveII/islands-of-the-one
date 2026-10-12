import { defaultTuning, roomTemplates } from '@iot/shared';
import { createRun, SUB, type RunState } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { interactables, promptTarget, type Interactable } from './interact.js';

function state(): RunState {
  return createRun({ seed: 1, tuning: defaultTuning, rooms: roomTemplates, weapon: 'hookblade' }).state;
}

describe('the interact prompt', () => {
  it('has nothing to prompt for in M1: chests open on contact and are never interactables', () => {
    const s = state();
    expect(s.chests.length).toBeGreaterThan(0);
    expect(interactables()).toEqual([]);
    expect(promptTarget(s, 1000 * SUB)).toBeNull();
  });

  it('shows the nearest interactable in reach in Calm only', () => {
    const s = state();
    const p = s.player;
    const near: Interactable = { x: p.x + 20 * SUB, y: p.y, label: 'TAKE' };
    const far: Interactable = { x: p.x + 30 * SUB, y: p.y, label: 'READ' };
    const out: Interactable = { x: p.x + 200 * SUB, y: p.y, label: 'NO' };
    expect(s.context).toBe('calm');
    expect(promptTarget(s, 40 * SUB, [out, far, near])).toBe(near);
    expect(promptTarget(s, 25 * SUB, [out, far, near])).toBe(near);
    expect(promptTarget(s, 10 * SUB, [out, far, near])).toBeNull();
    s.context = 'combat';
    expect(promptTarget(s, 40 * SUB, [out, far, near])).toBeNull();
    s.context = 'calm';
    s.player.action = 'dead';
    expect(promptTarget(s, 40 * SUB, [near])).toBeNull();
  });
});
