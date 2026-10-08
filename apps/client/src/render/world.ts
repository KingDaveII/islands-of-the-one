import type Phaser from 'phaser';
import {
  facing8,
  huskParams,
  lightStrike,
  playerAttackPhase,
  slamCenter,
  SUB,
  tileAt,
  TILE_PX,
  TURN,
  type HuskState,
  type Run,
  type RunState,
} from '@iot/sim';
import { Palette } from '../palette.js';
import type { JuiceTuning } from '@iot/shared';
import type { Session } from '../game/session.js';
import type { Fx } from './fx.js';

const RAD = (Math.PI * 2) / TURN;
const FACING_RAD = Math.PI / 4;

/** Sim angle → radians. */
export const rad = (a: number): number => a * RAD;
/** Angle snapped to the nearest of 8 facings, in radians (sprites/shapes only). */
const facingRad = (a: number): number => facing8(a) * FACING_RAD;

/**
 * Draws the sim state with plain shapes. Purely a view: it reads state and
 * never changes it.
 */
export class WorldRenderer {
  private readonly room: Phaser.GameObjects.Graphics;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private roomKey = '';
  private ghosts: { x: number; y: number; dir: number; life: number }[] = [];

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly juice: () => JuiceTuning,
  ) {
    this.room = scene.add.graphics();
    this.gfx = scene.add.graphics();
    layer.add([this.room, this.gfx]);
  }

  /** Room size in pixels. */
  static roomSize(s: RunState): { w: number; h: number } {
    return { w: s.room.cols * TILE_PX, h: s.room.rows * TILE_PX };
  }

  private drawRoom(s: RunState, timeMs: number): void {
    const key = `${s.roomIndex}:${s.room.template}:${s.room.doorOpen}`;
    const doorPulse = s.room.doorOpen;
    if (key === this.roomKey && !doorPulse) return;
    this.roomKey = key;
    const g = this.room;
    g.clear();
    const { room } = s;
    for (let r = 0; r < room.rows; r++) {
      for (let c = 0; c < room.cols; c++) {
        const t = tileAt(room, c, r);
        const x = c * TILE_PX;
        const y = r * TILE_PX;
        if (t === '#' || t === 'o') {
          g.fillStyle(Palette.wall, 1).fillRect(x, y, TILE_PX, TILE_PX);
          // Lit lip where a wall meets floor below it.
          const below = tileAt(room, c, r + 1);
          if (below !== '#' && below !== 'o') {
            g.fillStyle(Palette.wallEdge, 1).fillRect(x, y + TILE_PX - 4, TILE_PX, 4);
            g.fillStyle(Palette.floorLine, 1).fillRect(x, y + TILE_PX - 1, TILE_PX, 1);
          }
          if (t === 'o') g.fillStyle(Palette.wallEdge, 1).fillRect(x + 2, y + 2, TILE_PX - 4, 2);
        } else if (t === 'D') {
          if (room.doorOpen) {
            const glow = 0.35 + 0.25 * Math.sin(timeMs / 180);
            g.fillStyle(Palette.floor, 1).fillRect(x, y, TILE_PX, TILE_PX);
            g.fillStyle(Palette.spark, glow).fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4);
            g.fillStyle(Palette.sparkDeep, 1).fillRect(x + 6, y + 6, 4, 4);
          } else {
            g.fillStyle(Palette.wall, 1).fillRect(x, y, TILE_PX, TILE_PX);
            g.fillStyle(Palette.locked, 1);
            for (let i = 2; i < TILE_PX; i += 5) g.fillRect(x + i, y + 1, 2, TILE_PX - 2);
          }
        } else {
          g.fillStyle(Palette.floor, 1).fillRect(x, y, TILE_PX, TILE_PX);
          if ((c + r) % 2 === 0) g.fillStyle(Palette.floorLine, 1).fillRect(x, y, TILE_PX, 1);
          if (t === 'S') g.fillStyle(Palette.floorLine, 1).fillCircle(x + 8, y + 8, 3);
        }
      }
    }
  }

  draw(session: Session, fx: Fx, timeMs: number, dtWorldMs: number, crosshair: { x: number; y: number } | null): void {
    const run = session.run;
    const s = run.state;
    this.drawRoom(s, timeMs);
    const g = this.gfx;
    g.clear();

    for (const k of s.pickups) this.drawPickup(g, session.lerp(`k${k.id}`, k.x, k.y), timeMs);
    for (const h of s.husks) this.drawHuskGround(g, run, h, session.lerp(`h${h.id}`, h.x, h.y));
    this.drawPlayer(g, session, fx, timeMs, dtWorldMs);
    for (const h of s.husks) this.drawHusk(g, run, h, session.lerp(`h${h.id}`, h.x, h.y), fx, timeMs);
    if (crosshair) this.drawCrosshair(g, crosshair.x, crosshair.y);
  }

  private drawPickup(g: Phaser.GameObjects.Graphics, p: { x: number; y: number }, timeMs: number): void {
    const tw = Math.sin(timeMs / 120 + p.x) > 0.6;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    g.fillStyle(Palette.sparkDeep, 1).fillTriangle(x, y - 4, x + 3, y, x - 3, y);
    g.fillTriangle(x, y + 4, x + 3, y, x - 3, y);
    g.fillStyle(tw ? Palette.white : Palette.spark, 1).fillRect(x - 1, y - 2, 2, 3);
  }

  /** Telegraphs drawn on the floor, under bodies. */
  private drawHuskGround(g: Phaser.GameObjects.Graphics, run: Run, h: HuskState, pos: { x: number; y: number }): void {
    const P = run.params;
    const hp = huskParams(P, h.kind);
    g.fillStyle(Palette.ink, 0.35).fillEllipse(pos.x, pos.y + hp.radius / SUB - 1, (hp.radius / SUB) * 2, 4);
    if (h.action !== 'windup') return;
    const f = Math.min(1, h.t / hp.windup);
    if (h.kind === 'peeling') {
      const len = (P.husks.peeling.lungeSpeed * P.husks.peeling.lunge) / SUB;
      const a = rad(h.attackDir);
      const ex = pos.x + Math.cos(a) * len;
      const ey = pos.y + Math.sin(a) * len;
      g.lineStyle(1, Palette.telegraph, 0.25 + 0.5 * f);
      g.lineBetween(pos.x, pos.y, ex, ey);
      g.fillStyle(Palette.telegraph, 0.3 + 0.5 * f).fillCircle(ex, ey, 2);
    } else {
      const c = slamCenter({ s: run.state, P, events: [] }, h);
      const r = P.husks.nutshell.slamRadius / SUB;
      const cx = (c.x - h.x) / SUB + pos.x;
      const cy = (c.y - h.y) / SUB + pos.y;
      g.fillStyle(Palette.danger, 0.08 + 0.22 * f).fillCircle(cx, cy, r * f);
      g.lineStyle(1, Palette.telegraph, 0.4 + 0.5 * f).strokeCircle(cx, cy, r);
    }
  }

  private drawHusk(
    g: Phaser.GameObjects.Graphics,
    run: Run,
    h: HuskState,
    pos: { x: number; y: number },
    fx: Fx,
    timeMs: number,
  ): void {
    const P = run.params;
    const hp = huskParams(P, h.kind);
    const r = hp.radius / SUB;
    let { x, y } = pos;
    if (h.action === 'flinch' || h.hitstop > 0) {
      x += (Math.random() - 0.5) * 1.5;
      y += (Math.random() - 0.5) * 1.5;
    }
    if (h.action === 'spawn') {
      const f = h.t / Math.max(1, hp.spawn);
      g.lineStyle(1, Palette.pearl, f).strokeCircle(x, y, r + (1 - f) * 10);
      g.fillStyle(Palette.core, f).fillCircle(x, y, 1 + f * 2);
      return;
    }
    const flashing = fx.isFlashing(`h${h.id}`);
    const blinkHz = this.juice().telegraphBlinkHz;
    const telegraphOn = h.action === 'windup' && Math.floor((timeMs / 1000) * blinkHz) % 2 === 0;
    const shellColor = flashing || telegraphOn ? Palette.white : Palette.pearl;

    // Shell layers, outermost first; broken layers are gone.
    const layers = h.shell.length;
    h.shell.forEach((v, i) => {
      if (v <= 0) return;
      const lr = r - i * (r / (layers + 1));
      g.fillStyle(shellColor, telegraphOn ? 0.75 : 0.42 + i * 0.1).fillCircle(x, y, lr);
      g.lineStyle(1, shellColor, 0.9).strokeCircle(x, y, lr);
    });
    if (h.shell.every((v) => v <= 0)) g.lineStyle(1, Palette.pearl, 0.35).strokeCircle(x, y, r * 0.6);

    // The core: the bright weak point.
    const pulse = 1 + 0.2 * Math.sin(timeMs / 140 + h.id);
    const coreR = Math.max(1.5, r * 0.32) * pulse;
    g.fillStyle(flashing ? Palette.white : Palette.core, 1).fillCircle(x, y, coreR);

    // Facing notch (nearest of 8 facings).
    const fa = facingRad(h.action === 'chase' ? Math.round((Math.atan2(h.vy, h.vx) / RAD + TURN) % TURN) : h.attackDir);
    g.fillStyle(Palette.ink, 0.8).fillCircle(x + Math.cos(fa) * r * 0.7, y + Math.sin(fa) * r * 0.7, 1);

    if (h.action === 'stagger') {
      for (let i = 0; i < 2; i++) {
        const a = timeMs / 120 + i * Math.PI;
        g.fillStyle(Palette.spark, 1).fillRect(Math.round(x + Math.cos(a) * (r + 2)), Math.round(y - r - 3 + Math.sin(a) * 1.5), 1, 1);
      }
    }
    if (h.action === 'attack' && h.kind === 'peeling') {
      const a = rad(h.attackDir);
      g.lineStyle(2, Palette.pearl, 0.5).lineBetween(x, y, x - Math.cos(a) * 8, y - Math.sin(a) * 8);
    }

    // Shell HP per layer (outer above inner), then core once exposed.
    const damaged = h.shell.some((v, i) => v < (hp.shell[i] ?? 0)) || h.core < hp.core;
    if (damaged || h.kind === 'nutshell') {
      const w = Math.max(10, r * 2);
      let by = y - r - 4;
      h.shell.forEach((v, i) => {
        const max = hp.shell[i] ?? 1;
        if (v <= 0 && i < h.shell.length - 1) return;
        g.fillStyle(Palette.ink, 0.7).fillRect(x - w / 2, by, w, 2);
        g.fillStyle(Palette.pearl, 1).fillRect(x - w / 2, by, (w * Math.max(0, v)) / max, 2);
        by -= 3;
      });
      if (h.shell.every((v) => v <= 0)) {
        g.fillStyle(Palette.ink, 0.7).fillRect(x - w / 2, by, w, 2);
        g.fillStyle(Palette.core, 1).fillRect(x - w / 2, by, (w * Math.max(0, h.core)) / hp.core, 2);
      }
    }
  }

  private drawPlayer(g: Phaser.GameObjects.Graphics, session: Session, fx: Fx, timeMs: number, dtWorldMs: number): void {
    const run = session.run;
    const P = run.params;
    const p = run.state.player;
    const { x, y } = session.lerp('p', p.x, p.y);
    const r = P.player.radius / SUB;
    const face = facingRad(p.action === 'idle' || p.action === 'charge' ? p.aim : p.dir);

    // Dodge afterimages.
    for (const gh of this.ghosts) gh.life -= dtWorldMs;
    this.ghosts = this.ghosts.filter((gh) => gh.life > 0);
    if (p.action === 'dodge' && p.t % 2 === 0) this.ghosts.push({ x, y, dir: rad(p.dir), life: 160 });
    for (const gh of this.ghosts) {
      g.fillStyle(Palette.sailShade, (gh.life / 160) * 0.45).fillEllipse(gh.x, gh.y, r * 2.6, r * 1.6);
    }

    g.fillStyle(Palette.ink, 0.35).fillEllipse(x, y + r - 1, r * 2, 4);

    if (p.action === 'dead') {
      g.fillStyle(Palette.sailDark, 1).fillEllipse(x, y + 2, r * 2.6, r * 1.2);
      return;
    }

    // Heavy charge ring.
    if (p.action === 'charge') {
      const f = p.charge / P.weapon.heavy.fullCharge;
      const full = f >= 1;
      const ringR = r + 3 + 6 * (1 - f);
      g.lineStyle(1, full ? Palette.spark : Palette.sail, full ? 0.9 + 0.1 * Math.sin(timeMs / 40) : 0.4 + f * 0.5);
      g.beginPath();
      g.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      g.strokePath();
      if (full && Math.random() < 0.3) fx.burst(x, y, 1, Palette.spark, 30, { life: 250 });
    }

    // Attack arcs (precise direction).
    const phase = playerAttackPhase(p, P);
    if (p.action === 'light' || p.action === 'heavy') {
      const heavy = p.action === 'heavy';
      const st = heavy ? P.weapon.heavy : lightStrike(P, p.comboStep);
      const reach = st.reach / SUB;
      const half = rad(st.halfArc);
      const dir = rad(p.dir);
      const activeEnd = st.startup + st.active;
      if (phase === 'startup') {
        // Anticipation: blade drawn back.
        const back = dir + (p.comboStep % 2 === 0 ? -1 : 1) * half;
        g.lineStyle(1, Palette.blade, 0.8).lineBetween(x, y, x + Math.cos(back) * (r + 5), y + Math.sin(back) * (r + 5));
      } else if (phase === 'active' || (phase === 'recovery' && p.t <= activeEnd + 4)) {
        // Slash crescent: solid while active, then a quick fade.
        const fade = phase === 'active' ? 1 : 1 - (p.t - activeEnd) / 5;
        const thick = heavy ? 7 : p.comboStep === P.weapon.light.length - 1 ? 6 : 4;
        const sweep = phase === 'active' ? Math.min(1, (p.t - st.startup) / Math.max(1, st.active)) : 1;
        const from = p.comboStep % 2 === 0 && !heavy ? dir - half : dir + half;
        const to = from + (p.comboStep % 2 === 0 && !heavy ? 1 : -1) * 2 * half * sweep;
        const a0 = Math.min(from, to);
        const a1 = Math.max(from, to);
        g.fillStyle(Palette.blade, 0.18 * fade).slice(x, y, reach, a0, a1).fillPath();
        g.lineStyle(thick, Palette.blade, 0.85 * fade);
        g.beginPath();
        g.arc(x, y, reach - thick / 2, a0, a1);
        g.strokePath();
        g.lineStyle(1, Palette.white, fade);
        g.beginPath();
        g.arc(x, y, reach, a0, a1);
        g.strokePath();
      }
    }
    if (p.action === 'lunge' && p.t <= P.lunge.dash) {
      const a = rad(p.dir);
      g.lineStyle(3, Palette.blade, 0.7).lineBetween(x - Math.cos(a) * 14, y - Math.sin(a) * 14, x, y);
      g.lineStyle(1, Palette.white, 1).strokeCircle(x, y, P.lunge.radius / SUB);
    }

    // Body: squash/stretch while dodging; blink while invulnerable after a hit.
    if (p.hurtInvuln > 0 && Math.floor(timeMs / 60) % 2 === 0) return;
    const hurt = fx.isFlashing('p');
    const body = hurt ? Palette.white : Palette.sail;
    if (p.action === 'dodge') {
      const a = rad(p.dir);
      g.fillStyle(body, 1);
      g.fillEllipse(x, y, r * 2.6, r * 1.5);
      g.lineStyle(1, Palette.sailDark, 1).strokeEllipse(x, y, r * 2.6, r * 1.5);
      g.fillStyle(Palette.sailShade, 1).fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 2);
      if (p.iframes > 0) g.lineStyle(1, Palette.white, 0.6).strokeCircle(x, y, r + 2);
      return;
    }
    g.fillStyle(body, 1).fillCircle(x, y, r);
    g.lineStyle(1, Palette.sailDark, 1).strokeCircle(x, y, r);
    // Hood/prow toward the 8-way facing.
    const hx = x + Math.cos(face) * (r - 1);
    const hy = y + Math.sin(face) * (r - 1);
    g.fillStyle(Palette.sailShade, 1).fillCircle(hx, hy, 2.5);
    // Hookblade at rest, held on the facing side.
    if (p.action === 'idle' || p.action === 'charge' || p.action === 'hurt') {
      const bx = x + Math.cos(face + 1.2) * (r + 1);
      const by = y + Math.sin(face + 1.2) * (r + 1);
      g.lineStyle(1, Palette.blade, 1).lineBetween(bx, by, bx + Math.cos(face) * 6, by + Math.sin(face) * 6);
      g.fillStyle(Palette.blade, 1).fillRect(Math.round(bx + Math.cos(face) * 6), Math.round(by + Math.sin(face) * 6), 2, 1);
    }
  }

  private drawCrosshair(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const cx = Math.round(x);
    const cy = Math.round(y);
    g.fillStyle(Palette.white, 0.9);
    g.fillRect(cx - 4, cy, 3, 1).fillRect(cx + 2, cy, 3, 1).fillRect(cx, cy - 4, 1, 3).fillRect(cx, cy + 2, 1, 3);
  }
}
