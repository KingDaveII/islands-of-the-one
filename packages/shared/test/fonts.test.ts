import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BODY_LINE_PITCH,
  LABEL_LINE_PITCH,
  bitmapFonts,
  defaultTuning,
  glyphOf,
  inkMaskFromRgba,
  layoutText,
  measureText,
  rasterizeText,
  silkscreenFont,
  TEXT_SHADOW_OFFSET,
  tiny5Font,
  wrapText,
  type BitmapFont,
  type InkMask,
  type TextLayout,
} from '../src/index.js';
import { decodePng, encodePng } from './png.js';

/** Design-system tokens the client draws text in (apps/client/src/palette.ts): hollow-light ink, dream-night shadow, choir-flame damage numbers. */
const INK = [0xf4, 0xef, 0xe6] as const;
const SHADOW = [0x1c, 0x21, 0x47] as const;
const HURT_INK = [0xf0, 0x7a, 0x3a] as const;

const PRINTABLE_ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCharCode(0x20 + i),
);
/** Characters the data and the scene strings use beyond ASCII (the generator scans for them). */
const EXTRA_CHARS = ['·', '…', '—'];

function atlasOf(font: BitmapFont): InkMask {
  const png = decodePng(readFileSync(new URL(`../assets/fonts/${font.image}`, import.meta.url)));
  for (let i = 0; i < png.width * png.height; i++) {
    const a = png.rgba[i * 4 + 3] ?? 0;
    if (a === 255)
      expect([png.rgba[i * 4], png.rgba[i * 4 + 1], png.rgba[i * 4 + 2]]).toEqual([255, 255, 255]);
  }
  return inkMaskFromRgba(png.rgba, png.width, png.height);
}

const atlases = new Map(bitmapFonts.map((f) => [f, atlasOf(f)]));
const atlas = (font: BitmapFont): InkMask => {
  const a = atlases.get(font);
  if (!a) throw new Error(`no atlas for ${font.family}`);
  return a;
};

describe.each(bitmapFonts.map((f) => [f.family, f] as const))('the %s atlas', (_family, font) => {
  it('is the 8 px face with an 8 px line box and whole-pixel metrics', () => {
    expect(font.size).toBe(8);
    expect(font.lineHeight).toBe(8);
    expect(font.baseline).toBeGreaterThan(0);
    expect(font.baseline).toBeLessThanOrEqual(8);
    for (const g of font.chars) {
      for (const v of [g.x, g.y, g.w, g.h, g.xo, g.yo, g.adv])
        expect(Number.isInteger(v), g.ch).toBe(true);
      expect(g.adv, g.ch).toBeGreaterThan(0);
    }
  });

  it('covers printable ASCII and the characters the data and scenes use, once each', () => {
    const chars = font.chars.map((g) => g.ch);
    expect(new Set(chars).size).toBe(chars.length);
    for (const ch of [...PRINTABLE_ASCII, ...EXTRA_CHARS])
      expect(glyphOf(font, ch), `U+${ch.codePointAt(0)?.toString(16)}`).toBeDefined();
    expect(glyphOf(font, '\n')).toBeUndefined();
  });

  it('holds every glyph in a tight box of 1-bit white pixels, boxes apart', () => {
    const a = atlas(font);
    const taken = new Uint8Array(a.width * a.height);
    for (const g of font.chars) {
      if (g.w === 0 || g.h === 0) {
        expect([g.w, g.h], g.ch).toEqual([0, 0]);
        continue;
      }
      expect(g.x + g.w, g.ch).toBeLessThanOrEqual(a.width);
      expect(g.y + g.h, g.ch).toBeLessThanOrEqual(a.height);
      const rows = new Set<number>();
      const cols = new Set<number>();
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const i = (g.y + y) * a.width + g.x + x;
          expect(taken[i], `${g.ch} overlaps another glyph`).toBe(0);
          taken[i] = 1;
          if (a.ink[i]) {
            rows.add(y);
            cols.add(x);
          }
        }
      }
      expect(
        [rows.has(0), rows.has(g.h - 1), cols.has(0), cols.has(g.w - 1)],
        `${g.ch} box is not tight`,
      ).toEqual([true, true, true, true]);
    }
  });

  it('keeps caps and digits inside the line box, on the baseline', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const g = glyphOf(font, ch);
      if (!g) throw new Error(ch);
      expect(g.yo, ch).toBeGreaterThanOrEqual(0);
      // Every cap and digit stands on the baseline (Q's tail aside).
      if (ch !== 'Q') expect(g.yo + g.h, ch).toBe(font.baseline);
    }
  });
});

