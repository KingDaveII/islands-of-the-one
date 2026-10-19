import Phaser from 'phaser';
import { SLEEP_MS, SLEEP_TEXT } from '@iot/shared';
import { accountStore, api } from '../api.js';
import { UI_H, UI_W } from '../game/view.js';
import { Palette } from '../palette.js';
import { menuCamera } from '../render/cameras.js';
import { body, place, preloadFonts, registerFonts } from '../render/text.js';

/**
 * Sleep (docs/design/holding.md "Sleep, the away card and toasts", M2 Task
 * 7; GAME DESIGN: "Lying down by the Writ post is the in-world log-out").
 * The Writ panel's SLEEP cuts here with no fade: the Hollow's background and
 * one line in the body font (a placeholder until LORE's; ART's `lie_down`
 * row joins later). After `sleepMs` the client logs out (POST /api/logout)
 * and lands on the start screen the way the start screen's LOG OUT does; a
 * failed log-out lands there too. The holding scene is gone by then, so its
 * heartbeat has stopped; the active action keeps running on the server up
 * to the cap, as it does whenever the tab closes.
 */
export class SleepScene extends Phaser.Scene {
  /** The line shown (playtests). */
  readonly line: string = SLEEP_TEXT.LYING;
  private leaving = false;

  constructor() {
    super('sleep');
  }

  preload(): void {
    preloadFonts(this);
  }

  create(): void {
    registerFonts(this);
    this.leaving = false;
    this.cameras.main.setBackgroundColor(Palette.hollow);
    menuCamera(this);
    place(body(this, 0, 0, this.line, Palette.uiInk), UI_W / 2, UI_H / 2, 0.5, 0.5);
    this.time.delayedCall(SLEEP_MS, () => {
      this.logOut();
    });
  }

  /** End the session on the server and go to the account screen, as StartScene's LOG OUT does; a failure lands there too. */
  private logOut(): void {
    if (this.leaving) return;
    this.leaving = true;
    void api.logout().then(() => {
      accountStore.current = null;
      this.scene.start('account');
    });
  }
}
