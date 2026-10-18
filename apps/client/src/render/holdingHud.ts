import Phaser from 'phaser';
import { shapeLetters } from '@iot/shared';
import type { Rect as ViewRect } from '../game/view.js';
import type { ChipState } from '../game/holdingView.js';
import type { WritChip } from '../game/writView.js';
import { Palette } from '../palette.js';
import { plotLetters, type LetterSheet } from './letters.js';
import { arcPixels, circlePixels } from './pixelShapes.js';
import { plot } from './pixels.js';
import { body, label, place, type Text } from './text.js';
import { icon, panel } from './ui.js';

/** HUD inset from the world view's edge and panel padding (UI px). */
const INSET = 8;
const PAD = 4;
const ICON = 16;
const CHIP_W = 122;
const CHIP_H = 26;
const RING_R = 7;
const XP_W = 66;
const XP_H = 2;

/** A zone's hit area follows its size (Phaser types the hit area as any; a zone's is the rectangle it was made with). */
function hitRect(zone: Phaser.GameObjects.Zone, w: number, h: number): void {
  const area: unknown = zone.input?.hitArea;
  if (area instanceof Phaser.Geom.Rectangle) area.setSize(w, h);
}

/** The top-left Writ block: the island's Name as typed and its letters (none before it is named), and the Writ chip. */
export interface WritHud {
  name: { typed: string; letters: string } | null;
  chip: WritChip;
}

/**
 * The holding's HUD (docs/design/holding.md), placeholder panels in the
 * existing panel style until ART's M2 UI kit: top left the island's Name as
 * typed (BitmapText) and its letters (the letter sheet) with the Writ chip
 * (the charge in words, ember under a day, מת when dark or fading, the exact
 * time as its tooltip; the chip alone before the island is named); bottom
 * centre the active-action chip (the station's placeholder icon, the skill
 * and level, a progress ring for the current cycle, a thin XP bar; empty
 * while idle; clicking it stops), bottom right the pack button with its fill
 * (opens the inventory with the store pane), top right the gin purse. On the
 * UI grid at the edges of the world view, like the run's HUD.
 */
