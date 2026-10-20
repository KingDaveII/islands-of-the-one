import { readFileSync } from 'node:fs';
import { paletteData } from '@iot/shared';
import { describe, expect, it } from 'vitest';

/** The web app manifest (M2 Task 10): "Add to Home Screen" opens the game full screen, in landscape, on the Hollow. */
describe('the web app manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as Record<string, unknown>;
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  it('is full screen and landscape, its background the Hollow, with no icons until ART delivers them', () => {
    expect(manifest.name).toBe('Islands of the One');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe(paletteData.tokens['hollow-deep']);
    expect(manifest.icons).toEqual([]);
  });

  it('is linked from the page with the home-screen meta tags, and keeps the default viewport (the notch stays outside)', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('apple-mobile-web-app-status-bar-style');
    expect(html).not.toContain('viewport-fit=cover');
    expect(html).toMatch(/touch-action: none/);
  });
});
