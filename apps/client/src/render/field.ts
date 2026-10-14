import type Phaser from 'phaser';
import { tiny5Font } from '@iot/shared';
import { displayable, masked } from '../game/textInput.js';
import { Palette } from '../palette.js';
import { body, type Text } from './text.js';
import { panel } from './ui.js';

/**
 * A text field: a plain Panel (the glowing rim while it has focus), the value
 * in Tiny5 body text (a password as *), and a caret that blinks in whole
 * steps while focused. A value wider than the field shows its end. Input is
 * the scene's (game/textInput.ts); this only draws.
 */
export const FIELD_H = 16;
const PAD = 6;
const BLINK_MS = 500;

export class TextField {
  value = '';
  focused = false;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly text: Text;
  private readonly caret: Phaser.GameObjects.Rectangle;
  readonly zone: Phaser.GameObjects.Zone;
  private shown: string | null = null;
  private drawnFocus: boolean | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly w: number,
    private readonly opts: { masked?: boolean } = {},
  ) {
    this.g = scene.add.graphics();
    this.text = body(scene, x + PAD, y + 4, '', Palette.uiInk);
    this.caret = scene.add.rectangle(0, y + 4, 1, 8, Palette.uiFocus).setOrigin(0, 0);
    this.zone = scene.add
      .zone(x, y, w, FIELD_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
  }

  /** Redraw for the current value and focus; call every frame. */
  update(): void {
    if (this.drawnFocus !== this.focused) {
      this.drawnFocus = this.focused;
      this.g.clear();
      panel(this.g, this.x, this.y, this.w, FIELD_H, { plain: !this.focused });
    }
    const raw = this.opts.masked ? masked(this.value) : displayable(this.value, tiny5Font);
    if (raw !== this.shown) {
      this.shown = raw;
      // Keep the end in view: drop characters from the front until it fits.
      let chars = Array.from(raw);
      this.text.setText(raw);
      while (chars.length > 0 && this.text.width > this.w - 2 * PAD - 2) {
        chars = chars.slice(1);
        this.text.setText(chars.join(''));
      }
    }
    this.caret.setX(Math.round(this.text.x + this.text.width + 1));
    const blinkOn = Math.floor(this.scene.time.now / BLINK_MS) % 2 === 0;
    this.caret.setVisible(this.focused && blinkOn);
  }
}
