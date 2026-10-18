import type Phaser from 'phaser';
import { panel } from './ui.js';

/**
 * The canvas half of a text field: a plain Panel, with the glowing rim while
 * the field has focus. The text itself is a real HTML input laid over it
 * (ui/formFields.ts), so phones, password managers and IME work.
 */
export const FIELD_H = 16;

export class FieldFrame {
  focused = false;
  private readonly g: Phaser.GameObjects.Graphics;
  private drawn: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
  ) {
    this.g = scene.add.graphics();
  }

  get box(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.w, h: FIELD_H };
  }

  /** The panel's graphics, for a scene that keeps its UI in a layer. */
  get graphics(): Phaser.GameObjects.Graphics {
    return this.g;
  }

  destroy(): void {
    this.g.destroy();
  }

  /** Redraw when the focus changed; call every frame. */
  update(): void {
    if (this.drawn === this.focused) return;
    this.drawn = this.focused;
    this.g.clear();
    panel(this.g, this.x, this.y, this.w, FIELD_H, { plain: !this.focused });
  }
}
