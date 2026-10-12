import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { isWeaponAvailable, type Tuning } from '@iot/sim';
import { Controls } from '../game/controls.js';
import { controlsStore } from '../game/controlsStore.js';
import { glyphsFor, padFamily } from '../game/gamepad.js';
import { keyboardBinding } from '../game/keyboard.js';
import { parseSeed, randomSeed } from '../game/seed.js';
import { tuningStore } from '../game/tuningStore.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { groundShadow } from '../render/pixels.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place } from '../render/text.js';
import { abilitySlot, divider, panel, tierPips } from '../render/ui.js';
import { drawKindled } from '../render/world.js';
import type { GameData } from './GameScene.js';
import { VIEW_H, VIEW_W } from './GameScene.js';

const MAX_SEED_LEN = 16;
const CARD_W = 136;
const CARD_H = 104;
const CARD_GAP = 8;
const CARD_Y = 62;

/**
 * Start screen: pick the run's weapon (one per run; only the Hookblade is
 * available yet, the rest show as locked), keep or type a seed, start.
 */
export class StartScene extends Phaser.Scene {
  seedText = '';
  weapon = 'hookblade';
  private field!: Phaser.GameObjects.Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private cards!: Phaser.GameObjects.Graphics;
  private pad = { pad: true };
  /** Divider y per card (between stats and lore). */
  private dividers: number[] = [];

  constructor() {
    super('start');
  }

  preload(): void {
    preloadSheets(this);
  }

  create(): void {
    registerSheetFrames(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.seedText = String(randomSeed());
    this.pad = { pad: true };
    const t: Tuning = tuningStore.get();
    const roster = t.weaponRoster;
    this.weapon = roster.find((w) => isWeaponAvailable(t, w.id))?.id ?? 'hookblade';
    const cx = VIEW_W / 2;

    const bg = this.add.graphics();
    bg.fillStyle(Palette.floor, 1).fillRect(0, VIEW_H - 34, VIEW_W, 34);
    bg.fillStyle(Palette.floorEdge, 1);
    for (let x = 0; x < VIEW_W; x++) if (x % 2 === 0) bg.fillRect(x, VIEW_H - 34, 1, 1);
    bg.fillRect(0, VIEW_H - 35, VIEW_W, 1);

    place(label(this, 0, 0, 'ISLANDS OF THE ONE', Palette.uiInk, 24), cx, 10, 0.5);
    place(label(this, 0, 0, 'M1 COMBAT PROTOTYPE', Palette.uiInkMuted), cx, 36, 0.5);
    place(label(this, 0, 0, 'CHOOSE YOUR WEAPON', Palette.uiInk), cx, 50, 0.5);

    // Weapon cards.
    this.cards = this.add.graphics();
    const x0 = Math.round(cx - (roster.length * CARD_W + (roster.length - 1) * CARD_GAP) / 2);
    roster.forEach((entry, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const weapon = t.weapons[entry.id];
      const available = isWeaponAvailable(t, entry.id);
      if (available && weapon) {
        place(label(this, 0, 0, weapon.name.toUpperCase()), x + 32, CARD_Y + 9);
        // Stats first; lore last, muted, below a divider (never italic).
        const stats = body(this, x + 10, CARD_Y + 32, weapon.blurb, Palette.uiInk, CARD_W - 20);
        this.dividers[i] = Math.round(stats.y + stats.height + 3);
        body(this, x + 10, (this.dividers[i] ?? 0) + 4, weapon.lore, Palette.uiInkMuted, CARD_W - 20);
      } else {
        place(label(this, 0, 0, entry.name, Palette.uiInkMuted), x + 32, CARD_Y + 9);
        body(this, x + 10, CARD_Y + 33, 'Not found yet.', Palette.uiInkMuted, CARD_W - 20);
      }
      const zone = this.add.zone(x, CARD_Y, CARD_W, CARD_H).setOrigin(0, 0).setInteractive({ useHandCursor: available });
      zone.on('pointerdown', () => {
        if (available) this.weapon = entry.id;
      });
    });

    // Seed.
    const seedY = CARD_Y + CARD_H + 10;
    place(label(this, 0, 0, 'SEED', Palette.uiInk), cx - 120, seedY + 4);
    const g = this.add.graphics();
    panel(g, cx - 84, seedY, 128, 16, { plain: true });
    this.field = label(this, cx - 79, seedY + 4, '', Palette.spark);
    this.caret = this.add.rectangle(0, seedY + 4, 1, 8, Palette.spark).setOrigin(0, 0);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 400, yoyo: true, repeat: -1 });
    this.button(cx + 50, seedY, 'NEW SEED', false, () => {
      this.seedText = String(randomSeed());
    });

