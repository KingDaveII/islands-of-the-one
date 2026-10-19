import Phaser from 'phaser';
import type { ToastKind } from '@iot/shared';
import { HUD_INSET, HUD_PAD, TOAST_GAP, TOAST_GLYPH, TOAST_ROW, toastStripBottom, toastTextWidth, type UiRect } from '../game/holdingView.js';
import { ToastQueue, type ToastGlyph } from '../game/toastView.js';
import { tuningStore } from '../game/tuningStore.js';
import { fitUi, fitWorldView, viewInUi, type Rect as ViewRect } from '../game/view.js';
import { Palette } from '../palette.js';
import { loadLetterSheet, plotLetters, type LetterSheet } from '../render/letters.js';
import { ITEM_ICON_TEXTURE, preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';

/**
 * The toast strip (docs/design/holding.md "Sleep, the away card and toasts",
 * M2 Task 7; GAME DESIGN: one line, bottom left, above the consumable slots,
 * in the body font with a small glyph for its kind, at most two stacked,
 * never taking input). A scene of its own, registered last so it draws
 * above everything on the UI camera, the inventory and the panels included,
 * with nothing interactive in it, so clicks pass through. The holding scene
 * launches it and stops it; the scenes post toasts into `toastStore`, whose
 * queue (game/toastView.ts) holds each `toastMs` and drops it in one frame,
 * no blink pattern and no alpha. The strip sits at `hudRects`' toasts
 * rectangle, the newest toast at the bottom; it waits (hidden, not ageing)
 * while the away card is open; and it draws dithered while the HUD finds a
 * body behind it, like the other panels. Placeholder look until ART's M2 UI
 * kit: the glyphs are an item's icon from the item icon sheet, or an 8 × 8
 * square of the muted ink; מת in the Writ-dark toast is drawn from the
 * letter sheet, as on the HUD chip.
 */

/** The widest strip (the HUD's toasts rectangle): where it sits is decided for that width, so the strip never jumps as texts differ. */
const MAX_W = HUD_PAD + TOAST_GLYPH + TOAST_GAP + toastTextWidth() + HUD_PAD;

/** The Old Letters in a toast's text (one run at most in M2: מת), drawn from the letter sheet. */
const OLD_LETTERS = /[א-ת]+/;

/** Split a toast's text round its Old Letters: the text before, the letters, the text after. */
export function splitLetters(text: string): { before: string; letters: string; after: string } {
  const m = OLD_LETTERS.exec(text);
  if (!m) return { before: text, letters: '', after: '' };
  return { before: text.slice(0, m.index), letters: m[0], after: text.slice(m.index + m[0].length) };
}

/** What the scenes post into and the strip draws from. */
export const toastStore = {
  queue: new ToastQueue(),
  /** The toasts wait while the away card is open: hidden, not ageing. */
  paused: false,
  /** The strip's drawn rectangle (UI px) this frame, empty while no toast shows: the HUD counts it in `panelsBehind`. */
  rect: { x: 0, y: 0, w: 0, h: 0 },
  /** The HUD found a body behind the strip: drawn as the 50 % checkerboard, its ink solid. */
  dither: false,
  post(kind: ToastKind, text: string, glyph: ToastGlyph): void {
    this.queue.push(kind, text, glyph);
  },
  /** What the playtests read: the toasts showing, oldest first (the newest is the bottom line). */
  snapshot(): { lines: string[]; kinds: ToastKind[]; paused: boolean; rect: UiRect } {
    return { lines: this.queue.lines(), kinds: this.queue.toasts.map((t) => t.kind), paused: this.paused, rect: { ...this.rect } };
  },
};

interface Row {
  before: Text;
  after: Text;
  icon: Phaser.GameObjects.Image;
}

export class ToastScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private letters!: Phaser.GameObjects.Graphics;
  private rows: Row[] = [];
  private fitKey = '';
  private frame: ViewRect = { x: 0, y: 0, w: 480, h: 270 };
  private sheet: LetterSheet | null = null;
  private alive = false;

  constructor() {
    super('toasts');
  }

  preload(): void {
    preloadFonts(this);
    preloadSheets(this);
  }

  create(): void {
    registerFonts(this);
    registerSheetFrames(this);
    this.alive = true;
    this.fitKey = '';
    this.cameras.main.setOrigin(0, 0).setScroll(0, 0);
    // The scene is a layer over the others: no background, nothing interactive.
    this.cameras.main.transparent = true;
    this.g = this.add.graphics();
    this.letters = this.add.graphics();
    this.rows = [];
    if (!this.sheet)
      void loadLetterSheet().then(
        (sheet) => {
          if (this.alive) this.sheet = sheet;
        },
        (err: unknown) => {
          console.warn(err);
        },
      );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      toastStore.rect = { x: 0, y: 0, w: 0, h: 0 };
    });
  }

  /** The UI camera at zU over the whole canvas, and the world view's frame on it, as the holding scene fits them. */
  private fit(): void {
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const view = tuningStore.get().view;
    const key = `${Wd}x${Hd}:${view.widthPx},${view.minWidthPx},${view.minHeightPx},${view.maxHeightPx}`;
    if (key === this.fitKey) return;
    this.fitKey = key;
    const world = fitWorldView(Wd, Hd, view);
    const ui = fitUi(Wd, Hd);
    this.frame = viewInUi(world, ui.zU);
    this.cameras.main.setViewport(0, 0, Wd, Hd).setZoom(ui.zU).setScroll(0, 0);
  }

  private row(i: number): Row {
    let row = this.rows[i];
    if (row) return row;
    row = {
      before: body(this, 0, 0, '', Palette.uiInk).setVisible(false),
      after: body(this, 0, 0, '', Palette.uiInk).setVisible(false),
      icon: this.add.image(0, 0, ITEM_ICON_TEXTURE).setOrigin(0, 0).setVisible(false),
    };
    this.rows.push(row);
    return row;
  }

  override update(_time: number, delta: number): void {
    this.fit();
    if (!toastStore.paused) toastStore.queue.update(delta);
    const toasts = toastStore.paused ? [] : toastStore.queue.toasts;
    this.g.clear();
    this.letters.clear();
    for (const r of this.rows) {
      r.before.setVisible(false);
      r.after.setVisible(false);
      r.icon.setVisible(false);
    }
    if (toasts.length === 0) {
      toastStore.rect = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    // The strip's size follows its lines; its place is the HUD's toasts rectangle's corner (bottom left, at the inset).
    const parts = toasts.map((t) => splitLetters(t.text));
    const widths = toasts.map((_, i) => {
      const row = this.row(i);
      const p = parts[i] ?? { before: '', letters: '', after: '' };
      if (row.before.text !== p.before) row.before.setText(p.before);
      if (row.after.text !== p.after) row.after.setText(p.after);
      const lettersW = p.letters === '' ? 0 : p.letters.length * 8 + 1;
      return Math.round(row.before.width) + lettersW + (p.after === '' ? 0 : Math.round(row.after.width));
    });
    const w = HUD_PAD + TOAST_GLYPH + TOAST_GAP + Math.max(...widths) + HUD_PAD;
    const h = HUD_PAD + toasts.length * TOAST_ROW + HUD_PAD;
    const x = this.frame.x + HUD_INSET;
    const y = toastStripBottom(this.frame, MAX_W) - h;
    toastStore.rect = { x, y, w, h };
    panel(this.g, x, y, w, h, { plain: true, dither: toastStore.dither });
    toasts.forEach((t, i) => {
      const row = this.row(i);
      const p = parts[i] ?? { before: '', letters: '', after: '' };
      const ry = y + HUD_PAD + i * TOAST_ROW;
      const gx = x + HUD_PAD;
      // The glyph: the item's 16 px icon, or the 8 × 8 square of the muted ink centred in the glyph box.
      if (t.glyph.kind === 'item' && this.textures.exists(ITEM_ICON_TEXTURE) && this.textures.get(ITEM_ICON_TEXTURE).has(t.glyph.itemId)) {
        row.icon.setFrame(t.glyph.itemId).setPosition(gx, ry).setVisible(true);
      } else {
        this.g.fillStyle(Palette.uiInkMuted, 1).fillRect(gx + 4, ry + 4, 8, 8);
      }
      let tx = gx + TOAST_GLYPH + TOAST_GAP;
      const ty = ry + (TOAST_ROW - 8) / 2;
      place(row.before.setVisible(true), tx, ty);
      tx += Math.round(row.before.width);
      if (p.letters !== '') {
        if (this.sheet) plotLetters(this.letters, this.sheet, p.letters, tx, ty, { state: 'dim' });
        tx += p.letters.length * 8 + 1;
      }
      if (p.after !== '') place(row.after.setVisible(true), tx, ty);
    });
  }
}
