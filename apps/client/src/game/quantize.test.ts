import { describe, expect, it } from 'vitest';
import { keyboardMove, quantizeAngle, quantizeMove } from './quantize.js';

describe('input quantization', () => {
  it('quantizes aim to 1/4096 turn (screen y down)', () => {
    expect(quantizeAngle(0)).toBe(0);
    expect(quantizeAngle(Math.PI / 2)).toBe(1024);
    expect(quantizeAngle(Math.PI)).toBe(2048);
    expect(quantizeAngle(-Math.PI / 2)).toBe(3072);
  });

  it('keyboard gives 8 directions at full magnitude', () => {
    expect(keyboardMove(false, true, false, false)).toEqual({ moveDir: 0, moveMag: 7 });
    expect(keyboardMove(false, true, false, true)).toEqual({ moveDir: 32, moveMag: 7 });
    expect(keyboardMove(true, false, true, false)).toEqual({ moveDir: 160, moveMag: 7 });
    expect(keyboardMove(true, true, false, false)).toEqual({ moveDir: 0, moveMag: 0 });
  });

  it('analog sticks keep fine direction and stepped magnitude with a deadzone', () => {
    expect(quantizeMove(0.1, 0, 0.2).moveMag).toBe(0);
    expect(quantizeMove(1, 0, 0.2)).toEqual({ moveDir: 0, moveMag: 7 });
    expect(quantizeMove(0.65, 0, 0.2).moveMag).toBe(4);
    expect(quantizeMove(Math.cos(0.3), Math.sin(0.3), 0.2).moveDir).toBe(12);
  });
});
