import Phaser from 'phaser';
import { Controls } from '../game/controls.js';
import { formatTime } from '../game/seed.js';
import { Palette } from '../palette.js';
import { pixelText, registerPixelFont } from '../render/pixelFont.js';
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
    registerPixelFont(this);
    this.cameras.main.setBackgroundColor(Palette.wall);
    const { results: r, seed } = this.data_;
    const cleared = r.status === 'cleared';
    const cx = VIEW_W / 2;
    pixelText(this, cx, 34, cleared ? 'ISLAND CLEARED' : 'YOU FELL', cleared ? Palette.spark : Palette.danger, 2).setOrigin(0.5);
    pixelText(this, cx, 56, `SEED ${seed}`, Palette.locked).setOrigin(0.5);

    const rows: [string, string, number][] = [
      ['TIME', formatTime(r.ticks), Palette.pearl],
      ['ROOMS', `${r.roomsCleared}/3`, Palette.pearl],
      ['KILLS', `${r.kills}`, Palette.pearl],
      ['PERFECT DODGES', `${r.perfectDodges}`, Palette.spark],
      ['SPARKGLASS FOUND', `${r.sparkglassCollected}`, Palette.spark],
      [cleared ? 'SPARKGLASS KEPT (100%)' : 'SPARKGLASS KEPT (50%)', `${r.sparkglassKept}`, Palette.sparkDeep],
    ];
    const g = this.add.graphics();
    g.fillStyle(Palette.ink, 0.6).fillRect(cx - 120, 74, 240, rows.length * 16 + 12);
    rows.forEach(([label, value, color], i) => {
      const y = 82 + i * 16;
      pixelText(this, cx - 110, y, label, Palette.pearl);
      pixelText(this, cx + 110, y, value, color).setOrigin(1, 0);
    });
    const hint = pixelText(this, cx, VIEW_H - 34, 'PRESS ENTER OR CLICK TO CONTINUE', Palette.white).setOrigin(0.5);
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