    const start = this.button(cx - 40, seedY + 26, 'START RUN', true, () => {
      this.startRun();
    });
    this.tweens.add({ targets: start, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
    this.button(cx + 50, seedY + 26, 'CONTROLS', false, () => {
      this.scene.start('controls');
    });

    // Mood: the Kindled facing a Husk at the shore.
    const mood = this.add.graphics();
    groundShadow(mood, 60, VIEW_H - 22, 5, 2);
    drawKindled(mood, 60, VIEW_H - 27, 2);

    // Key hints as controller glyphs: the keyboard line, then the active pad preset in the connected pad's family.
    const key = (action: ControlAction): HintItem[] => glyphs([keyboardBinding(action)], 'keyboard');
    const connected = navigator.getGamepads().find((g): g is Gamepad => g !== null && g.connected);
    const family = connected ? padFamily(connected.id) : 'ps';
    const pad = controlsStore.get();
    const padKey = (action: ControlAction): HintItem[] => glyphs(glyphsFor(pad, action), family);
    const lines: HintItem[][] = [
      [
        ...glyphs(['W', 'A', 'S', 'D'], 'keyboard'),
        word('move  ·'),
        ...glyphs(['Mouse'], 'keyboard'),
        word('aim  ·'),
        ...key('light'),
        word('light  ·  hold'),
        ...key('heavy'),
        word('Hook-thrust  ·'),
        ...key('dodge'),
        word('dodge  ·'),
        ...key('ability1'),
        word('Haul  ·'),
        ...key('item1'),
        ...key('item2'),
        word('items'),
      ],
      [
        word(`Gamepad (${pad.name}):`),
        ...padKey('light'),
        word('light  ·  hold'),
        ...padKey('heavy'),
        word('Hook-thrust  ·'),
        ...padKey('dodge'),
        word('dodge  ·'),
        ...padKey('ability1'),
        word('Haul  ·  C controls  ·'),
        ...key('tuning'),
        word('tuning  ·  F3 debug'),
      ],
    ];
    lines.forEach((items, i) => {
      new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted })
        .setItems(items)
        .place(cx + 20, VIEW_H - 30 + i * 14, 0.5);
    });

    // Text entry reads DOM key events directly (Phaser's key queue is for game controls).
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') this.startRun();
      else if (e.key === 'c' || e.key === 'C') this.scene.start('controls');
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

  private drawCards(): void {
    const t: Tuning = tuningStore.get();
    const roster = t.weaponRoster;
    const g = this.cards;
    g.clear();
    const x0 = Math.round(VIEW_W / 2 - (roster.length * CARD_W + (roster.length - 1) * CARD_GAP) / 2);
    roster.forEach((entry, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const weapon = t.weapons[entry.id];
      const available = isWeaponAvailable(t, entry.id) && weapon !== undefined;
      const selected = available && entry.id === this.weapon;
      panel(g, x, CARD_Y, CARD_W, CARD_H, selected ? {} : { rim: Palette.uiBevel, plain: !available });
      abilitySlot(g, x + 8, CARD_Y + 7, { icon: 'hookblade', cooldown: 0, locked: !available, ready: selected });
      if (available) {
        tierPips(g, x + 32, CARD_Y + 21, weapon.tier);
        divider(g, x + 10, this.dividers[i] ?? CARD_Y + 63, CARD_W - 20);
      }
    });
  }

  /** Primary (spark-amber face) or secondary (bevel face) button. */
  private button(x: number, y: number, text: string, primary: boolean, onClick: () => void): Phaser.GameObjects.Container {
    const t = label(this, 0, 0, text, primary ? Palette.uiInkOnGlow : Palette.uiInk);
    const w = Math.round(t.width) + 14;
    const h = 15;
    const g = this.add.graphics();
    const draw = (hover: boolean): void => {
      g.clear();
      g.fillStyle(Palette.uiOutline, 1).fillRect(1, 0, w - 2, h + 1).fillRect(0, 1, w, h - 1);
      const face = primary ? (hover ? Palette.healthFill : Palette.spark) : hover ? Palette.floorEdge : Palette.uiBevel;
      const bevel = primary ? Palette.healthFill : Palette.floorEdge;
      g.fillStyle(face, 1).fillRect(1, 1, w - 2, h - 2);
      g.fillStyle(bevel, 1).fillRect(1, 1, w - 2, 1).fillRect(1, 1, 1, h - 2);
    };
    draw(false);
    place(t, w / 2, 4, 0.5);
    const c = this.add.container(Math.round(x), Math.round(y), [g, t]);
    const zone = this.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    c.add(zone);
    zone.on('pointerdown', onClick);
    zone.on('pointerover', () => {
      draw(true);
    });
    zone.on('pointerout', () => {
      draw(false);
    });
    return c;
  }

  startRun(): void {
    const seed = parseSeed(this.seedText || '0');
    const data: GameData = { seed, weapon: this.weapon };
    this.scene.start('game', data);
  }

  override update(): void {
    this.drawCards();
    this.field.setText(this.seedText);
    this.caret.setX(Math.round(this.field.x + this.field.width + 1));
    if (Controls.confirmPressed(this.pad)) this.startRun();
  }
}
