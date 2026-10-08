import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  atan2,
  cos,
  decodeInput,
  encodeInput,
  facing8,
  isqrt,
  sin,
  TRIG_ONE,
  TURN,
} from '../src/index.js';

describe('trig tables', () => {
  it('hits exact values at the cardinal and diagonal angles', () => {
    expect([sin(0), sin(1024), sin(2048), sin(3072)]).toEqual([0, TRIG_ONE, 0, -TRIG_ONE]);
    expect([cos(0), cos(1024), cos(2048), cos(3072)]).toEqual([TRIG_ONE, 0, -TRIG_ONE, 0]);
    // sin(45°) = √2/2 → 11585.24 → 11585
    expect(sin(512)).toBe(11585);
    // 341/4096 turn = 29.97° → sin = 0.49956 → 8184.8 → 8185 (checked against an independent float sin).
    expect(sin(341)).toBe(8185);
  });

  it('is pinned (guards against accidental table changes)', () => {
    let sum = 0;
    for (let a = 0; a < TURN; a++) sum = (sum * 31 + sin(a)) | 0;
    expect(sum).toMatchInlineSnapshot(`-1326448640`);
  });

  it('atan2 inverts sin/cos within one angle unit', () => {
    for (let a = 0; a < TURN; a += 7) {
      const back = atan2(sin(a) * 100, cos(a) * 100);
      expect(Math.abs(angleDiff(back, a))).toBeLessThanOrEqual(1);
    }
    expect(atan2(0, 0)).toBe(0);
    expect(atan2(0, -5)).toBe(2048);
    expect(atan2(-5, 0)).toBe(3072);
  });

  it('maps angles to 8 facings', () => {
    expect([0, 512, 1024, 1536, 2048, 2560, 3072, 3584, 4095].map(facing8)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 0,
    ]);
  });
});

describe('isqrt', () => {
  it('is the exact floor square root', () => {
    for (const n of [0, 1, 2, 3, 4, 15, 16, 17, 99_999_999, 2 ** 40 - 1, 2 ** 40]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
  });
});

describe('input packing', () => {
  it('round-trips every field', () => {
    const i = { aim: 4095, moveDir: 255, moveMag: 7, buttons: 0b101011 };
    expect(decodeInput(encodeInput(i))).toEqual(i);
    expect(encodeInput(i)).toBeLessThan(2 ** 32);
  });
});
