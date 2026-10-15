import type Phaser from 'phaser';
import type { JuiceTuning } from '@iot/shared';
import { Palette } from '../palette.js';
import { DEPTH } from './depth.js';
import { worldPx } from './scale.js';
import { blinkOut, label, place, shadowed, worldWord, type WorldText } from './text.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
  drag: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: number;
  width: number;
}

/** Floaters blink out over their last 200 ms. */
const FLOATER_BLINK_MS = 200;

/** Floaters rise this fast, UI px per second. */
const FLOATER_RISE = 18;

/**
 * `juice.shakePerStrength` is a fraction of the view's width, tuned on M1's
 * 480 px view (Phaser's camera shake): the shake keeps M1's offsets, in sim px.
 */
const SHAKE_REF_PX = 480;

interface Floater {
  text: WorldText;
  life: number;
  max: number;
  /** Where it stands in the world, sim px; it rises from there in UI px. */
  x: number;
  y: number;
  rise: number;
}

/** Projects a point of the world (sim px) to the UI grid (UI px), through the world camera. */
export type ToUi = (x: number, y: number) => { x: number; y: number };

/**
 * Presentation-only effects. Uses Math.random freely: nothing here feeds back
 * into the sim. World time (dtWorld) slows down with the perfect-dodge slow-mo.
 * Callers speak sim px (positions, radii, `juice.particleSpeed`); particles
 * and rings are the engine's own drawings, so they are kept and drawn in
 * world px at 1 world px per pixel (the sim's numbers ×2, a particle 1 or 2
 * px, a ring's stroke its pixel width). Floaters are text: they live on the
 * UI grid, placed at their world position's projection (`toUi`) every frame.
 */
export class Fx {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private flashes = new Map<string, number>();
  private shakeLeft = 0;
  private shakeIntensity = 0;
  /** This frame's shake offset of the world camera, whole world px. */
  readonly shakeOffset = { x: 0, y: 0 };
  readonly gfx: Phaser.GameObjects.Graphics;
  now = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly uiLayer: Phaser.GameObjects.Layer,
    private readonly juice: () => JuiceTuning,
    private readonly toUi: ToUi,
  ) {
    this.gfx = scene.add.graphics().setDepth(DEPTH.fx);
    layer.add(this.gfx);
  }

  /** Hit flash: the struck target turns signal-hit white for `frames` 60 Hz frames (1-2). */
  flash(key: string, frames: number): void {
    this.flashes.set(key, this.now + (frames * 1000) / 60);
  }

  isFlashing(key: string): boolean {
    return (this.flashes.get(key) ?? 0) > this.now;
  }

  /** Shake the world camera: as M1's (a new shake replaces the old one), in whole world px. */
  shake(strength: number): void {
    const j = this.juice();
    if (strength <= 0) return;
    this.shakeLeft = j.shakeDurationMs + strength * 12;
    this.shakeIntensity = Math.min(0.03, strength * j.shakePerStrength);
  }

  private updateShake(dtRealMs: number): void {
    this.shakeLeft -= dtRealMs;
    if (this.shakeLeft <= 0) {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      return;
    }
    const reach = worldPx(this.shakeIntensity * SHAKE_REF_PX);
    this.shakeOffset.x = Math.round((Math.random() * 2 - 1) * reach);
    this.shakeOffset.y = Math.round((Math.random() * 2 - 1) * reach);
  }

  /** A burst of particles at (x, y) sim px, `speed` sim px/s. */
  burst(
    x: number,
    y: number,
    count: number,
    color: number,
    speed: number,
    opts: { dir?: number; spread?: number; size?: number; life?: number } = {},
  ): void {
    const j = this.juice();
    const spread = opts.spread ?? Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = (opts.dir ?? 0) + (Math.random() - 0.5) * spread;
      const v = worldPx(speed) * (0.4 + Math.random() * 0.8);
      const life = (opts.life ?? j.particleLifeMs) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x: worldPx(x),
        y: worldPx(y),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        max: life,
        color,
        size: opts.size ?? (Math.random() < 0.3 ? 2 : 1),
        drag: 3.5,
      });
    }
  }

  /** A ring at (x, y) sim px growing from radius r0 to r1 (sim px); `width` is its stroke in world px. */
  ring(x: number, y: number, r0: number, r1: number, ms: number, color: number, width = 2): void {
    this.rings.push({ x: worldPx(x), y: worldPx(y), r0: worldPx(r0), r1: worldPx(r1), life: ms, max: ms, color, width });
  }

  /** A floater at (x, y) sim px: a word in the world ink, or, with `color`, a coloured number/pickup with its drop shadow (readability.md §4). */
  float(x: number, y: number, text: string, ms = 700, color?: number): void {
    const t =
      color === undefined
        ? worldWord(this.scene, 0, 0, text)
        : shadowed(label(this.scene, 0, 0, text, color));
    t.setDepth(DEPTH.floaters);
    this.uiLayer.add(t);
    const f: Floater = { text: t, x, y, rise: 0, life: ms, max: ms };
    this.placeFloater(f);
    this.floaters.push(f);
  }

  private placeFloater(f: Floater): void {
    const at = this.toUi(f.x, f.y);
    place(f.text, at.x, at.y - Math.round(f.rise), 0.5, 1);
  }

  update(dtWorldMs: number, dtRealMs: number): void {
    this.now += dtRealMs;
    this.updateShake(dtRealMs);
    const dt = dtWorldMs / 1000;
    const g = this.gfx;
    g.clear();
    this.particles = this.particles.filter((p) => {
      p.life -= dtWorldMs;
      if (p.life <= 0) return false;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k;
      p.vy *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      g.fillStyle(p.color, Math.min(1, (p.life / p.max) * 1.6));
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      return true;
    });
    this.rings = this.rings.filter((r) => {
      r.life -= dtWorldMs;
      if (r.life <= 0) return false;
      const f = 1 - r.life / r.max;
      const ease = 1 - (1 - f) * (1 - f);
      g.lineStyle(r.width, r.color, 1 - f);
      g.strokeCircle(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease);
      return true;
    });
    this.floaters = this.floaters.filter((f) => {
      f.life -= dtRealMs;
      if (f.life <= 0) {
        f.text.destroy();
        return false;
      }
      f.rise += FLOATER_RISE * (dtRealMs / 1000);
      this.placeFloater(f);
      // Solid, then a 2-blink pop over the last 200 ms (no alpha fade: readability.md §4).
      blinkOut(f.text, f.life, FLOATER_BLINK_MS);
      return true;
    });
  }

  /** Chipped-pixel flakes off a Husk shell. */
  chips(x: number, y: number, dir: number, count: number): void {
    const j = this.juice();
    this.burst(x, y, count, Palette.shell, j.particleSpeed, { dir, spread: Math.PI * 0.9 });
    this.burst(x, y, Math.ceil(count / 2), Palette.huskOutline, j.particleSpeed * 0.8, {
      dir,
      spread: Math.PI * 0.9,
    });
  }

  /** Core flare when a Husk dies. */
  coreFlare(x: number, y: number): void {
    const j = this.juice();
    this.ring(x, y, 2, 22, 380, Palette.core, 3);
    this.ring(x, y, 1, 12, 220, Palette.spark, 2);
    this.burst(x, y, j.coreFlareParticles, Palette.core, j.particleSpeed * 1.4, { size: 2 });
    this.burst(x, y, Math.round(j.coreFlareParticles / 2), Palette.huskOutline, j.particleSpeed);
  }
}
