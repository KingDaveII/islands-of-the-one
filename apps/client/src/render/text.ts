import type Phaser from 'phaser';
import { css, Palette } from '../palette.js';

/**
 * Self-hosted pixel faces (SIL OFL, see public/fonts): Silkscreen for labels
 * and numbers, Tiny5 for sentences. Both are pixel-exact only at multiples of
 * 8 px, so those are the only sizes offered.
 */
export const FONT_LABEL = 'Silkscreen';
export const FONT_TEXT = 'Tiny5';

export type FontSize = 8 | 16 | 24;

/** Line pitch per style (game px). */
const LINE: Record<FontSize, number> = { 8: 10, 16: 18, 24: 24 };
const BODY_PITCH = 11;

/**
 * Resolve once both faces (declared with @font-face in index.html) are ready
 * to draw, so the first scene never renders in the fallback font. Resolves
 * either way after the loads settle; a face that failed is reported, since
 * the text would then be the browser's sans-serif at 8 px.
 */
export async function loadFonts(): Promise<void> {
  const faces = [FONT_LABEL, FONT_TEXT];
  await Promise.allSettled(faces.map((f) => document.fonts.load(`8px ${f}`)));
  await document.fonts.ready;
  const missing = faces.filter((f) => !document.fonts.check(`8px ${f}`));
  if (missing.length > 0) console.warn(`fonts not loaded, text will use a fallback face: ${missing.join(', ')}`);
}

/**
 * Keep text pixel-exact: after Phaser draws a text canvas, snap every pixel
 * to fully on or off (the browser's rasterizer leaves faint partial pixels on
 * some Silkscreen glyphs), then re-upload the texture.
 */
function crisp(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  const draw = t.updateText.bind(t);
  const snap = (): Phaser.GameObjects.Text => {
    draw();
    const { canvas, context } = t;
    if (canvas.width === 0 || canvas.height === 0) return t;
    const img = context.getImageData(0, 0, canvas.width, canvas.height);
    const px = img.data;
    for (let i = 3; i < px.length; i += 4) px[i] = (px[i] ?? 0) >= 128 ? 255 : 0;
    context.putImageData(img, 0, 0);
    t.frame.source.update();
    return t;
  };
  t.updateText = snap;
  return snap();
}

function style(family: string, size: FontSize, color: number): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: family, fontSize: `${size}px`, color: css(color), resolution: 1 };
}

/**
 * A Silkscreen label/number at (x, y), top-left anchored on whole pixels.
 * Title (16) and display (24) sizes are the 8 px face scaled by a whole
 * number, so every font pixel stays a crisp 2×2 / 3×3 block.
 */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = Palette.uiInk,
  size: FontSize = 8,
): Phaser.GameObjects.Text {
  const t = scene.add.text(Math.round(x), Math.round(y), text, style(FONT_LABEL, 8, color));
  t.setLineSpacing((LINE[size] - size) / (size / 8));
  return crisp(t).setScale(size / 8);
}

/** Tiny5 body copy (sentences, stats, lore) with the 11 px line pitch. */
export function body(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = Palette.uiInk,
  wrapWidth?: number,
): Phaser.GameObjects.Text {
  const t = scene.add.text(Math.round(x), Math.round(y), text, {
    ...style(FONT_TEXT, 8, color),
    ...(wrapWidth ? { wordWrap: { width: wrapWidth } } : {}),
  });
  t.setLineSpacing(BODY_PITCH - 8);
  return crisp(t);
}

/** Hard 1 px drop shadow in ui-outline, for text drawn straight over the world. */
export function withShadow(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  return t.setShadow(1, 1, css(Palette.uiOutline), 0, false, true).updateText();
}

/** Place text so its anchor point lands on whole pixels (ox/oy: 0 left/top, 0.5 center, 1 right/bottom). */
export function place(t: Phaser.GameObjects.Text, x: number, y: number, ox = 0, oy = 0): Phaser.GameObjects.Text {
  return t.setOrigin(0, 0).setPosition(Math.round(x - t.displayWidth * ox), Math.round(y - t.displayHeight * oy));
}
