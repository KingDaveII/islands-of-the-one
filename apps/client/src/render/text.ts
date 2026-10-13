import Phaser from 'phaser';
import {
  BODY_LINE_PITCH,
  chipRect,
  LABEL_LINE_PITCH,
  layoutText,
  silkscreenFont,
  tiny5Font,
  type BitmapFont,
} from '@iot/shared';
import silkscreenUrl from '@iot/shared/assets/fonts/silkscreen-8px.png';
import tiny5Url from '@iot/shared/assets/fonts/tiny5-8px.png';
import { Palette } from '../palette.js';

/**
 * The one text path. Every piece of text is a Phaser BitmapText drawn from
 * the pixel atlases in packages/shared/assets/fonts (Silkscreen for labels
 * and numbers, Tiny5 for sentences; both SIL OFL, converted at 8 px by
 * tools/bitmap-fonts.py), tinted by color token, so the glyph pixels never
 * depend on the browser's font rasterizer. Sizes 16 and 24 are the 8 px
 * glyphs scaled by a whole number. Nothing else creates text (ESLint).
 *
 * Call `preloadFonts` from a scene's preload and `registerFonts` from its
 * create (both safe to call again: textures and font data are game-wide).
 */
export const FONT_LABEL = 'silkscreen-8px';
export const FONT_TEXT = 'tiny5-8px';

export type FontSize = 8 | 16 | 24;
export type Text = Phaser.GameObjects.BitmapText;

/** Line pitch per label size (game px); the body pitch is BODY_LINE_PITCH. */
const LINE: Record<FontSize, number> = { 8: LABEL_LINE_PITCH, 16: 18, 24: 24 };

const FONTS: Record<string, { url: string; font: BitmapFont }> = {
  [FONT_LABEL]: { url: silkscreenUrl, font: silkscreenFont },
  [FONT_TEXT]: { url: tiny5Url, font: tiny5Font },
};

export function preloadFonts(scene: Phaser.Scene): void {
  for (const [key, { url }] of Object.entries(FONTS))
    if (!scene.textures.exists(key)) scene.load.image(key, url);
}

/** Phaser's per-glyph font data (Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData, plus the advance it reads). */
interface GlyphData {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  xOffset: number;
  yOffset: number;
  xAdvance: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  data: object;
  kerning: Record<string, number>;
}

/** The atlas contract as Phaser's BitmapFontData (what ParseXMLBitmapFont builds from BMFont XML). */
function fontData(
  key: string,
  font: BitmapFont,
  texture: Phaser.Textures.Texture,
): Phaser.Types.GameObjects.BitmapText.BitmapFontData {
  const src = texture.getSourceImage();
  const tw = src.width;
  const th = src.height;
  const chars: Record<number, GlyphData> = {};
  for (const g of font.chars) {
    const code = g.ch.codePointAt(0);
    if (code === undefined) continue;
    chars[code] = {
      x: g.x,
      y: g.y,
      width: g.w,
      height: g.h,
      centerX: Math.floor(g.w / 2),
      centerY: Math.floor(g.h / 2),
      xOffset: g.xo,
      yOffset: g.yo,
      xAdvance: g.adv,
      u0: g.x / tw,
      v0: g.y / th,
      u1: (g.x + g.w) / tw,
      v1: (g.y + g.h) / th,
      data: {},
      kerning: {},
    };
  }
  return { font: key, size: font.size, lineHeight: font.lineHeight, retroFont: false, chars };
}

export function registerFonts(scene: Phaser.Scene): void {
  for (const [key, { font }] of Object.entries(FONTS)) {
    if (scene.cache.bitmapFont.has(key) || !scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    scene.cache.bitmapFont.add(key, {
      data: fontData(key, font, texture),
      texture: key,
      frame: null,
      fromAtlas: false,
    });
  }
}

/**
 * A Silkscreen label/number at (x, y), top-left anchored on whole pixels, in
 * a color token. Title (16) and display (24) sizes are the 8 px face scaled
 * by a whole number, so every font pixel stays a crisp 2×2 / 3×3 block; the
 * line pitch is 10 / 18 / 24.
 */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = Palette.uiInk,
  size: FontSize = 8,
): Text {
  const scale = size / 8;
  return scene.add
    .bitmapText(Math.round(x), Math.round(y), FONT_LABEL, text)
    .setLineSpacing(LINE[size] / scale - 8)
    .setScale(scale)
    .setTint(color);
}

/** Tiny5 body copy (sentences, stats, lore) with the 11 px line pitch, word-wrapped at `wrapWidth` (game px). */
export function body(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = Palette.uiInk,
  wrapWidth?: number,
): Text {
  const t = scene.add
    .bitmapText(Math.round(x), Math.round(y), FONT_TEXT, text)
    .setLineSpacing(BODY_LINE_PITCH - 8)
    .setTint(color);
  if (wrapWidth) t.setMaxWidth(wrapWidth);
  return t;
}

/**
 * Text drawn straight over the world (floaters, damage numbers, the room
 * banner) sits on a ui-outline chip: the ink's extent plus 1 px of padding,
 * as the design system asks for numbers over art (readability.md §4). The
 * chip follows the text through setText; `place` lands the chip on whole
 * pixels. Alpha set on the chip fades both.
 */
export class Chip extends Phaser.GameObjects.Container {
  readonly label: Text;
  private readonly back: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, text: Text, color: number = Palette.uiOutline) {
    super(scene, text.x, text.y);
    this.label = text;
    this.back = scene.add.rectangle(0, 0, 1, 1, color).setOrigin(0, 0);
    text.setPosition(0, 0);
    this.add([this.back, text]);
    scene.add.existing(this);
    this.fit();
  }

  get text(): string {
    return this.label.text;
  }

  setText(value: string): this {
    if (value !== this.label.text) {
      this.label.setText(value);
      this.fit();
    }
    return this;
  }

  /** Size the chip to the ink (the shared layout is the client's, so the chip never misses a glyph). */
  private fit(): void {
    const entry = FONTS[this.label.font];
    if (!entry) throw new Error(`unknown font ${this.label.font}`);
    const scale = this.label.scaleX;
    const layout = layoutText(entry.font, this.label.text, {
      maxWidth: this.label.maxWidth / scale,
      lineSpacing: this.label.lineSpacing,
    });
    const r = chipRect(layout, scale);
    this.back.setSize(r.w, r.h).setVisible(r.w > 0 && r.h > 0);
    // The chip is what `place` positions: the container's box is the chip's, the text offset inside it.
    this.setSize(r.w, r.h);
    this.label.setPosition(-r.x, -r.y);
  }
}

/** Put `text` on a ui-outline chip (text drawn over the world). */
export function chip(text: Text, color: number = Palette.uiOutline): Chip {
  return new Chip(text.scene, text, color);
}

/** Anything `place` can land on whole pixels: a text, a chip (its size is the chip's), a hint row. */
export interface Placeable {
  readonly width: number;
  readonly height: number;
  setPosition(x: number, y: number): unknown;
}

/** Place text so its anchor point lands on whole pixels (ox/oy: 0 left/top, 0.5 center, 1 right/bottom). */
export function place<T extends Placeable>(t: T, x: number, y: number, ox = 0, oy = 0): T {
  t.setPosition(Math.round(x - t.width * ox), Math.round(y - t.height * oy));
  return t;
}
