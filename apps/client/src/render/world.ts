import type Phaser from 'phaser';
import {
  heavyTiming,
  hookSnags,
  huskParams,
  lightStrike,
  playerAttackPhase,
  slamCenter,
  SUB,
  TILE_PX,
  TURN,
  type HuskState,
  type Run,
  type RunState,
} from '@iot/sim';
import type { AnimTuning, JuiceTuning } from '@iot/shared';
import { Palette } from '../palette.js';
import type { Reticle } from '../game/controls.js';
import type { Session } from '../game/session.js';
import { debugFlags } from '../ui/debugFlags.js';
import { chargeStage } from './charge.js';
import { CharacterSprites } from './characters.js';
import { ChestSprites } from './chestSprites.js';
import { DEPTH } from './depth.js';
import { PLAYER_FEET } from './feet.js';
import { facingIndex, facingStep } from './facing.js';
import { hookbladePoint, type PlayerFrame } from './hookbladePoints.js';
import type { Fx } from './fx.js';
import { HookbladeFx } from './hookblade.js';
import { disc, ditherDisc, outlinedRect, pixelLine, ring, shadowEllipse } from './pixels.js';
import { TileRoom } from './roomTiles.js';
import { simGraphics, snapToArt, worldPx } from './scale.js';
import { lightSlashMark } from './slash.js';

const RAD = (Math.PI * 2) / TURN;

/** Sim angle → radians. */
export const rad = (a: number): number => a * RAD;

type G = Phaser.GameObjects.Graphics;