describe('text layout (Phaser BitmapText rules)', () => {
  it('measures a line as the sum of advances and skips characters the face lacks', () => {
    expect(measureText(silkscreenFont, 'BREAK')).toBe(
      'BREAK'.split('').reduce((w, c) => w + (glyphOf(silkscreenFont, c)?.adv ?? 0), 0),
    );
    expect(measureText(silkscreenFont, 'AאB')).toBe(measureText(silkscreenFont, 'AB'));
  });

  it('wraps on spaces so no line (its trailing space included) exceeds the width, keeping explicit newlines', () => {
    const font = tiny5Font;
    const text = 'The hook bites deep and hauls the Husk in.\nSecond line.';
    const wrapped = wrapText(font, text, 60);
    expect(wrapped.replace(/\n/g, ' ')).toBe(text.replace(/\n/g, ' '));
    const lines = wrapped.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(measureText(font, line + ' ')).toBeLessThanOrEqual(60);
    expect(lines.at(-1)).toBe('Second line.');
    expect(wrapText(font, text, 0)).toBe(text);
  });

  it('gives a word longer than the width a line of its own', () => {
    expect(wrapText(tiny5Font, 'a Sparkglassssssssssss b', 30)).toBe('a\nSparkglassssssssssss\nb');
  });

  it('lays lines out on the pitch and sizes the box like Phaser (advance by line pitch)', () => {
    const l = layoutText(silkscreenFont, 'YOU\nFELL', { lineSpacing: LABEL_LINE_PITCH - 8 });
    expect(l.width).toBe(
      Math.max(measureText(silkscreenFont, 'YOU'), measureText(silkscreenFont, 'FELL')),
    );
    expect(l.height).toBe(LABEL_LINE_PITCH + 8);
    const second = l.glyphs.filter((g) => g.line === 1);
    expect(second.map((g) => g.glyph.ch).join('')).toBe('FELL');
    expect(second[0]?.y).toBe(LABEL_LINE_PITCH + (glyphOf(silkscreenFont, 'F')?.yo ?? -1));
  });

  it('reports the ink extent (Silkscreen caps on rows 3-7 of the box), none for empty text', () => {
    const plain = layoutText(silkscreenFont, 'BREAK');
    const b = glyphOf(silkscreenFont, 'B');
    if (!b) throw new Error('B');
    expect([plain.inkLeft, plain.inkTop, plain.inkBottom]).toEqual([b.xo, 3, 8]);
    expect(layoutText(silkscreenFont, 'Q').inkBottom).toBe(9);
    const empty = layoutText(silkscreenFont, ' ');
    expect([empty.inkLeft, empty.inkTop, empty.inkRight, empty.inkBottom]).toEqual([0, 0, 0, 0]);
  });

  it('the drop shadow is 1 game px below, whatever the scale', () => {
    expect(TEXT_SHADOW_OFFSET).toEqual({ x: 0, y: 1 });
  });
});

/**
 * Ink as straight RGBA, every pixel fully on or off; with `shadow`, the way the
 * client draws text over the world: a dream-night copy TEXT_SHADOW_OFFSET
 * game px away first, the ink on top (the image grows by the offset).
 */
function paint(
  font: BitmapFont,
  layout: TextLayout,
  ink: readonly [number, number, number],
  shadow: boolean,
  scale = 1,
): { width: number; height: number; rgba: Uint8Array } {
  const mask = rasterizeText(atlas(font), layout, scale);
  const dx = shadow ? TEXT_SHADOW_OFFSET.x : 0;
  const dy = shadow ? TEXT_SHADOW_OFFSET.y : 0;
  const width = mask.width + dx;
  const height = mask.height + dy;
  const rgba = new Uint8Array(width * height * 4);
  const stamp = (ox: number, oy: number, color: readonly [number, number, number]): void => {
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        if (mask.ink[y * mask.width + x])
          rgba.set([...color, 255], ((y + oy) * width + x + ox) * 4);
      }
    }
  };
  if (shadow) stamp(dx, dy, SHADOW);
  stamp(0, 0, ink);
  for (let i = 3; i < rgba.length; i += 4)
    expect(rgba[i] === 0 || rgba[i] === 255, 'partial alpha').toBe(true);
  return { width, height, rgba };
}

