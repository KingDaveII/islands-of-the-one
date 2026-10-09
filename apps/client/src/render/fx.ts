import type Phaser from 'phaser';
import type { JuiceTuning } from '@iot/shared';
import { Palette } from '../palette.js';
import { label, place, withShadow } from './text.js';

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

interface Floater {
  text: Phaser.GameObjects.Text;
  life: number;
  max: number;
  y: number;
  vy: number;
}

/**
 * Presentation-only effects. Uses Math.random freely: nothing here feeds back
 * into the sim. World time (dtWorld) slows down with the perfect-dodge slow-mo.
 */
export class Fx {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private flashes = new Map<string, number>();
  readonly gfx: Phaser.GameObjects.Graphics;
  now = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly juice: () => JuiceTuning,
  ) {
    this.gfx = scene.add.graphics();
    layer.add(this.gfx);
  }

  /** Hit flash: the struck target turns signal-hit white for `frames` 60 Hz frames (1-2). */
  flash(key: string, frames: number): void {
    this.flashes.set(key, this.now + (frames * 1000) / 60);
  }

  isFlashing(key: string): boolean {
    return (this.flashes.get(key) ?? 0) > this.now;
  }

  shake(strength: number): void {
    const j = this.juice();
    if (strength <= 0) return;
    this.scene.cameras.main.shake(j.shakeDurationMs + strength * 12, Math.min(0.03, strength * j.shakePerStrength), true);
  }

  burst(x: number, y: number, count: number, color: number, speed: number, opts: { dir?: number; spread?: number; size?: number; life?: number } = {}): void {
    const j = this.juice();
    const spread = opts.spread ?? Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = (opts.dir ?? 0) + (Math.random() - 0.5) * spread;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = (opts.life ?? j.particleLifeMs) * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
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

  ring(x: number, y: number, r0: number, r1: number, ms: number, color: number, width = 2): void {
    this.rings.push({ x, y, r0, r1, life: ms, max: ms, color, width });
  }

  float(x: number, y: number, text: string, color: number, ms = 700): void {
    const t = withShadow(label(this.scene, 0, 0, text, color));
    place(t, x, y, 0.5, 1);
    this.layer.add(t);
    this.floaters.push({ text: t, y: t.y, life: ms, max: ms, vy: -18 });
  }

  update(dtWorldMs: number, dtRealMs: number): void {
    this.now += dtRealMs;
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
      f.y += f.vy * (dtRealMs / 1000);
      f.text.y = Math.round(f.y);
      f.text.setAlpha(Math.min(1, (f.life / f.max) * 2));
      return true;
    });
  }

  /** Chipped-pixel flakes off a Husk shell. */
  chips(x: number, y: number, dir: number, count: number): void {
    const j = this.juice();
    this.burst(x, y, count, Palette.shell, j.particleSpeed, { dir, spread: Math.PI * 0.9 });
    this.burst(x, y, Math.ceil(count / 2), Palette.huskOutline, j.particleSpeed * 0.8, { dir, spread: Math.PI * 0.9 });
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
