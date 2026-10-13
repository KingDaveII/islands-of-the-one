import Phaser from 'phaser';
import {
  BODY_LINE_PITCH,
  LABEL_LINE_PITCH,
  silkscreenFont,
  tiny5Font,
  TEXT_SHADOW_OFFSET,
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
 * Text drawn straight over the world (readability.md §4) comes in two kinds,
 * neither with a box or a rim (a rim fills the 1 px counters of a letter
 * and E reads as B), and neither ever faded with alpha (see `blinkOut`):
 * - words (BREAK, CRACK, the room banner, YOU FELL) are `worldWord`: plain
 *   dark ink, ~10:1 on the pale floor and the pale Husk shells;
 * - coloured numbers and pickups (-12, +1 RATION, PERFECT +5) are
 *   `shadowed`: the text drawn twice, a dream-night copy 1 game px below
 *   (whatever the text's scale), then the ink on top.
 */
export type WorldText = Text | Shadowed;

/** A word over the world: a Silkscreen label in the world ink (hollow-deep), nothing under it. */
export function worldWord(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: FontSize = 8,
): Text {
  return label(scene, x, y, text, Palette.worldInk, size);
}

/** A coloured number or pickup over the world: `text` with its 1 px drop shadow; follows the text through setText. */
export class Shadowed extends Phaser.GameObjects.Container {
  readonly label: Text;
  private readonly shadow: Text;

  constructor(scene: Phaser.Scene, text: Text, color: number = Palette.textShadow) {
    super(scene, text.x, text.y);
    this.label = text;
    this.shadow = scene.add
      .bitmapText(TEXT_SHADOW_OFFSET.x, TEXT_SHADOW_OFFSET.y, text.font, text.text)
      .setLineSpacing(text.lineSpacing)
      .setMaxWidth(text.maxWidth)
      .setScale(text.scaleX, text.scaleY)
      .setTint(color);
    text.setPosition(0, 0);
    this.add([this.shadow, text]);
    scene.add.existing(this);
    this.fit();
  }

  get text(): string {
    return this.label.text;
  }

  setText(value: string): this {
    if (value !== this.label.text) {
      this.label.setText(value);
      this.shadow.setText(value);
      this.fit();
    }
    return this;
  }

  /** The container's box is the text's (the shadow's extra row is not counted), so `place` lands the ink. */
  private fit(): void {
    this.setSize(this.label.width, this.label.height);
  }
}

/** Draw `text` with its drop shadow (coloured numbers and pickups over the world). */
export function shadowed(text: Text, color: number = Palette.textShadow): Shadowed {
  return new Shadowed(text.scene, text, color);
}

/**
 * Text leaves in whole steps, never by an alpha fade (which blends the ink
 * off-palette): over the last `windowMs` of its life it blinks `blinks`
 * times (off, on, ..., off) and ends hidden. Call every frame with the
 * remaining life; the text is solid until the window starts.
 */
export function blinkOut(
  t: { setVisible(visible: boolean): unknown },
  remainingMs: number,
  windowMs: number,
  blinks = 2,
): void {
  if (remainingMs >= windowMs) {
    t.setVisible(true);
    return;
  }
  const slot = Math.floor((Math.max(0, remainingMs) * 2 * blinks) / windowMs);
  t.setVisible(slot % 2 === 1);
}

/** Anything `place` can land on whole pixels: a text, a shadowed text, a hint row. */
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
