import silkscreen from '../assets/fonts/silkscreen-8px.json' with { type: 'json' };
import tiny5 from '../assets/fonts/tiny5-8px.json' with { type: 'json' };

/**
 * The client's bitmap fonts: Silkscreen (labels, numbers) and Tiny5
 * (sentences), converted by tools/bitmap-fonts.py from the OFL faces in
 * apps/client/public/fonts into 8 px atlases (packages/shared/assets/fonts,
 * white on transparent) that Phaser BitmapText draws, tinted and scaled by
 * whole numbers. `layoutText` lays a string out the way Phaser's BitmapText
 * does (same advances, same word wrap, same line pitch), so node tests can
 * render exactly what the client shows (`rasterizeText`, with the drop
 * shadow of text drawn over the world at `TEXT_SHADOW_OFFSET`).
 */
export interface BitmapGlyph {
  ch: string;
  /** The glyph's box in the atlas PNG. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Box left from the pen position. */
  xo: number;
  /** Box top from the top of the line box. */
  yo: number;
  /** Pen advance. */
  adv: number;
}

export interface BitmapFont {
  family: string;
  /** The face it was converted from, relative to the repo root. */
  source: string;
  /** Atlas PNG file name, relative to packages/shared/assets/fonts. */
  image: string;
  /** The face's pixel size (8). */
  size: number;
  /** The line box height (8); text sizes above it are whole-number scales. */
  lineHeight: number;
  /** The baseline row in the line box. */
  baseline: number;
  chars: BitmapGlyph[];
}

/** Silkscreen: labels and numbers. */
export const silkscreenFont: BitmapFont = silkscreen;
/** Tiny5: sentences, stats, lore. */
export const tiny5Font: BitmapFont = tiny5;
export const bitmapFonts: readonly BitmapFont[] = [silkscreenFont, tiny5Font];

/** Line pitches of the client's text styles, in font px at scale 1 (readability.md §4). */
export const LABEL_LINE_PITCH = 10;
export const BODY_LINE_PITCH = 11;
/** The drop shadow under text drawn over the world: a dream-night copy this many game px away, whatever the text's scale. */
export const TEXT_SHADOW_OFFSET = { x: 0, y: 1 } as const;

const glyphMaps = new WeakMap<BitmapFont, Map<string, BitmapGlyph>>();

/** The glyph for `ch`, or undefined when the face has none (then nothing is drawn, like Phaser). */
export function glyphOf(font: BitmapFont, ch: string): BitmapGlyph | undefined {
  let map = glyphMaps.get(font);
  if (!map) {
    map = new Map(font.chars.map((g) => [g.ch, g]));
    glyphMaps.set(font, map);
  }
  return map.get(ch);
}

export interface LayoutOptions {
  /** Wrap on spaces so no line's advance exceeds this (font px); 0 or undefined for no wrap. */
  maxWidth?: number;
  /** Extra px between lines (line pitch = lineHeight + lineSpacing). Default 0. */
  lineSpacing?: number;
}

export interface PlacedGlyph {
  glyph: BitmapGlyph;
  /** Top-left of the glyph's box in the layout. */
  x: number;
  y: number;
  line: number;
}

export interface TextLayout {
  /** The text after word wrap (`\n` separates lines). */
  text: string;
  glyphs: PlacedGlyph[];
  /** The text box: the longest line's advance by the lines' pitch (Phaser's `width`/`height`). */
  width: number;
  height: number;
  /** The ink's extent (its box can hang below the line box: descenders), all 0 when nothing is drawn. */
  inkLeft: number;
  inkTop: number;
  inkRight: number;
  inkBottom: number;
}

/** The advance of `text` on one line (glyphs the face lacks count 0, as in Phaser). */
export function measureText(font: BitmapFont, text: string): number {
  let w = 0;
  for (const ch of text) w += glyphOf(font, ch)?.adv ?? 0;
  return w;
}

/**
 * Phaser's BitmapText word wrap (GetBitmapTextSize), verbatim: words keep
 * their trailing space when measured, a word longer than the width gets a
 * line of its own, and explicit newlines are kept.
 */
