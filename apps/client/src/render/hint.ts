import type Phaser from 'phaser';
import type { GlyphFamily, Hint } from '../game/gamepad.js';
import { Palette } from '../palette.js';
import { glyphCell, GLYPH_SIZE } from './glyphCells.js';
import { GLYPH_TEXTURE } from './sheets.js';
import { body, label, type FontSize } from './text.js';
import { panel } from './ui.js';

/**
 * A row of key hints: controller glyph cells (tinted with the UI ink) and,
 * for a binding the sheet has no cell for, its text label; plain words can
 * sit between them. 1× beside body text (HUD, prompts), 2× on the controls
 * screen. Nothing here reads input: callers pass the hint (gamepad.ts).
 */
export type HintItem =
  | { cell: string }
  | { text: string; font?: 'label' | 'body'; color?: number };

/** Items for a hint: the glyph cell of every binding, or its label when the sheet has none. */
export function hintItems(hint: Hint): HintItem[] {
  return hint.labels.filter((l) => l !== '').map((l) => {
    const cell = glyphCell(l, hint.family);
    return cell ? { cell } : { text: l };
  });
}

export interface HintRowOptions {
  /** Whole-pixel scale of the glyphs (1 or 2). */
  scale?: 1 | 2;
  /** Tint of the glyphs and color of fallback labels. Default the UI ink. */
  tint?: number;
  /** Color of plain words. Default the muted UI ink. */
  wordColor?: number;
  /** A plain panel behind the row (for prompts drawn over the world). */
  backdrop?: boolean;
}

const BACKDROP_PAD = 3;

export class HintRow {
  readonly container: Phaser.GameObjects.Container;
  private readonly scale: 1 | 2;
  private readonly tint: number;
  private readonly wordColor: number;
  private readonly backdrop: Phaser.GameObjects.Graphics | null;
  private key = '';
  private w = 0;
  private h: number;

  constructor(
    private readonly scene: Phaser.Scene,
    opts: HintRowOptions = {},
  ) {
    this.scale = opts.scale ?? 1;
    this.tint = opts.tint ?? Palette.uiInk;
    this.wordColor = opts.wordColor ?? Palette.uiInkMuted;
    this.h = GLYPH_SIZE * this.scale;
    this.container = scene.add.container(0, 0);
    this.backdrop = opts.backdrop ? scene.add.graphics() : null;
    if (this.backdrop) this.container.add(this.backdrop);
  }

  /** Width and height of the row in game px (including the backdrop's padding). */
  get width(): number {
    return this.w;
  }
  get height(): number {
    return this.h;
  }

  /** The row for one action's hint. */
  setHint(hint: Hint): this {
    return this.setItems(hintItems(hint));
  }

  /** The row for a mixed list of glyphs and words; rebuilt only when it changes. */
  setItems(items: HintItem[]): this {
    const key = JSON.stringify(items);
    if (key === this.key) return this;
    this.key = key;
    for (const child of this.container.list.slice()) if (child !== this.backdrop) child.destroy();
    const s = this.scale;
    const pad = this.backdrop ? BACKDROP_PAD : 0;
    const glyph = GLYPH_SIZE * s;
    let x = pad;
    let first = true;
    for (const item of items) {
      if (!first) x += 2 * s;
      first = false;
      let obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      if ('cell' in item) {
        obj = this.scene.add.image(x, pad, GLYPH_TEXTURE, item.cell).setOrigin(0, 0).setScale(s).setTint(this.tint);
        x += glyph;
      } else if (item.font === 'body') {
        obj = body(this.scene, x, pad + 2 * s, item.text, item.color ?? this.wordColor);
        x += Math.round(obj.displayWidth);
      } else {
        const size = (8 * s) as FontSize;
        obj = label(this.scene, x, pad + 2 * s, item.text, item.color ?? this.tint, size);
        x += Math.round(obj.displayWidth);
      }
      this.container.add(obj);
    }
    this.w = (items.length ? x : 0) + pad;
    this.h = glyph + pad * 2;
    if (this.backdrop) {
      this.backdrop.clear();
      if (items.length) panel(this.backdrop, 0, 0, this.w, this.h, { plain: true });
    }
    return this;
  }

  /** Place the row so its anchor (ox/oy: 0 left/top, 0.5 center, 1 right/bottom) lands on whole pixels. */
  place(x: number, y: number, ox = 0, oy = 0): this {
    this.container.setPosition(Math.round(x - this.w * ox), Math.round(y - this.h * oy));
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

/** Glyph items for binding labels in a family (a helper for rows mixing glyphs and words). */
export function glyphs(labels: string[], family: GlyphFamily): HintItem[] {
  return hintItems({ labels, family });
}

/** A plain word (Tiny5) for a mixed row. */
export const word = (text: string, color?: number): HintItem =>
  color === undefined ? { text, font: 'body' } : { text, font: 'body', color };
