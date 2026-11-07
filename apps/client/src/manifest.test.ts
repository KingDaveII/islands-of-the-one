import { readFileSync } from 'node:fs';
import { paletteData } from '@iot/shared';
import { describe, expect, it } from 'vitest';

/** The web app manifest (M2 Task 10): "Add to Home Screen" opens the game full screen, in landscape, on the Hollow. */
describe('the web app manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as Record<string, unknown>;
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  /** A PNG's width and height, from its IHDR chunk. */
  const pngSize = (path: string): [number, number] => {
    const b = readFileSync(new URL(`../public${path}`, import.meta.url));
    expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  it('is full screen and landscape, its background the Hollow', () => {
    expect(manifest.name).toBe('Islands of the One');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe(paletteData.tokens['hollow-deep']);
  });

  it("lists ART's icons (#140), each file there at its stated size", () => {
    const icons = manifest.icons as { src: string; sizes: string; type: string; purpose: string }[];
    expect(icons.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.purpose).toBe('any maskable');
      expect(pngSize(icon.src).join('x')).toBe(icon.sizes);
    }
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />');
    expect(pngSize('/icons/apple-touch-icon-180.png')).toEqual([180, 180]);
  });

  it('is linked from the page with the home-screen meta tags, covers the screen and pads the game into the safe area', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    // An opaque status bar leaves a blank band above a home-screen app turned upright and back (iOS).
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain('viewport-fit=cover');
    for (const side of ['top', 'right', 'bottom', 'left']) expect(html).toContain(`env(safe-area-inset-${side}, 0px)`);
    expect(html).toMatch(/touch-action: none/);
  });
});
