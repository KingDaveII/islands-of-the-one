import { defaultTuning } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { deviceSize, fitUi, fitWorldView, menuOrigin, viewInUi } from './view.js';

const VIEW = defaultTuning.view;

/** The table in the G1.5 brief: window (CSS @ DPR) → device px → zW and the view. */
const TABLE: [css: string, dpr: number, device: [number, number], zW: number, view: [number, number]][] = [
  ['1920×912', 1, [1920, 912], 2, [960, 456]],
  ['1920×1080', 1, [1920, 1080], 2, [960, 540]],
  ['1536×714', 1.25, [1920, 892], 2, [960, 446]],
  ['1366×650', 1, [1366, 650], 1, [960, 540]],
  ['1280×720', 1, [1280, 720], 1, [960, 540]],
  ['2560×1300', 1, [2560, 1300], 3, [853, 433]],
  ['1600×1300', 1, [1600, 1300], 2, [800, 540]],
  ['1280×700', 2, [2560, 1400], 3, [853, 466]],
  ['3840×2050', 1, [3840, 2050], 4, [960, 512]],
  ['844×390', 3, [2532, 1170], 2, [960, 540]],
];

describe('fitWorldView', () => {
  it('is the view block of tuning.json', () => {
    expect(VIEW).toEqual({ widthPx: 960, minWidthPx: 768, minHeightPx: 432, maxHeightPx: 540 });
  });

  it.each(TABLE)('%s @ %s', (css, dpr, device, zW, view) => {
    const [cw, ch] = css.split('×').map(Number) as [number, number];
    const d = deviceSize(cw, ch, dpr);
    expect([d.w, d.h]).toEqual(device);
    const fit = fitWorldView(d.w, d.h, VIEW);
    expect(fit.zW).toBe(zW);
    expect([fit.w, fit.h]).toEqual(view);
    // Centred, on whole device pixels, inside the window.
    expect(fit.x).toBe(Math.floor((d.w - fit.w * fit.zW) / 2));
    expect(fit.y).toBe(Math.floor((d.h - fit.h * fit.zW) / 2));
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.y).toBeGreaterThanOrEqual(0);
    expect(fit.x + fit.w * fit.zW).toBeLessThanOrEqual(d.w);
    expect(fit.y + fit.h * fit.zW).toBeLessThanOrEqual(d.h);
  });

  it('keeps the view within its height limits whenever the window allows a zoom above 1', () => {
    for (let h = 300; h <= 2400; h += 7) {
      for (let w = 600; w <= 4000; w += 113) {
        const f = fitWorldView(w, h, VIEW);
        expect(f.h).toBeLessThanOrEqual(VIEW.maxHeightPx);
        expect(f.w).toBeLessThanOrEqual(VIEW.widthPx);
        // The width step drops the zoom once only: a tall, narrow window can keep z > 1 with a narrow view.
        if (f.zW > 1) expect(f.h, `${w}×${h}`).toBeGreaterThanOrEqual(VIEW.minHeightPx);
      }
    }
  });

  it('drops one step when the height falls short, then one more when the width does', () => {
    // 1080 tall at z 3 is 360 < 432: z 2. Then 1500 wide at z 2 is 750 < 768: z 1.
    expect(fitWorldView(1500, 1100, VIEW).zW).toBe(1);
    // Exactly the limits: 540 × 2 tall is z 2; 432 × 3 = 1296 tall stays at z 3.
    expect(fitWorldView(1920, 1080, VIEW).zW).toBe(2);
    expect(fitWorldView(2304, 1296, VIEW)).toEqual({ zW: 3, w: 768, h: 432, x: 0, y: 0 });
    expect(fitWorldView(2303, 1296, VIEW).zW).toBe(2);
    expect(fitWorldView(2304, 1295, VIEW).zW).toBe(2);
  });

  it('shows what fits below the minimums at z 1, and survives empty or broken sizes', () => {
    expect(fitWorldView(640, 360, VIEW)).toEqual({ zW: 1, w: 640, h: 360, x: 0, y: 0 });
    expect(fitWorldView(300, 200, VIEW)).toEqual({ zW: 1, w: 300, h: 200, x: 0, y: 0 });
    expect(fitWorldView(0, 0, VIEW)).toEqual({ zW: 1, w: 0, h: 0, x: 0, y: 0 });
    expect(fitWorldView(Number.NaN, -5, VIEW)).toEqual({ zW: 1, w: 0, h: 0, x: 0, y: 0 });
  });

  it('centres a narrow or short view with the margin split evenly', () => {
    expect(fitWorldView(1366, 650, VIEW)).toEqual({ zW: 1, w: 960, h: 540, x: 203, y: 55 });
    expect(fitWorldView(2532, 1170, VIEW)).toEqual({ zW: 2, w: 960, h: 540, x: 306, y: 45 });
  });
});

