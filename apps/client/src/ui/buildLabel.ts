import Phaser from 'phaser';
import { buildStore } from '../game/build.js';
import { UI_W } from '../game/view.js';
import { Palette } from '../palette.js';
import { body, place, type Text } from '../render/text.js';

/** The label's inset from the layout's right edge (UI px): the menus' own margin. */
const INSET = 6;

/**
 * The build label at the bottom right of a menu screen (game/build.ts): Tiny5
 * in the muted ink, right-aligned `INSET` in from M1's 480 × 270 layout with
 * its bottom at `bottom` (UI px), so each screen puts it in the band its
 * menu leaves free. It asks the server its build and rewrites itself when the
 * answer differs from the client's.
 */
export function buildLabel(scene: Phaser.Scene, bottom: number): Text {
  const t = body(scene, 0, 0, buildStore.snapshot().label, Palette.uiInkMuted);
  const fit = (): void => {
    place(t, UI_W - INSET, bottom, 1, 1);
  };
  fit();
  const off = buildStore.subscribe(() => {
    if (!t.active) return;
    t.setText(buildStore.snapshot().label);
    fit();
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  void buildStore.ask();
  return t;
}
