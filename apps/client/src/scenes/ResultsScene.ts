import Phaser from 'phaser';
import { Controls } from '../game/controls.js';
import { formatTime } from '../game/seed.js';
import { Palette } from '../palette.js';
import { label, place } from '../render/text.js';
import { panel } from '../render/ui.js';
import type { ResultsData } from './GameScene.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

export class ResultsScene extends Phaser.Scene {
  private data_!: ResultsData;
  private pad = { pad: true };
  private ready = 0;

  constructor() {
    super('results');
  }

  init(data: ResultsData): void {
    this.data_ = data;
    this.pad = { pad: true };
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.void);
    const { results: r, seed, weapon } = this.data_;
    const cleared = r.status === 'cleared';
    const cx = VIEW_W / 2;
    place(label(this, 0, 0, cleared ? 'ISLAND CLEARED' : 'YOU FELL', cleared ? Palette.spark : Palette.healthLoss, 16), cx, 30, 0.5);
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
    const hint = place(label(this, 0, 0, 'PRESS ENTER OR CLICK TO CONTINUE', Palette.uiInk), cx, VIEW_H - 34, 0.5);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    this.ready = this.time.now + 500;
    const back = () => {
      if (this.time.now < this.ready) return;
      this.scene.start('start');
    };
    this.input.keyboard?.on('keydown-ENTER', back);
    this.input.keyboard?.on('keydown-SPACE', back);
    this.input.on('pointerdown', back);
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (Controls.confirmPressed(this.pad)) back();
    });
  }
}
