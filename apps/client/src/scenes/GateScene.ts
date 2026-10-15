import Phaser from 'phaser';
import type { MeResponse } from '@iot/shared';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { MENU_BUTTONS, padEdges, padEdgeState } from '../game/gamepad.js';
import { Palette } from '../palette.js';
import { HintRow } from '../render/hint.js';
import { continueHint, padFamilyNow } from '../render/menus.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { preloadSpriteSheets, registerSpriteSheets } from '../render/spriteSheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

/** Where a signed-in account goes: Kindled creation until it has one, then the start screen. */
export function sceneFor(me: MeResponse): 'creation' | 'start' {
  return me.kindled ? 'start' : 'creation';
}

/**
 * The first scene: loads the shared textures, asks the server who is signed
 * in (GET /api/me) and sends the player on: no session to the account scene,
 * no Kindled yet to creation, otherwise the start screen. If the server
 * can't be reached it says so; Enter (Cross) asks again.
 */
export class GateScene extends Phaser.Scene {
  private status!: Text;
  private hint!: HintRow;
  private pad = { prev: [] as boolean[] };
  private failed = false;
  private asking = false;

  constructor() {
    super('gate');
  }

  preload(): void {
    preloadSheets(this);
    preloadSpriteSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerSpriteSheets(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    menuCamera(this);
    this.pad = padEdgeState();
    place(label(this, 0, 0, 'ISLANDS OF THE ONE', Palette.uiInk, 24), UI_W / 2, 10, 0.5);
    this.status = body(this, 0, 0, '...', Palette.uiInkMuted, UI_W - 80);
    this.hint = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted });
    this.hint.setVisible(false);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') this.ask();
    };
    window.addEventListener('keydown', onKey);
    this.input.on('pointerdown', () => {
      if (this.failed) this.ask();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
    });
    this.ask();
  }

  private ask(): void {
    if (this.asking) return;
    this.asking = true;
    this.failed = false;
    this.show('...');
    void api.me().then((res) => {
      this.asking = false;
      if (res.ok) {
        accountStore.current = res.value;
        this.scene.start(sceneFor(res.value));
      } else if (res.error === 'not-signed-in') {
        accountStore.current = null;
        this.scene.start('account');
      } else {
        this.failed = true;
        this.show(res.message);
      }
    });
  }

  private show(text: string): void {
    this.status.setText(text);
    place(this.status, UI_W / 2, UI_H / 2 - 8, 0.5);
  }

  override update(): void {
    this.hint.setVisible(this.failed);
    if (this.failed) {
      this.hint.setItems(continueHint(deviceStore.get(), padFamilyNow()));
      this.hint.place(UI_W / 2, UI_H / 2 + 8, 0.5);
    }
    const edges = padEdges(this.pad);
    if (this.failed && MENU_BUTTONS.confirm.some((b) => edges.includes(b))) this.ask();
  }
}
