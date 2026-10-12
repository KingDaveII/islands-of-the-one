import type Phaser from 'phaser';
import { hookbladeFxSheet as sheet } from '@iot/shared';
import { Palette } from '../palette.js';
import { HOOKBLADE_TEXTURE } from './sheets.js';

/**
 * The Hookblade's sprites from hookblade-fx (packages/shared/assets): the
 * Haul chain (one link per `chain.spacing` px, every link taut during the
 * pull), the hook head (in flight / set, rotated to the throw angle around
 * its shank end) and the charge spark at the hook tip. A pool of images the
 * world renderer re-poses every frame; links sit under the bodies, the hook
 * and spark over them. Tints are palette tokens; links and hook get a 1 px
 * player-outline rim from four offset copies.
 */
type Image = Phaser.GameObjects.Image;

const MAX_LINKS = 16;
const RIM: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const SPARK_FRAMES = sheet.anims.charge_spark.frames;

interface Slot {
  ink: Image;
  rim: Image[];
}

export class HookbladeFx {
  private readonly links: Slot[] = [];
  private readonly hookSlot: Slot;
  private readonly sparkImage: Image;
  private linksUsed = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < MAX_LINKS; i++) this.links.push(this.slot(sheet.chain.link, 0.5, 0.5));
    this.hookSlot = this.slot(sheet.hook.flight, 0, 0);
    this.sparkImage = this.image(SPARK_FRAMES[0] ?? sheet.hook.flight, 0.5, 0.5);
  }

  /** Adds the pool to a layer: links below `between` (the body graphics), hook and spark above it. */
  mount(layer: Phaser.GameObjects.Layer, between: Phaser.GameObjects.GameObject): void {
    for (const l of this.links) layer.add([...l.rim, l.ink]);
    layer.add(between);
    layer.add([...this.hookSlot.rim, this.hookSlot.ink, this.sparkImage]);
  }

  private image(frame: string, ox: number, oy: number): Image {
    return this.scene.add.image(0, 0, HOOKBLADE_TEXTURE, frame).setOrigin(ox, oy).setVisible(false);
  }

  private slot(frame: string, ox: number, oy: number): Slot {
    return {
      ink: this.image(frame, ox, oy),
      rim: RIM.map(() => this.image(frame, ox, oy).setTint(Palette.chainOutline)),
    };
  }

  private pose(s: Slot, frame: string, x: number, y: number, angle: number, tint: number): void {
    const all = [s.ink, ...s.rim];
    for (const img of all) {
      if (img.frame.name !== frame) img.setFrame(frame, true, false);
      img.setRotation(angle).setVisible(true);
    }
    s.ink.setPosition(x, y).setTint(tint);
    s.rim.forEach((img, i) => {
      const [dx, dy] = RIM[i] ?? [0, 0];
      img.setPosition(x + dx, y + dy);
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

  /** The chain from the hand (hx, hy) to the hook (ex, ey): a link every `spacing` px, taut links during the pull. */
  chain(hx: number, hy: number, ex: number, ey: number, taut: boolean): void {
    const len = Math.hypot(ex - hx, ey - hy);
    if (len < 1) return;
    const ux = (ex - hx) / len;
    const uy = (ey - hy) / len;
    const angle = Math.atan2(uy, ux);
    const frame = taut ? sheet.chain.taut : sheet.chain.link;
    const step = sheet.chain.spacing;
    for (let d = step / 2; d < len - 2 && this.linksUsed < this.links.length; d += step) {
      const slot = this.links[this.linksUsed++];
      if (!slot) break;
      this.pose(slot, frame, Math.round(hx + ux * d), Math.round(hy + uy * d), angle, taut ? Palette.chainTaut : Palette.chain);
    }
  }

  /** The hook head with its shank end at (x, y), pointing along `angle` (radians); `set` once it has landed. */
  hook(x: number, y: number, angle: number, set: boolean): void {
    const [ox = 0, oy = 0] = sheet.hook.origin;
    const frame = set ? sheet.hook.set : sheet.hook.flight;
    this.pose(this.hookSlot, frame, Math.round(x), Math.round(y), angle, Palette.chain);
    // The origin is a pixel of the cell: rotate around that pixel's center.
    for (const img of [this.hookSlot.ink, ...this.hookSlot.rim]) img.setDisplayOrigin(ox + 0.5, oy + 0.5);
  }

  /**
   * The charge spark at the hook tip: `stage` 0-3 from the charge meter
   * (spark_0 while the charge builds, spark_2 held at full charge, in husk-core).
   */
  spark(x: number, y: number, stage: number): void {
    const index = Math.max(0, Math.min(SPARK_FRAMES.length - 1, stage - 1));
    const frame = SPARK_FRAMES[index] ?? SPARK_FRAMES[0] ?? '';
    const full = index === SPARK_FRAMES.length - 1;
    const img = this.sparkImage;
    if (img.frame.name !== frame) img.setFrame(frame, true, false);
    img.setPosition(Math.round(x), Math.round(y)).setTint(full ? Palette.chargeSparkFull : Palette.chargeSpark).setVisible(true);
  }
}
