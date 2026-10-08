import { describe, expect, it } from 'vitest';
import { sliderSpec } from './tuningPanel.js';

describe('tuning sliders', () => {
  it('covers 0..3x with sensible steps', () => {
    expect(sliderSpec(100)).toEqual({ min: 0, max: 300, step: 1 });
    expect(sliderSpec(0)).toEqual({ min: 0, max: 10, step: 1 });
    expect(sliderSpec(0.45)).toEqual({ min: 0, max: 1.35, step: 0.001 });
    expect(sliderSpec(0.0016).step).toBe(0.00001);
  });
});
