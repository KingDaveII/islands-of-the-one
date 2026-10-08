import { describe, expect, it } from 'vitest';
import { isMovePayload, isPingPayload } from './protocol.js';

describe('protocol guards', () => {
  it('accepts valid move payloads', () => {
    expect(isMovePayload({ x: 1, y: 2 })).toBe(true);
  });

  it('rejects invalid move payloads', () => {
    expect(isMovePayload(null)).toBe(false);
    expect(isMovePayload({ x: '1', y: 2 })).toBe(false);
    expect(isMovePayload({ x: Number.NaN, y: 2 })).toBe(false);
  });

  it('validates ping payloads', () => {
    expect(isPingPayload({ sentAt: 5 })).toBe(true);
    expect(isPingPayload({})).toBe(false);
  });
});