/** Cheap deterministic noise for the debug shapes' cracks (presentation only). */
function noise(a: number, b: number, k: number): number {
  let h = (a * 374761393 + b * 668265263 + k * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Colors a Husk is drawn in: normal, telegraphing, or hit-flashed. */
interface HuskInk {
  outline: number;
  fill: number;
  shade: number;
  inner: number;
  coreRing: number;
}

const NORMAL: HuskInk = {
  outline: Palette.huskOutline,
  fill: Palette.shell,
  shade: Palette.shellShade,
  inner: Palette.floorEdge,
  coreRing: Palette.coreRing,
};
const TELEGRAPH: HuskInk = {
  outline: Palette.telegraphDark,
  fill: Palette.telegraph,
  shade: Palette.telegraphDark,
  inner: Palette.telegraphDark,
  coreRing: Palette.telegraphDark,
};
const HIT: HuskInk = {
  outline: Palette.hit,
  fill: Palette.hit,
  shade: Palette.shellShade,
  inner: Palette.shellShade,
  coreRing: Palette.hit,
};

/** The Haul guide starts this far from the player (sim px, clear of the sprite) and tests the wall every GUIDE_STEP sim px. */
const GUIDE_START = 10;
const GUIDE_STEP = 2;

/** The Kindled's grounding shadow, world px (G1.5); a Husk's scales with its radius against the player's. */
const SHADOW_W = 20;
const SHADOW_H = 6;

type Point = { x: number; y: number };

/** Alpha of the debug hitbox shapes drawn over the sprites (F3). */
const DEBUG_ALPHA = 0.6;

/**
 * Draws the sim state in the design-system palette (docs/design/readability.md):
 * the room, floor decals and shadows, the character sprites (characters.ts,
 * posed by the animation state machine), the attack hitbox flashes, poise
 * bars and the reticle. Purely a view: it reads state, never changes it.
 * With the F3 debug flag the old placeholder shapes draw over the sprites.
 *
 * The room comes from ART's tile sheet (roomTiles.ts, G1.5e): the pieces
 * `tileAt` picks, in world px at 1×, and the doors animated from `doorOpen`.
 * The chests come from ART's `prop-chest` sheet (chestSprites.ts, G1.5f):
 * sprites at their sim positions, y-sorted with the bodies, their frame from
 * `opened`. Nothing else draws a room or a chest (G1.5g).
 *
 * One density (scale.ts): the sheets and the engine's own drawings (decals,
 * shadows, pickups, the slash arc and thrust line, poise bars, the charge
 * meter, the pad reticle and the Haul guide) are all at 1 world px per
 * pixel: positions and sim lengths ×2, pixel sizes as written. Only the F3
 * debug shapes, M1's hitbox figures, are drawn in sim px and scaled.
 */
export class WorldRenderer {
  /** Floor layer, world px: decals, shadows, pickups (under the chain and the bodies). */
  private readonly floor: G;
  /** Overlays, world px: hitbox flashes, poise bars, the charge meter, the pad reticle, the Haul guide. */
  private readonly gfx: G;
  /** The old hitbox shapes over the sprites, when debugFlags.shapes is on. */
  private readonly debug: G;
  private readonly hookblade: HookbladeFx;
  readonly characters: CharacterSprites;
  /** The room, drawn from the tile sheet. */
  readonly tiles: TileRoom;
  /** The chests, drawn from the prop-chest sheet. */
  readonly chests: ChestSprites;
  private roomKey = '';

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly juice: () => JuiceTuning,
    anim: () => AnimTuning,
  ) {
    this.floor = scene.add.graphics().setDepth(DEPTH.floor);
    this.gfx = scene.add.graphics().setDepth(DEPTH.overlay);
    this.debug = simGraphics(scene).setDepth(DEPTH.debug).setAlpha(DEBUG_ALPHA);
    layer.add([this.floor, this.gfx, this.debug]);
    // Chain links go under the bodies, the hook head and charge spark over them.
    this.hookblade = new HookbladeFx(scene);
    this.hookblade.mount(layer);
    this.characters = new CharacterSprites(scene, layer, anim);
    this.tiles = new TileRoom(scene, layer);
    this.chests = new ChestSprites(scene, layer);
  }

  /** Room size in sim px. */
  static roomSize(s: RunState): { w: number; h: number } {
    return { w: s.room.cols * TILE_PX, h: s.room.rows * TILE_PX };
  }

  /** Start the afterimage trail (call on a perfect dodge): afterimages along the path just taken, then more as it continues. */
  perfectDodge(): void {
    this.characters.perfectDodge();
  }

  /** Builds the room's tiles when the room changes (the floors' hash reads the template's name). */
  private buildRoom(run: Run): void {
    const s = run.state;
    const key = `${s.roomIndex}:${s.room.template}`;
    if (key === this.roomKey) return;
    this.roomKey = key;
    // The room's template by name over the sim's rows, padded with wall as tileAt reads them.
    const name = run.templates[s.room.template]?.name ?? String(s.room.template);
    this.tiles.build({ name, tiles: s.room.tiles });
  }

  draw(
    session: Session,
    fx: Fx,
    timeMs: number,
    dtWorldMs: number,
    dtRealMs: number,
    reticle: Reticle | null,
  ): void {
    const run = session.run;
    const s = run.state;
    this.buildRoom(run);
    const f = this.floor;
    const g = this.gfx;
    f.clear();
    g.clear();
    this.debug.clear();
    this.hookblade.begin();
    this.tiles.update(s.room.doorOpen, timeMs);

    // Interpolated body centres: raw sim px for the sprites (each snaps to a whole world px),
    // whole sim px for the debug shapes, whole world px for the engine's drawings.
    const huskRaw = new Map<number, Point>();
    const huskPos = new Map<number, Point>();
    const huskW = new Map<number, Point>();
    for (const h of s.husks) {
      const p = session.lerp(`h${h.id}`, h.x, h.y);
      huskRaw.set(h.id, p);
      huskPos.set(h.id, { x: Math.round(p.x), y: Math.round(p.y) });
      huskW.set(h.id, toWorld(p));
    }
    const pl = session.lerp('p', s.player.x, s.player.y);
    const player = { x: Math.round(pl.x), y: Math.round(pl.y) };
    const pw = toWorld(pl);
    const huskAt = (h: HuskState): Point => huskW.get(h.id) ?? toWorld({ x: h.x / SUB, y: h.y / SUB });

    // Floor layer: telegraph decals, grounding shadows, chests, pickups, the chain.
    for (const h of s.husks) this.drawTelegraphDecal(f, run, h, huskAt(h));
    const playerR = run.params.player.radius / SUB;
    for (const h of s.husks) {
      if (h.action === 'spawn') continue;
      const raw = huskRaw.get(h.id) ?? { x: h.x / SUB, y: h.y / SUB };
      const r = huskParams(run.params, h.kind).radius / SUB;
      const k = r / Math.max(1, playerR);
      this.shadowAt(f, snapToArt(raw.x), snapToArt(raw.y + r), SHADOW_W * k, SHADOW_H * k);
    }
    this.shadowAt(f, snapToArt(pl.x), snapToArt(pl.y + PLAYER_FEET), SHADOW_W, SHADOW_H);
    // The chests: a grounding shadow at each one's soles, the sprite y-sorted with the bodies.
    for (const c of s.chests) this.shadowAt(f, snapToArt(c.x / SUB), snapToArt(c.y / SUB), SHADOW_W, SHADOW_H);
    this.chests.draw(s.chests, timeMs);
    for (const k of s.pickups) this.drawPickup(f, toWorld(session.lerp(`k${k.id}`, k.x, k.y)), timeMs);

    // Bodies: the sprites, posed from the sim state; Husk spawn-in and stagger marks are engine effects.
    const blink = Math.floor((timeMs / 1000) * this.juice().telegraphBlinkHz) % 2 === 0;
    for (const h of s.husks) this.drawHuskEffects(g, run, h, huskAt(h), timeMs);
    this.characters.draw(session, fx, pl, huskRaw, blink, dtWorldMs, dtRealMs);
    // The chain (floor layer) and the spark leave from points in the player's frame, so they come after it is posed.
    const frame = this.playerFrame();
    this.drawChain(f, session, frame, huskW);
    this.drawPlayerEffects(g, run, frame, pw, huskW);

    // Overlays: poise bars, the charge meter, and on the pad the Haul guide and the reticle
    // (the mouse reticle is the cursor: the UI camera draws it, GameScene).
    for (const h of s.husks) this.drawPoise(g, run, h, huskAt(h), timeMs);
    this.drawChargeMeter(g, run, pw);
    if (reticle?.kind === 'pad') {
      this.drawHaulGuide(g, run, pw, reticle.aim);
      const at = this.padReticleAt(reticle, s, pw, huskW);
      drawReticle(g, at.x, at.y);
    }

    if (debugFlags.shapes) {
      for (const h of s.husks)
        this.drawHuskShape(this.debug, run, h, huskPos.get(h.id) ?? h, fx, timeMs);
      this.drawKindledShape(this.debug, session, player, fx);
    }
  }

  /** A grounding shadow `w` × `h` world px, centred on x, its middle row on the line under the soles (footY). */
  private shadowAt(g: G, x: number, footY: number, w: number, h: number): void {
    const sw = Math.max(2, Math.round(w));
    const sh = Math.max(2, Math.round(h));
    shadowEllipse(g, x - Math.floor(sw / 2), footY - Math.floor(sh / 2), sw, sh);
  }

  /** Husk effects that are not in the sheet (world px): the spawn-in ring and the stagger marks. */
  private drawHuskEffects(g: G, run: Run, h: HuskState, pos: Point, timeMs: number): void {
    const hp = huskParams(run.params, h.kind);
    const r = Math.round(worldPx(hp.radius / SUB));
    const { x, y } = pos;
    if (h.action === 'spawn') {
      const f = h.t / Math.max(1, hp.spawn);
      ring(g, x, y, Math.max(1, Math.round(r + (1 - f) * worldPx(8))), Palette.floorEdge);
      if (f > 0.5) disc(g, x, y, 1, Palette.core);
      return;
    }
    if (h.action === 'stagger') {
      for (let i = 0; i < 2; i++) {
        const a = timeMs / 120 + i * Math.PI;
        g.fillStyle(Palette.spark, 1).fillRect(
          Math.round(x + Math.cos(a) * (r + 2)),
          Math.round(y - r - 3 + Math.sin(a) * 1.5),
          1,
          1,
        );
      }
    }
  }

  /** The player as drawn this frame, for the Hookblade's points. */
  private playerFrame(): PlayerFrame {
    return {
      sheet: this.characters.playerSheet,
      frame: this.characters.playerFrame,
      anchor: this.characters.playerAnchor,
    };
  }

  /**
   * Player effects that are not in the sheet: the hitbox flashes (slash arc,
   * thrust line; world px at `pw`) and the charge spark (hookblade-fx) at the
   * frame's `tip`, in world px.
   */
  private drawPlayerEffects(g: G, run: Run, frame: PlayerFrame, pw: Point, huskW: Map<number, Point>): void {
    const p = run.state.player;
    if (p.action === 'dead') return;
    if (p.action === 'heavy') this.drawThrust(g, run, pw.x, pw.y, huskW);
    else this.drawSlash(g, run, pw.x, pw.y);
    if (p.action === 'charge') {
      // The charge spark at the hook tip: spark_0 as the charge starts, spark_2 held at full charge.
      const stage = chargeStage(p.charge, run.params.weapon.heavy);
      const tip = hookbladePoint(frame, 'tip');
      this.hookblade.spark(tip.x, tip.y, stage);
    }
  }

  /**
   * The Haul chain from hookblade-fx, world px: a link every `chain.spacing`
   * from the frame's `hand` to the hook head, the hook rotated to the throw
   * angle around its shank end, at the sim's hook position (or the hooked
   * Husk's). Once the hook lands every link goes taut over a straight
   * spark-amber line while the husk, or the player, slides along it.
   */
  private drawChain(g: G, session: Session, frame: PlayerFrame, huskW: Map<number, Point>): void {
    const p = session.state.player;
    const hk = p.hook;
    if (!hk) return;
    const hit = hk.hitId >= 0 ? huskW.get(hk.hitId) : undefined;
    const end = hit ?? toWorld({ x: hk.x / SUB, y: hk.y / SUB });
    const hand = hookbladePoint(frame, 'hand');
    const set = hk.hitId >= 0;
    if (set) {
      pixelLine(g, hand.x, hand.y, end.x, end.y, Palette.chainOutline, 1, 3);
      pixelLine(g, hand.x, hand.y, end.x, end.y, Palette.chainTaut);
    }
    this.hookblade.chain(hand.x, hand.y, end.x, end.y, set);
    this.hookblade.hook(end.x, end.y, rad(hk.dir), set);
  }

  /**
   * The Hook-thrust: a straight line hitbox flash along the aim (where the
   * light attack is an arc), drawn back during startup. A held husk shows
   * pinned on the line. World px: the sim's lengths ×2, the strokes in pixels.
   */
  private drawThrust(g: G, run: Run, x: number, y: number, huskW: Map<number, Point>): void {
    const P = run.params;
    const p = run.state.player;
    const h = P.weapon.heavy;
    const tm = heavyTiming(P, p.charge);
    const phase = playerAttackPhase(p, P);
    const length = worldPx(h.length / SUB);
    const width = worldPx((h.halfWidth * 2) / SUB);
    const a = rad(p.dir);
    const cy = y - worldPx(3);
    const activeEnd = tm.startup + tm.active;
    if (phase === 'startup') {
      const back = worldPx(6 + Math.round((p.t / Math.max(1, tm.startup)) * 4));
      const front = worldPx(4);
      pixelLine(
        g,
        x - Math.cos(a) * back,
        cy - Math.sin(a) * back,
        x + Math.cos(a) * front,
        cy + Math.sin(a) * front,
        Palette.playerOutline,
        1,
        3,
      );
      pixelLine(
        g,
        x - Math.cos(a) * back,
        cy - Math.sin(a) * back,
        x + Math.cos(a) * front,
        cy + Math.sin(a) * front,
        Palette.blade,
      );
      return;
    }
    const flashing = phase === 'active' || (phase === 'recovery' && p.t <= activeEnd + 3);
    const held = run.state.husks.filter((k) => k.action === 'held');
    if (!flashing && held.length === 0) return;
    if (flashing) {
      const reach =
        phase === 'active'
          ? length * Math.min(1, (p.t - tm.startup + 1) / Math.max(1, tm.active) + 0.5)
          : length;
      const fading = phase === 'recovery';
      // The hitbox: a dithered band as wide as the thrust, with a solid line down the middle.
      thrustBand(g, x, cy, a, reach, width / 2, fading ? Palette.floorEdge : Palette.playerOutline);
      const ex = x + Math.cos(a) * reach;
      const ey = cy + Math.sin(a) * reach;
      pixelLine(g, x, cy, ex, ey, Palette.playerOutline, 1, fading ? 3 : 4);
      pixelLine(g, x, cy, ex, ey, fading ? Palette.floorFleck : Palette.blade, 1, 2);
      // The hook tip.
      g.fillStyle(Palette.playerOutline, 1).fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 5, 5);
      g.fillStyle(Palette.blade, 1).fillRect(Math.round(ex) - 1, Math.round(ey) - 1, 3, 3);
    }
    // Pinned: the line runs out to each held husk for the hold.
    for (const k of held) {
      const pos = huskW.get(k.id) ?? toWorld({ x: k.x / SUB, y: k.y / SUB });
      pixelLine(g, x, cy, pos.x, pos.y, Palette.playerOutline, 1, 4);
      pixelLine(g, x, cy, pos.x, pos.y, Palette.blade, 1, 2);
    }
  }

  /** A Sparkglass piece on the floor at a world-px point. */
  private drawPickup(g: G, p: Point, timeMs: number): void {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const tw = Math.sin(timeMs / 120 + p.x / 2) > 0.6;
    // Outlined Sparkglass piece.
    g.fillStyle(Palette.uiPanel, 1)
      .fillRect(x - 1, y - 4, 3, 9)
      .fillRect(x - 2, y - 3, 5, 7)
      .fillRect(x - 3, y - 1, 7, 3);
    g.fillStyle(Palette.spark, 1)
      .fillRect(x, y - 3, 1, 7)
      .fillRect(x - 1, y - 2, 3, 5)
      .fillRect(x - 2, y, 5, 1);
    g.fillStyle(Palette.sparkDeep, 1)
      .fillRect(x, y + 1, 1, 2)
      .fillRect(x + 1, y, 1, 1);
    if (tw) g.fillStyle(Palette.floorFleck, 1).fillRect(x, y - 2, 1, 1);
  }

  /** Telegraph ground decals (world px): Peeling lunge path, Nutshell slam area. */
  private drawTelegraphDecal(g: G, run: Run, h: HuskState, pos: Point): void {
    if (h.action !== 'windup') return;
    const P = run.params;
    const hp = huskParams(P, h.kind);
    const f = Math.min(1, h.t / hp.startup);
    if (h.kind === 'peeling') {
      const len = worldPx((P.husks.peeling.lungeSpeed * P.husks.peeling.active) / SUB);
      const a = rad(h.attackDir);
      const shown = len * (0.35 + 0.65 * f);
      pixelLine(
        g,
        pos.x,
        pos.y,
        pos.x + Math.cos(a) * shown,
        pos.y + Math.sin(a) * shown,
        Palette.telegraph,
        2,
      );
      const ex = Math.round(pos.x + Math.cos(a) * len);
      const ey = Math.round(pos.y + Math.sin(a) * len);
      g.fillStyle(Palette.telegraphDark, 1).fillRect(ex - 1, ey - 1, 3, 3);
      if (f >= 1) g.fillStyle(Palette.telegraph, 1).fillRect(ex, ey, 1, 1);
    } else {
      const c = slamCenter({ s: run.state, P, events: [] }, h);
      const r = Math.round(worldPx(P.husks.nutshell.slamRadius / SUB));
      const cx = Math.round(worldPx((c.x - h.x) / SUB) + pos.x);
      const cy = Math.round(worldPx((c.y - h.y) / SUB) + pos.y);
      // The landing area fills in as the slam winds up; the edge is there from the start.
      disc(g, cx, cy, Math.max(1, Math.round(r * f)), Palette.telegraph, 0.28);
      ditherDisc(g, cx, cy, r, Palette.telegraph, 0, r - 2);
      ring(g, cx, cy, r, Palette.telegraphDark);
    }
  }

  /** The old placeholder Husk shape, its hitbox: drawn over the sprite with the F3 debug flag. */
  private drawHuskShape(
    g: G,
    run: Run,
    h: HuskState,
    pos: { x: number; y: number },
    fx: Fx,
    timeMs: number,
  ): void {
    const P = run.params;
    const hp = huskParams(P, h.kind);
    const r = Math.round(hp.radius / SUB);
    let { x, y } = pos;
    if (h.action === 'spawn') return;
    if (h.action === 'flinch' || h.hitstop > 0) {
      x += Math.round((Math.random() - 0.5) * 2);
      y += Math.round((Math.random() - 0.5) * 2);
    }
    // Wind-up: pull back from the strike, flashing in the telegraph color, then hold it.
    let ink = NORMAL;
    if (h.action === 'windup') {
      const f = Math.min(1, h.t / hp.startup);
      const back = Math.round(f * 2);
      x -= Math.round(Math.cos(rad(h.attackDir)) * back);
      y -= Math.round(Math.sin(rad(h.attackDir)) * back);
      const committed = h.t > hp.track;
      const blink = Math.floor((timeMs / 1000) * this.juice().telegraphBlinkHz) % 2 === 0;
      if (committed || blink) ink = TELEGRAPH;
    }
    if (fx.isFlashing(`h${h.id}`)) ink = HIT;

    // Current shell layer and its state (drives the cracks and the poise bar).
    const layer = h.shell.findIndex((v) => v > 0);
    const frac = layer >= 0 ? (h.shell[layer] ?? 0) / Math.max(1, hp.shell[layer] ?? 1) : 0;

    if (h.kind === 'peeling') {
      if (layer >= 0) {
        disc(g, x, y, r + 1, ink.outline);
        disc(g, x, y, r, ink.fill);
        ditherDisc(g, x, y, r, ink.shade, 1, r - 2);
        // Spiral.
        ring(g, x, y, r - 2, ink.shade);
        g.fillStyle(ink.fill, 1).fillRect(x + r - 3, y - 1, 2, 2);
        g.fillStyle(ink.outline, 1)
          .fillRect(x, y, 1, 1)
          .fillRect(x + 1, y - 1, 1, 1);
        this.drawCracks(g, h, x, y, r, layer, frac, ink);
      } else {
        // Shell gone: the core is exposed (ringed so it never merges with the floor).
        this.drawShellFragments(g, x, y, r, ink);
        disc(g, x, y, 3, ink.coreRing);
        disc(g, x, y, 2, ink === HIT ? Palette.hit : Palette.core);
      }
    } else {
      // Nutshell: one ring per intact layer around a visible core.
      const lost = layer < 0 ? h.shell.length : layer;
      const rr = r - lost * 3;
      if (layer >= 0) {
        disc(g, x, y, rr + 1, ink.outline);
        disc(g, x, y, rr, ink.fill);
        ditherDisc(g, x, y, rr, ink.shade, 1, rr - 3);
        ring(g, x, y, Math.max(3, rr - 4), ink.inner);
        this.drawCracks(g, h, x, y, rr, layer, frac, ink);
      } else {
        this.drawShellFragments(g, x, y, r - 2, ink);
      }
      disc(g, x, y, 3, ink.coreRing);
      disc(
        g,
        x,
        y,
        2,
        ink === HIT ? Palette.hit : ink === TELEGRAPH ? Palette.telegraph : Palette.core,
      );
      if (ink !== HIT) g.fillStyle(Palette.core, 1).fillRect(x, y, 1, 1);
    }
  }

  /** Cracks on the current shell layer: one below 100%, three below 30% (same thresholds as the poise bar). */
  private drawCracks(
    g: G,
    h: HuskState,
    x: number,
    y: number,
    r: number,
    layer: number,
    frac: number,
    ink: HuskInk,
  ): void {
    if (frac >= 1 || ink === HIT) return;
    const count = frac < 0.3 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const a = ((noise(h.id, layer, i) % 360) * Math.PI) / 180;
      const len = Math.max(2, Math.round(r * (i === 0 ? 0.6 : 0.45)));
      const x0 = x + Math.cos(a) * r;
      const y0 = y + Math.sin(a) * r;
      const bend = a + (i % 2 === 0 ? 0.5 : -0.5);
      const xm = x0 - Math.cos(a) * len * 0.5;
      const ym = y0 - Math.sin(a) * len * 0.5;
      pixelLine(g, x0, y0, xm, ym, ink.outline);
      pixelLine(
        g,
        xm,
        ym,
        xm - Math.cos(bend) * len * 0.5,
        ym - Math.sin(bend) * len * 0.5,
        ink.outline,
      );
    }
  }

  private drawShellFragments(g: G, x: number, y: number, r: number, ink: HuskInk): void {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const px = Math.round(x + Math.cos(a) * r);
      const py = Math.round(y + Math.sin(a) * r);
      outlinedRect(g, px, py, 2, 1, ink.fill, ink.outline);
    }
  }

  /**
   * Poise bar (16×2 inside a 1 px outline), shown only once the husk has taken
   * damage. Crack notch under 30%; broken (staggered or no shell left) gets a
   * lit outline: it marks the player's opening. World px over the Husk.
   */
  private drawPoise(g: G, run: Run, h: HuskState, pos: Point, timeMs: number): void {
    if (h.action === 'spawn') return;
    const hp = huskParams(run.params, h.kind);
    const damaged = h.shell.some((v, i) => v < (hp.shell[i] ?? 0)) || h.core < hp.core;
    if (!damaged) return;
    const layer = h.shell.findIndex((v) => v > 0);
    const broken = layer < 0 || h.action === 'stagger' || h.action === 'held';
    const x = pos.x - 9;
    const top = pos.y - Math.round(worldPx(hp.radius / SUB)) - 8 - (h.shell.length - 1) * 5;
    if (broken) {
      const on = Math.floor(timeMs / 150) % 2 === 0;
      const y = top + (h.shell.length - 1) * 5;
      g.fillStyle(Palette.uiPanel, 1).fillRect(x - 1, y - 1, 20, 6);
      g.fillStyle(on ? Palette.uiFocus : Palette.sparkDeep, 1).fillRect(x, y, 18, 4);
      g.fillStyle(Palette.uiPanel, 1).fillRect(x + 1, y + 1, 16, 2);
      return;
    }
    // One bar per shell layer, outermost on top; a broken layer is an empty track.
    h.shell.forEach((v, i) => {
      const y = top + i * 5;
      const frac = v / Math.max(1, hp.shell[i] ?? 1);
      g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, 18, 4);
      g.fillStyle(Palette.poiseTrack, 1).fillRect(x + 1, y + 1, 16, 2);
      if (v <= 0) return;
      const w = Math.max(1, Math.round(16 * frac));
      g.fillStyle(Palette.poiseFill, 1).fillRect(x + 1, y + 1, w, 2);
      if (frac < 0.3 && w > 2)
        g.fillStyle(Palette.poiseTrack, 1).fillRect(x + 1 + w - 2, y + 1, 1, 1);
    });
  }

  /** Heavy charge: three stage pips on an outline chip, just below the player's feet while held (world px). */
  private drawChargeMeter(g: G, run: Run, pos: Point): void {
    const p = run.state.player;
    if (p.action !== 'charge') return;
    const stage = chargeStage(p.charge, run.params.weapon.heavy);
    const x = pos.x - 6;
    const y = pos.y + worldPx(PLAYER_FEET) + 4;
    g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, 13, 4);
    for (let i = 0; i < 3; i++) {
      const on = i < stage;
      g.fillStyle(
        on ? (stage === 3 ? Palette.healthFill : Palette.spark) : Palette.uiBevel,
        1,
      ).fillRect(x + 1 + i * 4, y + 1, 3, 2);
    }
  }

  /** The old placeholder Kindled figure, its hitbox: drawn over the sprite with the F3 debug flag. */
  private drawKindledShape(g: G, session: Session, pos: { x: number; y: number }, fx: Fx): void {
    const s = session.run.state;
    const p = s.player;
    let { x, y } = pos;
    // Charging: a drawn-back stance, 2 px away from the aim.
    if (p.action === 'charge') {
      const a = rad(p.aim);
      x -= Math.round(Math.cos(a) * 2);
      y -= Math.round(Math.sin(a) * 2);
    }
    // The shape is anchored on the body center, 5 px above the feet (the sprite origin).
    y -= 5;
    if (p.action === 'dead') {
      outlinedRect(g, x - 8, y + 1, 16, 4, Palette.playerShirt, Palette.playerOutline);
      outlinedRect(g, x + 4, y, 5, 5, Palette.playerSkin, Palette.playerOutline);
      return;
    }
    const attacking = p.action === 'light' || p.action === 'heavy' || p.action === 'ability';
    const facing = facingIndex(p.action === 'idle' || p.action === 'charge' ? p.aim : p.dir);
    const flash = fx.isFlashing('p');
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > SUB / 4;
    const step = moving && p.action !== 'dodge' ? Math.floor(s.tick / 7) % 2 : -1;
    const ink = flash ? { outline: Palette.hit, solid: Palette.hit } : undefined;
    drawKindled(g, x, y, facing, ink, step, !attacking);
  }

  /**
   * Slash arcs for light strikes (exact aim direction, not the 8-way facing; world px); the heavy is a line, see drawThrust.
   * Only the arc, the hitbox flash: the sheet draws its own blade in the wind-up (`lightSlashMark`).
   */
  private drawSlash(g: G, run: Run, x: number, y: number): void {
    const P = run.params;
    const p = run.state.player;
    if (p.action !== 'light') return;
    const phase = playerAttackPhase(p, P);
    const st = lightStrike(P, p.comboStep);
    const reach = worldPx(st.reach / SUB);
    const half = rad(st.halfArc);
    const dir = rad(p.dir);
    const activeEnd = st.startup + st.active;
    const cy = y - worldPx(3);
    if (lightSlashMark(phase, p.t - activeEnd) !== 'arc') return;
    const thick = p.comboStep === P.weapon.light.length - 1 ? 4 : 3;
    const sweep = phase === 'active' ? Math.min(1, (p.t - st.startup) / Math.max(1, st.active)) : 1;
    const ccw = p.comboStep % 2 === 0;
    const from = ccw ? dir - half : dir + half;
    const to = from + (ccw ? 1 : -1) * 2 * half * sweep;
    const a0 = Math.min(from, to);
    const a1 = Math.max(from, to);
    const fading = phase === 'recovery';
    g.lineStyle(thick + 2, Palette.playerOutline, fading ? 0.5 : 1);
    g.beginPath();
    g.arc(x, cy, reach - thick / 2, a0, a1);
    g.strokePath();
    g.lineStyle(thick, Palette.blade, fading ? 0.5 : 1);
    g.beginPath();
    g.arc(x, cy, reach - thick / 2, a0, a1);
    g.strokePath();
  }

  /**
   * Where the pad reticle sits (world px): on the soft-locked Husk when there
   * is one, else `juice.padReticleDistPx` (sim px, ×2) out along the aim.
   */
  private padReticleAt(
    reticle: Extract<Reticle, { kind: 'pad' }>,
    s: RunState,
    player: Point,
    huskW: Map<number, Point>,
  ): Point {
    const lift = worldPx(3);
    const target = reticle.targetId === null ? undefined : huskW.get(reticle.targetId);
    const husk =
      reticle.targetId === null ? undefined : s.husks.find((h) => h.id === reticle.targetId);
    if (target && husk && husk.core > 0 && husk.action !== 'spawn')
      return { x: target.x, y: target.y - lift };
    const a = rad(reticle.aim);
    const d = worldPx(this.juice().padReticleDistPx);
    return { x: player.x + Math.cos(a) * d, y: player.y - lift + Math.sin(a) * d };
  }

  /**
   * The Haul guide (pad only): a faint dotted line from the player along the
   * aim to the Haul's range while the Haul is ready, so the throw can be seen
   * before it is made. Hidden during the cooldown (and so while the hook is
   * out) and when the slot is locked. Muted ink, never a signal color.
   */
  private drawHaulGuide(g: G, run: Run, player: Point, aim: number): void {
    const s = run.state;
    const p = s.player;
    const haul = run.params.weapon.abilities[0];
    if (!haul || haul.locked || !haul.haul || (p.cooldowns[0] ?? 0) > 0 || p.action === 'dead')
      return;
    const a = rad(aim);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const range = haul.haul.range / SUB;
    // The guide ends where the hook would snag: the first wall along the aim (the projectile's own test).
    let end = GUIDE_START;
    for (let d = GUIDE_START; d <= range; d += GUIDE_STEP) {
      if (hookSnags(s, p.x + Math.round(cos * d * SUB), p.y + Math.round(sin * d * SUB))) break;
      end = d;
    }
    if (end <= GUIDE_START) return;
    // Drawn in world px from the player (sim px ×2): 1 px dots every 4 px.
    const x = player.x;
    const y = player.y - worldPx(3);
    pixelLine(
      g,
      x + cos * worldPx(GUIDE_START),
      y + sin * worldPx(GUIDE_START),
      x + cos * worldPx(end),
      y + sin * worldPx(end),
      Palette.uiInkMuted,
      4,
    );
  }
}

