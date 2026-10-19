import type Phaser from 'phaser';
import { AWAY_TEXT } from '@iot/shared';
import type { Rect as ViewRect } from '../game/view.js';
import { Palette } from '../palette.js';
import { DEPTH } from '../render/depth.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The card (UI px): at least this wide, with its padding and the body line pitch. */
const MIN_W = 200;
const PAD = 8;
const ROW = 11;

export interface AwayCardHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  /** The world view's rectangle in UI px: the card is centred on it. */
  frame(): Readonly<ViewRect>;
}

/**
 * The While you were away card (docs/design/holding.md "Sleep, the away card
 * and toasts", M2 Task 7; GAME DESIGN: "not a toast but a card: it opens
 * over the holding on the first log-in after an absence of 30 minutes or
 * more, dismissed by any input"). A placeholder in the existing panel style
 * until ART's M2 UI kit: the title, the lines the server's card gives
 * (`awayLines`, in GAME DESIGN's order, six at most) in the body font, and
 * under a divider, muted, "Press any key." (the one "press X" line allowed,
 * since any input closes it). The scene owns the input: the card draws and
 * takes nothing.
 */
export class AwayCardPanel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Text;
  private readonly rows: Text[];
  private readonly hint: Text;
  private placed = '';

  constructor(
    private readonly host: AwayCardHost,
    readonly lines: readonly string[],
  ) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.title = label(scene, 0, 0, AWAY_TEXT.TITLE, Palette.uiInk);
    this.rows = lines.map((line) => body(scene, 0, 0, line, Palette.uiInk));
    this.hint = body(scene, 0, 0, AWAY_TEXT.PRESS_ANY, Palette.uiInkMuted);
    const objects = [this.g, this.title, ...this.rows, this.hint];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
    this.layout();
  }

  /** Centred on the view; redrawn when the frame moves. */
  layout(): void {
    const frame = this.host.frame();
    const widest = Math.max(Math.round(this.title.width), Math.round(this.hint.width), ...this.rows.map((t) => Math.round(t.width)));
    const w = Math.max(MIN_W, widest + 2 * PAD);
    const h = PAD + 10 + 4 + this.rows.length * ROW + 4 + 1 + 4 + ROW + PAD;
    const x = Math.round(frame.x + frame.w / 2 - w / 2);
    const y = Math.round(frame.y + frame.h / 2 - h / 2);
    const key = `${x},${y},${w},${h}`;
    if (key === this.placed) return;
    this.placed = key;
    this.g.clear();
    panel(this.g, x, y, w, h);
    let ly = y + PAD;
    place(this.title, x + PAD, ly);
    ly += 10 + 4;
    for (const t of this.rows) {
      place(t, x + PAD, ly);
      ly += ROW;
    }
    ly += 4;
    divider(this.g, x + PAD, ly, w - 2 * PAD);
    ly += 1 + 4;
    place(this.hint, x + PAD, ly);
  }

  /** The card's rectangle (UI px), for the playtests. */
  rect(): ViewRect {
    const frame = this.host.frame();
    const widest = Math.max(Math.round(this.title.width), Math.round(this.hint.width), ...this.rows.map((t) => Math.round(t.width)));
    const w = Math.max(MIN_W, widest + 2 * PAD);
    const h = PAD + 10 + 4 + this.rows.length * ROW + 4 + 1 + 4 + ROW + PAD;
    return { x: Math.round(frame.x + frame.w / 2 - w / 2), y: Math.round(frame.y + frame.h / 2 - h / 2), w, h };
  }

  snapshot(): { title: string; lines: string[]; hint: string } {
    return { title: this.title.text, lines: [...this.lines], hint: this.hint.text };
  }

  destroy(): void {
    for (const o of [this.g, this.title, ...this.rows, this.hint]) o.destroy();
  }
}
