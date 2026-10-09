import { describe, expect, it } from 'vitest';
import { sliderSpec } from './tuningPanel.js';

describe('tuning sliders', () => {
  it('covers 0..3x with sensible steps', () => {
    expect(sliderSpec(100)).toEqual({ min: 0, max: 300, step: 1 });
    expect(sliderSpec(0)).toEqual({ min: 0, max: 10, step: 1 });
    expect(sliderSpec(0.45)).toEqual({ min: 0, max: 1.35, step: 0.001 });
    expect(sliderSpec(0.0016).step).toBe(0.00001);
  });

  it('gives zero-default timings and weight-class multipliers usable ranges', () => {
    expect(sliderSpec(0, 'armorEndMs')).toEqual({ min: 0, max: 1000, step: 10 });
    expect(sliderSpec(1, 'light')).toEqual({ min: 0, max: 1, step: 0.05 });
    expect(sliderSpec(0, 'heavy')).toEqual({ min: 0, max: 1, step: 0.05 });
  });
});
