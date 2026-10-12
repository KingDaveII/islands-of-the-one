import { describe, expect, it } from 'vitest';
import { fitDevicePixels, fitZoom } from './zoom.js';

describe('zoom', () => {
  it('is a whole number of device pixels per game pixel', () => {
    expect(fitZoom(1920, 1080, 1)).toBe(4);
    expect(fitZoom(1440, 810, 1)).toBe(3);
    expect(fitZoom(1920, 1000, 1)).toBe(3);
    // A 1080p display at 125 %: 1536×864 CSS px, 4 device px per game px, 3.2 CSS px.
    expect(fitDevicePixels(1536, 864, 1.25)).toBe(4);
    expect(fitZoom(1536, 864, 1.25)).toBeCloseTo(3.2, 10);
    expect(480 * fitZoom(1536, 864, 1.25) * 1.25).toBeCloseTo(1920, 6);
    // 150 %: 1280×720 CSS px is still 1920×1080 device px.
    expect(fitDevicePixels(1280, 720, 1.5)).toBe(4);
    // A Retina laptop (1440×900 CSS at DPR 2): 6 device px, 3 CSS px.
    expect(fitZoom(1440, 900, 2)).toBe(3);
    // Browser zoom 110 % on 1080p: 1746×982 CSS px at DPR 1.1 is still 4 device px.
    expect(fitDevicePixels(1746, 982, 1.1)).toBe(4);
    expect(fitZoom(1746, 982, 1.1) * 1.1).toBeCloseTo(4, 10);
  });

  it('never goes below one device pixel per game pixel', () => {
    expect(fitZoom(300, 200, 1)).toBe(1);
    expect(fitZoom(300, 200, 2)).toBe(0.5);
    expect(fitZoom(300, 200, 0)).toBe(1);
  });
});
