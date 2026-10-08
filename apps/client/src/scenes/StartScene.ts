import Phaser from 'phaser';
import { Controls } from '../game/controls.js';
import { parseSeed, randomSeed } from '../game/seed.js';
import { Palette } from '../palette.js';
import { pixelText, registerPixelFont, textWidth } from '../render/pixelFont.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

const MAX_SEED_LEN = 16;

/** Start screen: "Start run", the current seed, and a field to type a seed. */
export class StartScene extends Phaser.Scene {
  seedText = '';
  private field!: Phaser.GameObjects.BitmapText;
  private caret!: Phaser.GameObjects.Rectangle;
  private pad = { pad: true };

  constructor() {
    super('start');
  }

  create(): void {
    registerPixelFont(this);
    this.cameras.main.setBackgroundColor(Palette.wall);
    this.seedText = String(randomSeed());
    this.pad = { pad: true };
    const cx = VIEW_W / 2;

    const g = this.add.graphics();
    g.fillStyle(Palette.floor, 1).fillRect(0, VIEW_H - 60, VIEW_W, 60);
    g.fillStyle(Palette.wallEdge, 1).fillRect(0, VIEW_H - 64, VIEW_W, 4);
    // A Husk silhouette and a Sparkglass shard for mood.
    g.fillStyle(Palette.pearl, 0.35).fillCircle(cx + 150, 66, 18);
    g.fillStyle(Palette.core, 1).fillCircle(cx + 150, 66, 5);
    g.fillStyle(Palette.sparkDeep, 1).fillTriangle(cx - 150, 54, cx - 144, 66, cx - 156, 66).fillTriangle(cx - 150, 78, cx - 144, 66, cx - 156, 66);

    pixelText(this, cx, 40, 'ISLANDS OF THE ONE', Palette.sail, 2).setOrigin(0.5);
    pixelText(this, cx, 60, 'M1 COMBAT PROTOTYPE', Palette.locked).setOrigin(0.5);

    pixelText(this, cx - 92, 98, 'SEED', Palette.pearl);
    g.fillStyle(Palette.ink, 1).fillRect(cx - 60, 94, 150, 15);
    g.lineStyle(1, Palette.wallEdge, 1).strokeRect(cx - 60.5, 93.5, 151, 16);
    this.field = pixelText(this, cx - 56, 98, '', Palette.spark);
    this.caret = this.add.rectangle(0, 98, 5, 7, Palette.spark).setOrigin(0, 0);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 400, yoyo: true, repeat: -1 });
    pixelText(this, cx, 116, 'TYPE A SEED OR KEEP THIS ONE', Palette.locked).setOrigin(0.5);

    const start = this.button(cx - 64, 136, 'START RUN', () => {
      this.startRun();
    });
    this.button(cx + 64, 136, 'NEW SEED', () => {
      this.seedText = String(randomSeed());
    });
    this.tweens.add({ targets: start, alpha: 0.7, duration: 700, yoyo: true, repeat: -1 });

    const help = [
      'WASD MOVE   MOUSE AIM   LMB/J LIGHT   RMB/K HOLD HEAVY',
      'SPACE/SHIFT DODGE   Q LUNGE   F2 TUNING   F3 DEBUG',
      'GAMEPAD: L-STICK MOVE  R-STICK AIM  X LIGHT  Y/RT HEAVY  A DODGE  B LUNGE',
    ];
    help.forEach((line, i) => pixelText(this, cx, VIEW_H - 46 + i * 12, line, Palette.pearl).setOrigin(0.5));

    // Text entry reads DOM key events directly (Phaser's key queue is for game controls).
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') this.startRun();
      else if (e.key === 'Backspace') this.seedText = this.seedText.slice(0, -1);
      else if (/^[a-z0-9]$/i.test(e.key) && this.seedText.length < MAX_SEED_LEN) this.seedText += e.key.toUpperCase();
    };
    window.addEventListener('keydown', onKey);
    const onPaste = (e: ClipboardEvent) => {
      const text = (e.clipboardData?.getData('text') ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
      if (text) this.seedText = text.slice(0, MAX_SEED_LEN);
    };
    window.addEventListener('paste', onPaste);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    });
  }

  private button(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const w = textWidth(label) + 16;
    const bg = this.add.rectangle(0, 0, w, 16, Palette.sailDark).setStrokeStyle(1, Palette.sail);
    const text = pixelText(this, 0, 0, label, Palette.white).setOrigin(0.5);
    const c = this.add.container(x, y, [bg, text]);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    bg.on('pointerover', () => bg.setFillStyle(Palette.sailShade));
    bg.on('pointerout', () => bg.setFillStyle(Palette.sailDark));
    return c;
  }

  startRun(): void {
    const seed = parseSeed(this.seedText || '0');
    this.scene.start('game', { seed });
  }

  override update(): void {
    this.field.setText(this.seedText);
    this.caret.setX(VIEW_W / 2 - 56 + textWidth(this.seedText) + (this.seedText ? 2 : 0));
    if (Controls.confirmPressed(this.pad)) this.startRun();
  }
}