/** A sim-px point in whole world px. */
function toWorld(p: Point): Point {
  return { x: Math.round(worldPx(p.x)), y: Math.round(worldPx(p.y)) };
}

/**
 * Aim reticle: four broken rims on the diagonals around a spark. Never a
 * cross or plus. Drawn by the world camera for the pad (world px) and by the
 * UI camera on the mouse pointer, where it is the cursor (UI px).
 */
export function drawReticle(g: G, px: number, py: number): void {
  const cx = Math.round(px);
  const cy = Math.round(py);
  const pts: [number, number][] = [[0, 0]];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    pts.push([sx * 5, sy * 3], [sx * 5, sy * 4], [sx * 4, sy * 5], [sx * 3, sy * 5]);
  }
  g.fillStyle(Palette.uiOutline, 1);
  for (const [dx, dy] of pts) g.fillRect(cx + dx - 1, cy + dy - 1, 3, 3);
  g.fillStyle(Palette.uiInk, 1);
  for (const [dx, dy] of pts) g.fillRect(cx + dx, cy + dy, 1, 1);
}

/** Checkerboard pixels inside a rotated band: from (x, y) along angle `a` for `len`, `half` wide each side. */
function thrustBand(
  g: G,
  x: number,
  y: number,
  a: number,
  len: number,
  half: number,
  color: number,
): void {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const r = Math.ceil(len + half) + 1;
  g.fillStyle(color, 1);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const along = dx * c + dy * s;
      const across = -dx * s + dy * c;
      if (along < 0 || along > len || Math.abs(across) > half) continue;
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (((px + py) & 1) === 0) g.fillRect(px, py, 1, 1);
    }
  }
}