export function wrapText(font: BitmapFont, text: string, maxWidth: number): string {
  if (!(maxWidth > 0)) return text;
  const wrapped: string[] = [];
  for (const line of text.split('\n')) {
    let word = '';
    let wrappedLine = '';
    let lineToCheck = '';
    const chars = Array.from(line);
    for (const [j, ch] of chars.entries()) {
      word += ch;
      if (ch === ' ' || j === chars.length - 1) {
        const lineWithWord = lineToCheck + word;
        if (measureText(font, lineWithWord) <= maxWidth) {
          lineToCheck = lineWithWord;
        } else {
          wrappedLine = wrappedLine.slice(0, -1);
          wrappedLine += (wrappedLine ? '\n' : '') + lineToCheck;
          lineToCheck = word;
        }
        word = '';
      }
    }
    wrappedLine = wrappedLine.slice(0, -1);
    wrappedLine += (wrappedLine ? '\n' : '') + lineToCheck;
    wrapped.push(wrappedLine);
  }
  return wrapped.join('\n');
}

/** Lay `text` out at scale 1 from (0, 0), the way Phaser's BitmapText does. */
export function layoutText(
  font: BitmapFont,
  text: string,
  options: LayoutOptions = {},
): TextLayout {
  const wrapped = wrapText(font, text, options.maxWidth ?? 0);
  const pitch = font.lineHeight + (options.lineSpacing ?? 0);
  const glyphs: PlacedGlyph[] = [];
  let x = 0;
  let line = 0;
  let width = 0;
  let height = 0;
  let inkLeft = Infinity;
  let inkTop = Infinity;
  let inkRight = 0;
  let inkBottom = 0;
  for (const ch of wrapped) {
    if (ch === '\n') {
      line++;
      x = 0;
      continue;
    }
    const glyph = glyphOf(font, ch);
    if (!glyph) continue;
    const y = line * pitch;
    glyphs.push({ glyph, x: x + glyph.xo, y: y + glyph.yo, line });
    width = Math.max(width, x + glyph.adv);
    height = Math.max(height, y + font.lineHeight);
    if (glyph.w > 0 && glyph.h > 0) {
      inkLeft = Math.min(inkLeft, x + glyph.xo);
      inkTop = Math.min(inkTop, y + glyph.yo);
      inkRight = Math.max(inkRight, x + glyph.xo + glyph.w);
      inkBottom = Math.max(inkBottom, y + glyph.yo + glyph.h);
    }
    x += glyph.adv;
  }
  if (inkRight === 0) inkLeft = inkTop = 0;
  return { text: wrapped, glyphs, width, height, inkLeft, inkTop, inkRight, inkBottom };
}

/** An atlas's ink, one byte per pixel (1 = ink), row-major. */
export interface InkMask {
  width: number;
  height: number;
  ink: Uint8Array;
}

/** The ink mask of an atlas from its RGBA pixels. Throws on a partial pixel: the atlases are 1-bit by contract. */
export function inkMaskFromRgba(rgba: ArrayLike<number>, width: number, height: number): InkMask {
  const ink = new Uint8Array(width * height);
  for (let i = 0; i < ink.length; i++) {
    const a = rgba[i * 4 + 3] ?? 0;
    if (a !== 0 && a !== 255) throw new Error(`partial alpha ${a} at pixel ${i}`);
    ink[i] = a === 255 ? 1 : 0;
  }
  return { width, height, ink };
}

/** Stamp a layout's glyphs from the atlas into a mask the size of the ink (at least the text box), every pixel on or off. */
export function rasterizeText(atlas: InkMask, layout: TextLayout, scale = 1): InkMask {
  const width = Math.max(layout.width, layout.inkRight) * scale;
  const height = Math.max(layout.height, layout.inkBottom) * scale;
  const ink = new Uint8Array(width * height);
  for (const p of layout.glyphs) {
    const g = p.glyph;
    for (let gy = 0; gy < g.h; gy++) {
      for (let gx = 0; gx < g.w; gx++) {
        if (!atlas.ink[(g.y + gy) * atlas.width + g.x + gx]) continue;
        for (let sy = 0; sy < scale; sy++) {
          const row = (p.y * scale + gy * scale + sy) * width + p.x * scale + gx * scale;
          for (let sx = 0; sx < scale; sx++) ink[row + sx] = 1;
        }
      }
    }
  }
  return { width, height, ink };
}