const GOLDEN_DIR = new URL('./golden/fonts/', import.meta.url);

/** Compare to the committed PNG; `UPDATE_GOLDEN=1` rewrites it (say so in the commit). */
function expectGolden(
  name: string,
  image: { width: number; height: number; rgba: Uint8Array },
): void {
  const file = new URL(`${name}.png`, GOLDEN_DIR);
  const png = encodePng(image.width, image.height, image.rgba);
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
    writeFileSync(file, png);
    if (!process.env.UPDATE_GOLDEN)
      throw new Error(`golden image ${name}.png was missing: written, commit it`);
  }
  const want = decodePng(readFileSync(file));
  expect([image.width, image.height], name).toEqual([want.width, want.height]);
  expect(
    Buffer.from(image.rgba).equals(Buffer.from(want.rgba)),
    `${name}.png differs from the committed golden image`,
  ).toBe(true);
}

const hookblade = defaultTuning.weapons.hookblade;

describe('golden images (the client lays text out the same way)', () => {
  it.each(['BREAK', 'CRACK', 'YOU FELL'])('floater "%s" with its drop shadow', (text) => {
    expectGolden(
      `${text.toLowerCase().replace(' ', '-')}-shadowed`,
      paint(silkscreenFont, layoutText(silkscreenFont, text), INK, true),
    );
  });

  it('a damage number with its drop shadow', () => {
    expectGolden(
      'damage-12-shadowed',
      paint(silkscreenFont, layoutText(silkscreenFont, '-12'), HURT_INK, true),
    );
  });

  it('the shadow sits exactly one row under the ink and never over it', () => {
    const layout = layoutText(silkscreenFont, 'E');
    const img = paint(silkscreenFont, layout, INK, true);
    const mask = rasterizeText(atlas(silkscreenFont), layout);
    const at = (x: number, y: number): number[] =>
      Array.from(img.rgba.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
    for (let y = 0; y < mask.height; y++)
      for (let x = 0; x < mask.width; x++) {
        if (mask.ink[y * mask.width + x]) {
          expect(at(x, y)).toEqual([...INK]);
          expect(mask.ink[(y + 1) * mask.width + x] ? [...INK] : [...SHADOW]).toEqual(at(x, y + 1));
        }
      }
    expect(img.height).toBe(mask.height + 1);
  });

  it('the start screen prompt', () => {
    expectGolden(
      'choose-your-weapon',
      paint(silkscreenFont, layoutText(silkscreenFont, 'CHOOSE YOUR WEAPON'), INK, false),
    );
  });

  it('the 16 px banner (the 8 px face at 2x)', () => {
    expectGolden(
      'shard-cleared-16',
      paint(silkscreenFont, layoutText(silkscreenFont, 'SHARD CLEARED'), INK, true, 2),
    );
  });

  it('the Hookblade blurb wrapped in its card (Tiny5, 11 px pitch)', () => {
    const layout = layoutText(tiny5Font, hookblade.blurb, {
      maxWidth: 116,
      lineSpacing: BODY_LINE_PITCH - 8,
    });
    expect(layout.text.split('\n').length).toBeGreaterThan(1);
    expectGolden('hookblade-blurb', paint(tiny5Font, layout, INK, false));
  });

  it('digits', () => {
    expectGolden(
      'digits',
      paint(silkscreenFont, layoutText(silkscreenFont, '0123456789'), INK, false),
    );
  });

  it('keeps the counters of E open (the rim that turned BREAK into BRBAK is gone)', () => {
    const layout = layoutText(silkscreenFont, 'E');
    const mask = rasterizeText(atlas(silkscreenFont), layout);
    const e = glyphOf(silkscreenFont, 'E');
    if (!e) throw new Error('E');
    const rows: string[] = [];
    for (let y = 0; y < e.h; y++) {
      let row = '';
      for (let x = 0; x < e.w; x++) row += mask.ink[(e.yo + y) * mask.width + e.xo + x] ? '#' : '.';
      rows.push(row);
    }
    expect(rows).toEqual(['###', '#..', '###', '#..', '###']);
  });
});