/** Colors for a Kindled silhouette (afterimage, hit flash); default is the Clay Remembrance. */
interface KindledInk {
  outline: number;
  solid: number;
}

type Part = [x: number, y: number, w: number, h: number, color: number];

/**
 * The Kindled as a placeholder 16×24 figure with a 1 px ui-outline outline (the
 * darkest outline in the room), turned to one of 8 facings (S, SE, E, NE, N,
 * NW, W, SW). Anchored on the body center; feet land at y + 5.
 */
export function drawKindled(
  g: G,
  x: number,
  y: number,
  facing: number,
  ink?: KindledInk,
  step = -1,
  blade = true,
): void {
  const c = (color: number): number => ink?.solid ?? color;
  const outline = ink?.outline ?? Palette.playerOutline;
  const f = ((facing % 8) + 8) % 8;
  // East-side facings are drawn directly; west-side ones mirror them.
  const west = f >= 5;
  const side = west ? 8 - f : f; // 0 S, 1 SE, 2 E, 3 NE, 4 N
  const mx = (px: number, w: number): number => (west ? -px - w : px);
  const legA = step === 0 ? 3 : 4;
  const legB = step === 1 ? 3 : 4;
  const parts: Part[] = [
    [-3, 1, 2, legA, c(Palette.playerTrousers)],
    [1, 1, 2, legB, c(Palette.playerTrousers)],
    [-4, -5, 8, 7, c(Palette.playerShirt)],
    [-6, -4, 2, 5, c(Palette.playerShirt)],
    [4, -4, 2, 5, c(Palette.playerShirt)],
    [-6, 1, 2, 1, c(Palette.playerSkin)],
    [4, 1, 2, 1, c(Palette.playerSkin)],
    [-3, -11, 6, 6, c(Palette.playerSkin)],
  ];
  // Hair: covers more of the head the further the figure turns away.
  const hair = c(Palette.playerHair);
  const hairParts: Part[][] = [
    [[-3, -12, 6, 2, hair]],
    [
      [-3, -12, 6, 2, hair],
      [-3, -10, 1, 3, hair],
    ],
    [
      [-3, -12, 6, 2, hair],
      [-3, -10, 3, 4, hair],
    ],
    [
      [-3, -12, 6, 2, hair],
      [-3, -10, 5, 5, hair],
    ],
    [[-3, -12, 6, 7, hair]],
  ];
  parts.push(...(hairParts[side] ?? []));
  const eyes: [number, number][][] = [
    [
      [-2, -9],
      [1, -9],
    ],
    [
      [-1, -9],
      [2, -9],
    ],
    [[2, -9]],
    [],
    [],
  ];

  // Blade along the facing, from the leading hand; behind the body when facing away.
  const dir = facingStep(f);
  const hand = {
    x: x + (dir.x === 0 ? (west ? -5 : 5) : dir.x * 5),
    y: y + 1 + Math.max(0, dir.y),
  };
  const tip = {
    x: hand.x + dir.x * 7,
    y: hand.y + dir.y * 6 - (dir.x !== 0 && dir.y === 0 ? 2 : 0),
  };
  const drawBlade = (): void => {
    if (!blade) return;
    pixelLine(g, hand.x, hand.y, tip.x, tip.y, outline, 1, 3);
    g.fillStyle(outline, 1).fillRect(tip.x - 1 + (dir.x < 0 ? 1 : -1), tip.y - 2, 3, 3);
    pixelLine(g, hand.x, hand.y, tip.x, tip.y, ink?.solid ?? Palette.blade);
    g.fillStyle(ink?.solid ?? Palette.blade, 1).fillRect(
      tip.x + (dir.x < 0 ? 1 : -1),
      tip.y - 1,
      1,
      1,
    );
  };
  const behind = dir.y < 0;
  if (behind) drawBlade();
  g.fillStyle(outline, 1);
  for (const [px, py, w, h] of parts) g.fillRect(x + mx(px, w) - 1, y + py - 1, w + 2, h + 2);
  for (const [px, py, w, h, color] of parts)
    g.fillStyle(color, 1).fillRect(x + mx(px, w), y + py, w, h);
  if (!ink) {
    g.fillStyle(outline, 1);
    for (const [ex, ey] of eyes[side] ?? []) g.fillRect(x + mx(ex, 1), y + ey, 1, 1);
  }
  if (!behind) drawBlade();
}
