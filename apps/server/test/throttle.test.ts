import { describe, expect, it } from 'vitest';
import { LoginThrottle } from '../src/auth/throttle.js';

const MIN = 60_000;

describe('LoginThrottle', () => {
  const opts = { maxFailures: 3, windowMs: 15 * MIN, lockMs: 15 * MIN };

  it('locks a username on its 3rd failure inside the window, for the lock time', () => {
    const t = new LoginThrottle(opts);
    t.fail('mira', 0);
    t.fail('mira', MIN);
    expect(t.isLocked('mira', MIN)).toBe(false);
    t.fail('mira', 2 * MIN);
    expect(t.isLocked('mira', 2 * MIN)).toBe(true);
    expect(t.isLocked('mira', 2 * MIN + 15 * MIN - 1)).toBe(true);
    expect(t.isLocked('mira', 2 * MIN + 15 * MIN)).toBe(false);
    // Other usernames are untouched.
    expect(t.isLocked('ash', 2 * MIN)).toBe(false);
  });

  it('forgets failures older than the window', () => {
    const t = new LoginThrottle(opts);
    t.fail('mira', 0);
    t.fail('mira', 2 * MIN);
    t.fail('mira', 16 * MIN); // the first has left the window, the second not
    expect(t.isLocked('mira', 16 * MIN)).toBe(false);
    t.fail('mira', 16 * MIN + 1);
    expect(t.isLocked('mira', 16 * MIN + 1)).toBe(true);
  });

  it('starts counting afresh after a lock and after a success', () => {
    const t = new LoginThrottle(opts);
    for (let i = 0; i < 3; i++) t.fail('mira', i);
    const after = 2 + 15 * MIN;
    expect(t.isLocked('mira', after)).toBe(false);
    t.fail('mira', after);
    expect(t.isLocked('mira', after)).toBe(false);
    t.fail('ash', 0);
    t.fail('ash', 1);
    t.succeed('ash');
    t.fail('ash', 2);
    expect(t.isLocked('ash', 2)).toBe(false);
  });

  it('stays bounded, and a flood of made-up names never lifts a lock', () => {
    const t = new LoginThrottle({ ...opts, maxTracked: 100 });
    for (let i = 0; i < 3; i++) t.fail('target', i);
    for (let i = 0; i < 1000; i++) t.fail(`spray${i}`, 10);
    expect(t.size).toBeLessThanOrEqual(100);
    expect(t.isLocked('target', 10)).toBe(true);
  });
});