export class HoldingHud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly initials: Text;
  private readonly skill: Text;
  private readonly pack: Text;
  private readonly gin: Text;
  private readonly name: Text;
  private readonly writWords: Text;
  private readonly writTip: Text;
  private readonly chipZone: Phaser.GameObjects.Zone;
  private readonly packZone: Phaser.GameObjects.Zone;
  private readonly writZone: Phaser.GameObjects.Zone;
  private frame: ViewRect = { x: 0, y: 0, w: 480, h: 270 };
  /** The chip's rectangle last frame (UI px), empty while idle. */
  chipRect: ViewRect = { x: 0, y: 0, w: 0, h: 0 };
  packRect: ViewRect = { x: 0, y: 0, w: 0, h: 0 };
  writRect: ViewRect = { x: 0, y: 0, w: 0, h: 0 };
  /** Whether the Writ chip's tooltip (the exact time) shows: the pointer is over the chip. */
  writTipVisible = false;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly onStop: () => void,
    private readonly onPack: () => void,
  ) {
    this.g = scene.add.graphics();
    this.initials = label(scene, 0, 0, '');
    this.skill = label(scene, 0, 0, '');
    this.pack = label(scene, 0, 0, 'PACK 0/20');
    this.gin = label(scene, 0, 0, '0');
    this.name = label(scene, 0, 0, '').setVisible(false);
    this.writWords = body(scene, 0, 0, '').setVisible(false);
    this.writTip = body(scene, 0, 0, '').setVisible(false);
    this.chipZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0);
    this.packZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.writZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.chipZone.on('pointerdown', () => {
      this.onStop();
    });
    this.packZone.on('pointerdown', () => {
      this.onPack();
    });
    this.writZone.on('pointerover', () => {
      this.writTipVisible = true;
    });
    this.writZone.on('pointerout', () => {
      this.writTipVisible = false;
    });
    layer.add([
      this.g,
      this.initials,
      this.skill,
      this.pack,
      this.gin,
      this.name,
      this.writWords,
      this.writTip,
      this.chipZone,
      this.packZone,
      this.writZone,
    ]);
  }

  setFrame(frame: ViewRect): void {
    this.frame = { ...frame };
  }

  /** Draw the HUD: the chip from its state (null while idle), the pack's fill, the purse, and the Writ block (null until the holding answered). */
  draw(chip: ChipState | null, packFill: string, gin: number, writ: WritHud | null, sheet: LetterSheet | null): void {
    const g = this.g;
    g.clear();
    const { x: L, y: T } = this.frame;
    const R = this.frame.x + this.frame.w;
    const B = this.frame.y + this.frame.h;

    // Top right: the purse.
    if (this.gin.text !== String(gin)) this.gin.setText(String(gin));
    const trW = PAD + 10 + 3 + Math.max(this.gin.width, 8) + PAD;
    const trH = PAD + 10 + PAD;
    panel(g, R - INSET - trW, T + INSET, trW, trH, { plain: true });
    icon(g, 'spark', R - INSET - trW + PAD, T + INSET + PAD, 10, Palette.spark);
    place(this.gin, R - INSET - trW + PAD + 13, T + INSET + PAD + 1);

    // Top left: the island's Name, its letters, the Writ chip.
    this.drawWrit(L + INSET, T + INSET, writ, sheet);

    // Bottom right: the pack button.
    const packText = `PACK ${packFill}`;
    if (this.pack.text !== packText) this.pack.setText(packText);
    const brW = PAD + this.pack.width + PAD;
    const brH = PAD + 8 + PAD;
    const brX = R - INSET - brW;
    const brY = B - INSET - brH;
    panel(g, brX, brY, brW, brH, { plain: true });
    place(this.pack, brX + PAD, brY + PAD);
    this.packRect = { x: brX, y: brY, w: brW, h: brH };
    this.packZone.setPosition(brX, brY).setSize(brW, brH);
    hitRect(this.packZone, brW, brH);

    // Bottom centre: the active-action chip.
    if (!chip) {
      this.initials.setVisible(false);
      this.skill.setVisible(false);
      this.chipRect = { x: 0, y: 0, w: 0, h: 0 };
      if (this.chipZone.input) this.chipZone.disableInteractive();
      return;
    }
    const cx = Math.round(L + this.frame.w / 2);
    const x = cx - CHIP_W / 2;
    const y = B - INSET - CHIP_H;
    panel(g, x, y, CHIP_W, CHIP_H, { plain: true });
    this.chipRect = { x, y, w: CHIP_W, h: CHIP_H };
    if (!this.chipZone.input) this.chipZone.setInteractive({ useHandCursor: true });
    this.chipZone.setPosition(x, y).setSize(CHIP_W, CHIP_H);
    hitRect(this.chipZone, CHIP_W, CHIP_H);
    // The station's placeholder icon: its initials in a sunken box.
    const ix = x + PAD + 1;
    const iy = y + PAD + 1;
    g.fillStyle(Palette.uiOutline, 1).fillRect(ix, iy, ICON, ICON);
    g.fillStyle(Palette.uiBevel, 1).fillRect(ix + 1, iy + 1, ICON - 2, ICON - 2);
    g.fillStyle(Palette.uiPanel, 1).fillRect(ix + 2, iy + 2, ICON - 4, ICON - 4);
    if (this.initials.text !== chip.initials) this.initials.setText(chip.initials);
    place(this.initials.setVisible(true), ix + ICON / 2, iy + ICON / 2 - 1, 0.5, 0.5);
    // The skill and level, with the thin XP bar to the next level under it.
    if (this.skill.text !== chip.skill) this.skill.setText(chip.skill);
    const sx = ix + ICON + PAD;
    place(this.skill.setVisible(true), sx, iy + 1);
    g.fillStyle(Palette.uiOutline, 1).fillRect(sx, iy + 12, XP_W + 2, XP_H + 2);
    g.fillStyle(Palette.uiBevel, 1).fillRect(sx + 1, iy + 13, XP_W, XP_H);
    const xpW = Math.round(XP_W * Math.max(0, Math.min(1, chip.xp)));
    if (xpW > 0) g.fillStyle(Palette.spark, 1).fillRect(sx + 1, iy + 13, xpW, XP_H);
    // The progress ring: the cycle's share, clockwise from 12 o'clock, in whole pixels.
    const rx = x + CHIP_W - PAD - RING_R - 2;
    const ry = y + CHIP_H / 2;
    plot(g, circlePixels(RING_R), rx, ry, Palette.uiBevel);
    const sweep = Math.max(0, Math.min(1, chip.ring)) * Math.PI * 2;
    if (sweep > 0) plot(g, arcPixels(RING_R, 2, -Math.PI / 2, -Math.PI / 2 + sweep), rx, ry, Palette.spark);
  }

  /**
   * The Writ block at (x, y): the Name as typed over its letters (the letter
   * sheet, lit) over the chip line: the charge in words, ember under a day,
   * or מת from the sheet when dark or fading. Before the island is named,
   * the chip alone. The tooltip (the exact time) shows while the pointer is
   * over it.
   */
  private drawWrit(x: number, y: number, writ: WritHud | null, sheet: LetterSheet | null): void {
    const g = this.g;
    if (!writ) {
      this.name.setVisible(false);
      this.writWords.setVisible(false);
      this.writTip.setVisible(false);
      this.writRect = { x: 0, y: 0, w: 0, h: 0 };
      return;
    }
    const { name, chip } = writ;
    const chipColor = chip.ember ? Palette.writEmber : Palette.uiInk;
    if (chip.text !== null) {
      if (this.writWords.text !== chip.text) this.writWords.setText(chip.text);
      this.writWords.setTint(chipColor).setVisible(true);
    } else this.writWords.setVisible(false);
    if (name) {
      if (this.name.text !== name.typed) this.name.setText(name.typed);
      this.name.setVisible(true);
    } else this.name.setVisible(false);
    const lettersW = name ? shapeLetters(name.letters).width : 0;
    const chipW = chip.text !== null ? Math.round(this.writWords.width) : shapeLetters(chip.letters ?? '').width;
    const w = PAD + Math.max(name ? Math.round(this.name.width) : 0, lettersW, chipW, 24) + PAD;
    const h = PAD + (name ? 10 + 8 + 3 : 0) + 8 + PAD;
    panel(g, x, y, w, h, { plain: true });
    let ly = y + PAD;
    if (name) {
      place(this.name, x + PAD, ly);
      ly += 10;
      if (sheet) plotLetters(g, sheet, name.letters, x + PAD, ly, { state: chip.gold ? 'gold' : 'lit' });
      ly += 8 + 3;
    }
    if (chip.text !== null) place(this.writWords, x + PAD, ly);
    else if (sheet && chip.letters !== null) plotLetters(g, sheet, chip.letters, x + PAD, ly, { state: 'dim' });
    this.writRect = { x, y, w, h };
    this.writZone.setPosition(x, y).setSize(w, h);
    hitRect(this.writZone, w, h);
    // The tooltip: the exact time, under the block.
    if (this.writTip.text !== chip.tooltip) this.writTip.setText(chip.tooltip);
    this.writTip.setVisible(this.writTipVisible);
    if (this.writTipVisible) {
      const tw = Math.round(this.writTip.width) + 2 * PAD;
      panel(g, x, y + h + 2, tw, 8 + 2 * PAD, { plain: true });
      place(this.writTip, x + PAD, y + h + 2 + PAD);
    }
  }
}
