import Phaser from 'phaser';
import { measureText, tiny5Font } from '@iot/shared';
import { deviceStore } from '../game/activeDevice.js';
import { lineScale, portraitBlocked, TURN_SIDEWAYS } from '../game/orientation.js';
import { fitUi } from '../game/view.js';
import { Palette } from '../palette.js';
import { body, place, preloadFonts, registerFonts, type Text } from '../render/text.js';

/**
 * Landscape only (M2 Task 10, controls.md §6): on a touch device held in
 * portrait the game is covered by one line, "Turn your phone sideways.", in
 * BitmapText on the Hollow, and every running scene is paused under it (the
 * DOM form inputs hidden with them); turning back resumes the scenes it
 * paused, where they were. A scene over all the others, always running.
 */
export class PortraitScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Rectangle;
  private line!: Text;
  /** The scenes this one paused, to resume and no others. */
  private paused = new Set<string>();
  blocked = false;

  constructor() {
    super('portrait');
  }

  preload(): void {
    preloadFonts(this);
  }

  create(): void {
    registerFonts(this);
    this.cameras.main.setOrigin(0, 0).setScroll(0, 0);
    this.cameras.main.transparent = true;
    this.bg = this.add.rectangle(0, 0, 1, 1, Palette.hollow, 1).setOrigin(0, 0).setVisible(false);
    this.line = body(this, 0, 0, TURN_SIDEWAYS, Palette.uiInk).setVisible(false);
  }

  private touchScreen(): boolean {
    return deviceStore.get() === 'touch' || window.matchMedia('(pointer: coarse)').matches;
  }

  override update(): void {
    const blocked = portraitBlocked(window.innerWidth, window.innerHeight, this.touchScreen());
    const manager = this.game.scene;
    if (blocked) {
      // Pause whatever runs under the line, scenes started since included.
      for (const s of manager.getScenes(true)) {
        const key = s.scene.key;
        if (key === this.scene.key) continue;
        manager.pause(key);
        this.paused.add(key);
      }
      manager.bringToTop(this.scene.key);
    } else if (this.blocked) {
      for (const key of this.paused) if (manager.isPaused(key)) manager.resume(key);
      this.paused.clear();
    }
    if (blocked !== this.blocked) document.body.classList.toggle('turn-sideways', blocked);
    this.blocked = blocked;
    this.bg.setVisible(blocked);
    this.line.setVisible(blocked);
    if (!blocked) return;
    const ui = fitUi(this.scale.width, this.scale.height);
    this.cameras.main.setViewport(0, 0, this.scale.width, this.scale.height).setZoom(ui.zU);
    this.bg.setSize(ui.w + 1, ui.h + 1);
    const k = lineScale(ui.w, measureText(tiny5Font, TURN_SIDEWAYS));
    this.line.setScale(k);
    place(this.line, ui.w / 2, ui.h / 2, 0.5, 0.5);
  }
}

/**
 * Full screen on the first touch on the game (Android; iOS Safari has none
 * for pages: the manifest's "Add to Home Screen" opens it full screen), and
 * the screen locked to landscape where full screen allows it. A refusal is
 * ignored; a touch on a form input never asks (the keyboard is coming).
 */
export function askFullScreenOnFirstTouch(canvasParent: HTMLElement): void {
  const ask = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch' || !(e.target instanceof HTMLCanvasElement)) return;
    window.removeEventListener('pointerdown', ask, true);
    const el = canvasParent.ownerDocument.documentElement;
    if (typeof el.requestFullscreen !== 'function' || document.fullscreenElement) return;
    el.requestFullscreen({ navigationUI: 'hide' }).then(
      () => {
        // Not every browser has the orientation lock (Safari has none): ask only where it exists.
        const orientation = screen.orientation as ScreenOrientation | undefined;
        if (orientation && typeof (orientation as unknown as Record<string, unknown>).lock === 'function')
          (orientation as unknown as { lock: (o: string) => Promise<void> }).lock('landscape').catch(() => undefined);
      },
      () => undefined,
    );
  };
  window.addEventListener('pointerdown', ask, true);
}