describe('fitUi', () => {
  it("keeps M1's rule: the largest whole zoom that still fits 480 × 270", () => {
    expect(fitUi(1920, 1080)).toEqual({ zU: 4, w: 480, h: 270 });
    expect(fitUi(1920, 912)).toEqual({ zU: 3, w: 640, h: 304 });
    expect(fitUi(1920, 892)).toEqual({ zU: 3, w: 640, h: 297 });
    expect(fitUi(1366, 650)).toEqual({ zU: 2, w: 683, h: 325 });
    expect(fitUi(2560, 1300)).toEqual({ zU: 4, w: 640, h: 325 });
    expect(fitUi(2560, 1400)).toEqual({ zU: 5, w: 512, h: 280 });
    expect(fitUi(3840, 2050)).toEqual({ zU: 7, w: 548, h: 292 });
    expect(fitUi(2532, 1170)).toEqual({ zU: 4, w: 633, h: 292 });
  });

  it('never goes below 1', () => {
    expect(fitUi(300, 200)).toEqual({ zU: 1, w: 300, h: 200 });
    expect(fitUi(0, 0)).toEqual({ zU: 1, w: 0, h: 0 });
  });
});

describe('deviceSize', () => {
  it('is the CSS size times the device pixel ratio, rounded down, with a sane ratio', () => {
    expect(deviceSize(1536, 714, 1.25)).toEqual({ w: 1920, h: 892, dpr: 1.25 });
    expect(deviceSize(1746, 982, 1.1)).toEqual({ w: 1920, h: 1080, dpr: 1.1 });
    expect(deviceSize(844, 390, 3)).toEqual({ w: 2532, h: 1170, dpr: 3 });
    expect(deviceSize(800, 600, 0)).toEqual({ w: 800, h: 600, dpr: 1 });
    expect(deviceSize(800, 600, Number.NaN)).toEqual({ w: 800, h: 600, dpr: 1 });
  });
});

describe('viewInUi', () => {
  it('is the world view in UI px, rounded inwards', () => {
    // 1080p in a browser window: the view covers the canvas, 640 × 304 UI px.
    expect(viewInUi(fitWorldView(1920, 912, VIEW), 3)).toEqual({ x: 0, y: 0, w: 640, h: 304 });
    // A phone: the view is centred with margins; the edges round inwards.
    expect(viewInUi(fitWorldView(2532, 1170, VIEW), 4)).toEqual({ x: 77, y: 12, w: 479, h: 269 });
    // 1366 × 650 at z 1: 960 × 540 device px at (203, 55), an odd offset, inside a 683 × 325 UI area.
    expect(viewInUi(fitWorldView(1366, 650, VIEW), 2)).toEqual({ x: 102, y: 28, w: 479, h: 269 });
    // A tall, narrow window keeps z 2 with a 300 px view (the width step drops one zoom only).
    expect(fitWorldView(600, 1301, VIEW)).toMatchObject({ zW: 2, w: 300, h: 540 });
  });
});

describe('menuOrigin', () => {
  it('centres the 480 × 270 layout in the UI area', () => {
    expect(menuOrigin({ zU: 4, w: 480, h: 270 })).toEqual({ x: 0, y: 0 });
    expect(menuOrigin({ zU: 3, w: 640, h: 304 })).toEqual({ x: 80, y: 17 });
    expect(menuOrigin({ zU: 1, w: 300, h: 200 })).toEqual({ x: -90, y: -35 });
  });
});
