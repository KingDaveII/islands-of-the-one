import type Phaser from 'phaser';
import { Palette } from '../palette.js';
import { label, place } from './text.js';

/**
 * A menu button: primary (spark-amber face) or secondary (bevel face), a
 * 1 px ui-outline outline with chamfered corners, lit by hover. A focused
 * button (pad or keyboard navigation) draws its outline in ui-focus.
 */
export interface Button {
  readonly container: Phaser.GameObjects.Container;
  readonly width: number;
  readonly height: number;
  setFocused(focused: boolean): void;
  /** A disabled button keeps its place, draws sunken with muted ink, and ignores presses. */
  setEnabled(enabled: boolean): void;
  readonly enabled: boolean;
}

export const BUTTON_H = 15;

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  primary: boolean,
  onClick: () => void,
): Button {
  const t = label(scene, 0, 0, text, primary ? Palette.uiInkOnGlow : Palette.uiInk);
  const w = Math.round(t.width) + 14;
  const h = BUTTON_H;
  const g = scene.add.graphics();
  let hover = false;
  let focused = false;
  let enabled = true;
  const draw = (): void => {
    g.clear();
    g.fillStyle(focused ? Palette.uiFocus : Palette.uiOutline, 1)
      .fillRect(1, 0, w - 2, h + 1)
      .fillRect(0, 1, w, h - 1);
    if (!enabled) {
      // Sunken: the panel face with the bevel along the bottom and right, the word muted.
      g.fillStyle(Palette.uiPanel, 1).fillRect(1, 1, w - 2, h - 2);
      g.fillStyle(Palette.uiBevel, 1)
        .fillRect(1, h - 2, w - 2, 1)
        .fillRect(w - 2, 1, 1, h - 2);
      t.setTint(Palette.uiInkMuted);
      return;
    }
    t.setTint(primary ? Palette.uiInkOnGlow : Palette.uiInk);
    const lit = hover || focused;
    const face = primary
      ? lit
        ? Palette.healthFill
        : Palette.spark
      : lit
        ? Palette.floorEdge
        : Palette.uiBevel;
    const bevel = primary ? Palette.healthFill : Palette.floorEdge;
    g.fillStyle(face, 1).fillRect(1, 1, w - 2, h - 2);
    g.fillStyle(bevel, 1)
      .fillRect(1, 1, w - 2, 1)
      .fillRect(1, 1, 1, h - 2);
  };
  draw();
  place(t, w / 2, 4, 0.5);
  const c = scene.add.container(Math.round(x), Math.round(y), [g, t]);
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  c.add(zone);
  zone.on('pointerdown', () => {
    if (enabled) onClick();
  });
  zone.on('pointerover', () => {
    hover = true;
    draw();
  });
  zone.on('pointerout', () => {
    hover = false;
    draw();
  });
  return {
    container: c,
    width: w,
    height: h,
    setFocused(on: boolean): void {
      if (on === focused) return;
      focused = on;
      draw();
    },
    setEnabled(on: boolean): void {
      if (on === enabled) return;
      enabled = on;
      draw();
    },
    get enabled(): boolean {
      return enabled;
    },
  };
}
