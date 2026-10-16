import type Phaser from 'phaser';
import { hookbladeFxSheet, type HookbladeFxSheet } from '@iot/shared';
import { Palette } from '../palette.js';
import { DEPTH } from './depth.js';
import { chainLinks, hookbladeDraw } from './hookbladePoints.js';
import { HOOKBLADE_TEXTURE } from './sheets.js';

/**
 * The Hookblade's sprites from hookblade-fx (packages/shared/assets): the
 * Haul chain (one link per `chain.spacing` sheet px, every link taut during
 * the pull), the hook head (in flight / set, rotated to the throw angle
 * around its shank end) and the charge spark at the hook tip. A pool of
 * images the world renderer re-poses every frame; links sit under the bodies,
 * the hook and spark over them.
 *
 * Callers pass world px. The sheet's `meta` (sprites.md "Engine sheets") says
 * how it draws: at `pixelScale` world px per sheet px (2 for today's M1
 * sheet), and either tinted (palette tokens, with a 1 sheet px
 * player-outline rim from four offset copies) or, untinted, in the frames'
 * own colours with no rim.
 */
type Image = Phaser.GameObjects.Image;

const MAX_LINKS = 16;
const RIM: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

interface Slot {
  ink: Image;
  rim: Image[];
}

export class HookbladeFx {
  private readonly links: Slot[] = [];
  private readonly hookSlot: Slot;
  private readonly sparkImage: Image;
  private readonly draw: ReturnType<typeof hookbladeDraw>;
  private readonly sparkFrames: readonly string[];
  private linksUsed = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sheet: HookbladeFxSheet = hookbladeFxSheet,
  ) {
    this.draw = hookbladeDraw(sheet);
    this.sparkFrames = sheet.anims.charge_spark.frames;
    for (let i = 0; i < MAX_LINKS; i++) this.links.push(this.slot(sheet.chain.link, 0.5, 0.5));
    this.hookSlot = this.slot(sheet.hook.flight, 0, 0);
    this.sparkImage = this.image(this.sparkFrames[0] ?? sheet.hook.flight, 0.5, 0.5);
  }

  /** Adds the pool to a layer: links under the bodies, the hook and spark over them (depth.ts). */
  mount(layer: Phaser.GameObjects.Layer): void {
    for (const l of this.links) layer.add([...l.rim, l.ink].map((img) => img.setDepth(DEPTH.chain)));
    layer.add([...this.hookSlot.rim, this.hookSlot.ink, this.sparkImage].map((img) => img.setDepth(DEPTH.overlay)));
  }

  private image(frame: string, ox: number, oy: number): Image {
    return this.scene.add
      .image(0, 0, HOOKBLADE_TEXTURE, frame)
      .setOrigin(ox, oy)
      .setScale(this.draw.scale)
      .setVisible(false);
  }

  private slot(frame: string, ox: number, oy: number): Slot {
    return {
      ink: this.image(frame, ox, oy),
      // An untinted sheet has its outline drawn in: no rim.
      rim: this.draw.tinted ? RIM.map(() => this.image(frame, ox, oy).setTint(Palette.chainOutline)) : [],
    };
  }

  /** Pose a slot at world px (x, y), tinted when the sheet is. */
  private pose(s: Slot, frame: string, x: number, y: number, angle: number, tint: number): void {
    const all = [s.ink, ...s.rim];
    for (const img of all) {
      if (img.frame.name !== frame) img.setFrame(frame, true, false);
      img.setRotation(angle).setVisible(true);
    }
    s.ink.setPosition(x, y);
    if (this.draw.tinted) s.ink.setTint(tint);
    s.rim.forEach((img, i) => {
      const [dx, dy] = RIM[i] ?? [0, 0];
      img.setPosition(x + dx * this.draw.scale, y + dy * this.draw.scale);
    });
  }

  private hide(s: Slot): void {
    s.ink.setVisible(false);
    for (const img of s.rim) img.setVisible(false);
  }

  /** Start a frame: nothing is drawn until posed. */
  begin(): void {
    for (const l of this.links) this.hide(l);
    this.hide(this.hookSlot);
    this.sparkImage.setVisible(false);
    this.linksUsed = 0;
  }

  /** The chain from the hand (hx, hy) to the hook (ex, ey), world px: a link every `spacing`, taut links during the pull. */
  chain(hx: number, hy: number, ex: number, ey: number, taut: boolean): void {
    const frame = taut ? this.sheet.chain.taut : this.sheet.chain.link;
    for (const link of chainLinks(this.sheet, hx, hy, ex, ey, this.links.length - this.linksUsed)) {
      const slot = this.links[this.linksUsed++];
      if (!slot) break;
      this.pose(slot, frame, link.x, link.y, link.angle, taut ? Palette.chainTaut : Palette.chain);
    }
  }

  /** The hook head with its shank end at world px (x, y), pointing along `angle` (radians); `set` once it has landed. */
  hook(x: number, y: number, angle: number, set: boolean): void {
    const [ox = 0, oy = 0] = this.sheet.hook.origin;
    const frame = set ? this.sheet.hook.set : this.sheet.hook.flight;
    this.pose(this.hookSlot, frame, x, y, angle, Palette.chain);
    // The origin is a pixel of the cell (sheet px): rotate around that pixel's center.
    for (const img of [this.hookSlot.ink, ...this.hookSlot.rim]) img.setDisplayOrigin(ox + 0.5, oy + 0.5);
  }

  /**
   * The charge spark at world px (x, y), the hook tip, by the charge meter's
   * `stage` (0-3): spark_0 from the start through the first stage, spark_1 in
   * the second, spark_2 held at full charge (stage 3, in husk-core when tinted).
   */
  spark(x: number, y: number, stage: number): void {
    const frames = this.sparkFrames;
    const index = Math.max(0, Math.min(frames.length - 1, stage - 1));
    const frame = frames[index] ?? frames[0] ?? '';
    const full = index === frames.length - 1;
    const img = this.sparkImage;
    if (img.frame.name !== frame) img.setFrame(frame, true, false);
    img.setPosition(x, y).setVisible(true);
    if (this.draw.tinted) img.setTint(full ? Palette.chargeSparkFull : Palette.chargeSpark);
  }
}
