import Phaser from 'phaser';
import { deviceStore } from '../game/activeDevice.js';
import { MENU_BUTTONS, padEdges } from '../game/gamepad.js';
import { formatTime } from '../game/seed.js';
import { Palette } from '../palette.js';
import { continueHint, menuCursor, padFamilyNow } from '../render/menus.js';
import { HintRow } from '../render/hint.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { label, place, preloadFonts, registerFonts } from '../render/text.js';
import { panel } from '../render/ui.js';
import type { ResultsData } from './GameScene.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

export class ResultsScene extends Phaser.Scene {
  private data_!: ResultsData;
  private pad = { prev: [] as boolean[] };
  private ready = 0;
  private hint!: HintRow;

  constructor() {
    super('results');
  }

  init(data: ResultsData): void {
    this.data_ = data;
    this.pad = { prev: [] };
  }

  preload(): void {
    preloadSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    menuCamera(this);
    const { results: r, seed, weapon } = this.data_;
    const cleared = r.status === 'cleared';
    const cx = UI_W / 2;
    place(label(this, 0, 0, cleared ? 'SHARD CLEARED' : 'YOU FELL', cleared ? Palette.spark : Palette.healthLoss, 16), cx, 30, 0.5);
    place(label(this, 0, 0, `SEED ${seed} · ${weapon.toUpperCase()}`, Palette.uiInkMuted), cx, 52, 0.5);

    const rows: [string, string, number][] = [
      ['TIME', formatTime(r.ticks), Palette.uiInk],
      ['ROOMS', `${r.roomsCleared}/3`, Palette.uiInk],
      ['KILLS', `${r.kills}`, Palette.uiInk],
      ['PERFECT DODGES', `${r.perfectDodges}`, Palette.spark],
      ['SPARKGLASS FOUND', `${r.sparkglassCollected}`, Palette.spark],
      [cleared ? 'SPARKGLASS KEPT (100%)' : 'SPARKGLASS KEPT (50%)', `${r.sparkglassKept}`, Palette.spark],
    ];
    const g = this.add.graphics();
    panel(g, cx - 128, 68, 256, rows.length * 14 + 16);
    rows.forEach(([name, value, color], i) => {
      const y = 78 + i * 14;
      place(label(this, 0, 0, name, Palette.uiInk), cx - 114, y);
      place(label(this, 0, 0, value, color), cx + 114, y, 1);
    });
    // The continue hint follows the active device: Enter or a click, or Cross on the pad.
    this.hint = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInk });
    this.tweens.add({ targets: this.hint.container, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    const sync = (): void => {
      this.hint.setItems(continueHint(deviceStore.get(), padFamilyNow())).place(cx, UI_H - 36, 0.5);
      menuCursor(this);
    };
    sync();
    const off = deviceStore.subscribe(sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    this.ready = this.time.now + 500;
    const back = () => {
      if (this.time.now < this.ready) return;
      this.scene.start('start');
    };
    this.input.keyboard?.on('keydown-ENTER', back);
    this.input.keyboard?.on('keydown-SPACE', back);
    this.input.on('pointerdown', back);
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      const edges = padEdges(this.pad);
      if (MENU_BUTTONS.confirm.some((b) => edges.includes(b))) back();
    });
  }
}
