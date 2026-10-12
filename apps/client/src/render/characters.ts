import type Phaser from 'phaser';
import { spriteSheets, type ClayTone, type SpriteSheet, type SpriteSheetName } from '@iot/shared';
import { huskParams, SUB, type HuskKind, type Run } from '@iot/sim';
import type { Session } from '../game/session.js';
import { Palette } from '../palette.js';
import {
  huskFlip,
  huskPose,
  kindledPose,
  type Clocks,
  type KindledPose,
  type Pose,
} from './animState.js';
import { DEPTH } from './depth.js';
import { feetOffset, PLAYER_FEET } from './feet.js';
import type { Fx } from './fx.js';
import { toneTextureKey } from './spriteSheets.js';

type Sprite = Phaser.GameObjects.Sprite;

const HUSK_SHEET: Record<HuskKind, SpriteSheetName> = {
  peeling: 'husk-peeling',
  nutshell: 'husk-nutshell',
};
/** The `drop` frame stays this long after a Husk's death animation. */
const DROP_MS = 250;
const GHOST_LIFE_MS = 220;
const TRAIL_MS = 260;
const GHOST_EVERY_MS = 34;
const MAX_GHOSTS = 12;
const RIM: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

interface HuskSprite {
  sprite: Sprite;
  flip: boolean;
}

/** A Husk's death playing out after the sim removed it: `death`, then `drop`. */
interface Corpse {
  sprite: Sprite;
  sheet: SpriteSheet;
  age: number;
}

/** One afterimage of the perfect-dodge trail: the silhouette in spark-glow over a 1 px hollow-deep rim. */
interface Ghost {
  ink: Sprite;
  rim: Sprite[];
  life: number;
}

/**
 * The player and the Husks as sprites from the character sheets, posed every
 * frame by the animation state machine (animState.ts) from the sim state.
 * Effects stay in the engine: the grounding shadow (world.ts), the white hit
 * flash (a fill tint), chips as particles (fx.ts), the Hookblade FX at the
 * hook tip (hookblade.ts). Facing comes from the sim's aim or move direction;
 * Husks flip horizontally when they move or lunge west.
 */
export class CharacterSprites {
  private readonly player: Sprite;
  private readonly husks = new Map<number, HuskSprite>();
  private corpses: Corpse[] = [];
  private ghosts: Ghost[] = [];
  private readonly ghostPool: Ghost[] = [];
  /** Hit and regrow clocks by entity key ('p', 'h<id>'), real ms when they started. */
  private readonly hitAt = new Map<string, number>();
  private readonly regrowAt = new Map<number, number>();
  private deathAt = -1;
  private now = 0;
  private tone: ClayTone;
  private readonly kindledSheet: SpriteSheet = spriteSheets['kindled-ash'];
  /** Recent player positions, for the trail to start behind the dodge. */
  private recent: { x: number; y: number; pose: KindledPose; age: number }[] = [];
  private trailLeft = 0;
  private ghostClock = 0;
  /** The pose shown this frame (the debug overlay and playtests read it). */
  pose: KindledPose | null = null;
  /** The Husks' poses this frame, in sim order (playtests). */
  huskPoses: Pose[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    tone: ClayTone = spriteSheets['kindled-ash'].palette?.drawn as ClayTone,
  ) {
    this.tone = tone;
    this.player = this.sprite(this.playerTexture());
    this.player.setDepth(DEPTH.bodies);
  }

  private playerTexture(): string {
    return toneTextureKey('kindled-ash', this.tone);
  }

  private sprite(texture: string, frame?: string): Sprite {
    const s = this.scene.add.sprite(0, 0, texture, frame).setVisible(false);
    this.layer.add(s);
    return s;
  }

  /** Clay tone of the Kindled (a palette swap built at load). */
  setTone(tone: ClayTone): void {
    this.tone = tone;
    this.player.setTexture(this.playerTexture(), this.player.frame.name);
  }

  getTone(): ClayTone {
    return this.tone;
  }

  /** Start the 100 ms hit frame on an entity ('p' or 'h<id>'). */
  hit(key: string): void {
    this.hitAt.set(key, this.now);
  }

  /** Start a Nutshell's regrow one-shot. */
  regrow(id: number): void {
    this.regrowAt.set(id, this.now);
  }

  /** The sim removed a Husk: keep its sprite for the death animation at its last position. */
  huskDied(id: number, kind: HuskKind, x: number, y: number): void {
    const prev = this.husks.get(id);
    const sheet = spriteSheets[HUSK_SHEET[kind]];
    const death = sheet.anims.death;
    if (!death) return;
    const sprite = prev ? prev.sprite : this.sprite(HUSK_SHEET[kind]);
    this.husks.delete(id);
    const feet = feetOffset(sheet);
    sprite
      .setPosition(
        prev?.sprite.x ?? Math.round(x / SUB),
        prev?.sprite.y ?? Math.round(y / SUB) + feet,
      )
      .setVisible(true)
      .clearTint()
      .setFlipX(prev?.flip ?? false);
    this.corpses.push({ sprite, sheet, age: 0 });
  }

  /** Start the afterimage trail (call on a perfect dodge). */
  perfectDodge(): void {
    this.trailLeft = TRAIL_MS;
    this.ghostClock = GHOST_EVERY_MS;
    let last: { x: number; y: number } | null = null;
    for (const r of this.recent) {
      if (last && Math.abs(r.x - last.x) + Math.abs(r.y - last.y) < 6) continue;
      this.ghost(r.x, r.y, r.pose, GHOST_LIFE_MS - r.age);
      last = r;
    }
  }

  private ghost(x: number, y: number, pose: KindledPose, life: number): void {
    if (life <= 0 || this.ghosts.length >= MAX_GHOSTS) return;
    const g = this.ghostPool.pop() ?? {
      ink: this.sprite(this.playerTexture()),
      rim: RIM.map(() => this.sprite(this.playerTexture())),
      life: 0,
    };
    g.life = life;
    const frame = this.frameName(this.kindledSheet, pose);
    g.ink
      .setTexture(this.playerTexture(), frame)
      .setPosition(x, y + PLAYER_FEET)
      .setTintFill(Palette.trail)
      .setDepth(DEPTH.trail + 1)
      .setVisible(true);
    g.rim.forEach((r, i) => {
      const [dx, dy] = RIM[i] ?? [0, 0];
      r.setTexture(this.playerTexture(), frame)
        .setPosition(x + dx, y + PLAYER_FEET + dy)
        .setTintFill(Palette.trailOutline)
        .setDepth(DEPTH.trail)
        .setVisible(true);
    });
    this.ghosts.push(g);
  }

  private frameName(sheet: SpriteSheet, pose: Pose): string {
    return sheet.anims[pose.anim]?.frames[pose.frame] ?? sheet.anims[pose.anim]?.frames[0] ?? '';
  }

  private show(sprite: Sprite, texture: string, sheet: SpriteSheet, pose: Pose): void {
    const frame = this.frameName(sheet, pose);
    if (sprite.texture.key !== texture || sprite.frame.name !== frame)
      sprite.setTexture(texture, frame);
  }

  private clocks(key: string, regrowId?: number): Clocks {
    const hit = this.hitAt.get(key);
    const regrow = regrowId === undefined ? undefined : this.regrowAt.get(regrowId);
    return {
      hitMs: hit === undefined ? -1 : this.now - hit,
      deathMs: this.deathAt < 0 ? 0 : this.now - this.deathAt,
      ...(regrow === undefined ? {} : { regrowMs: this.now - regrow }),
    };
  }

  /**
   * Pose every sprite for this frame. `player` and `huskPos` are the
   * interpolated world-pixel body centers; `dtWorldMs` slows with slow-mo
   * (the trail and corpses), `dtRealMs` does not (the hit and regrow clocks).
   */
  draw(
    session: Session,
    fx: Fx,
    player: { x: number; y: number },
    huskPos: Map<number, { x: number; y: number }>,
    blink: boolean,
    dtWorldMs: number,
    dtRealMs: number,
  ): void {
    this.now += dtRealMs;
    const run: Run = session.run;
    const s = run.state;
    const P = run.params;
    const p = s.player;

    // The player.
    if (p.action === 'dead' && this.deathAt < 0) this.deathAt = this.now;
    if (p.action !== 'dead') this.deathAt = -1;
    const pose = kindledPose(s, P, this.kindledSheet, this.clocks('p'));
    this.pose = pose;
    this.show(this.player, this.playerTexture(), this.kindledSheet, pose);
    const invulnerable = p.iframes > 0 || p.hurtInvuln > 0;
    const flash = fx.isFlashing('p');
    const hidden = invulnerable && !flash && (s.tick & 1) === 1;
    // Sprites stand on their origin, the point between the feet; the sim position is the body center.
    this.player
      .setPosition(player.x, player.y + PLAYER_FEET)
      .setVisible(!hidden)
      .setDepth(DEPTH.bodies + player.y * DEPTH.perPixel);
    this.tint(this.player, flash);

    // The Husks.
    const seen = new Set<number>();
    this.huskPoses = [];
    for (const h of s.husks) {
      seen.add(h.id);
      let entry = this.husks.get(h.id);
      if (!entry) {
        entry = { sprite: this.sprite(HUSK_SHEET[h.kind]), flip: false };
        this.husks.set(h.id, entry);
      }
      const sprite = entry.sprite;
      const pos = huskPos.get(h.id) ?? { x: Math.round(h.x / SUB), y: Math.round(h.y / SUB) };
      const sheet = spriteSheets[HUSK_SHEET[h.kind]];
      const hp = huskPose(s, P, h, sheet, this.clocks(`h${h.id}`, h.id), blink);
      this.huskPoses.push(hp);
      this.show(sprite, HUSK_SHEET[h.kind], sheet, hp);
      entry.flip = huskFlip(h, entry.flip);
      let { x, y } = pos;
      if (h.action === 'flinch' || h.hitstop > 0) {
        x += Math.round((Math.random() - 0.5) * 2);
        y += Math.round((Math.random() - 0.5) * 2);
      }
      const feet = Math.round(huskParams(P, h.kind).radius / SUB);
      sprite
        .setPosition(x, y + feet)
        .setFlipX(entry.flip)
        .setVisible(true)
        .setDepth(DEPTH.bodies + y * DEPTH.perPixel);
      this.tint(sprite, fx.isFlashing(`h${h.id}`));
    }
    for (const [id, entry] of this.husks) {
      if (seen.has(id)) continue;
      // Gone without a death event (a room change): drop the sprite.
      entry.sprite.destroy();
      this.husks.delete(id);
      this.regrowAt.delete(id);
    }

    this.updateCorpses(dtWorldMs);
    this.updateTrail(player, pose, dtWorldMs);
  }

  /** The white hit flash: a fill tint in the signal colour (the only pure white). */
  private tint(sprite: Sprite, flash: boolean): void {
    if (flash) sprite.setTintFill(Palette.hit);
    else if (sprite.isTinted) sprite.clearTint();
  }

  private updateCorpses(dtWorldMs: number): void {
    this.corpses = this.corpses.filter((c) => {
      c.age += dtWorldMs;
      const death = c.sheet.anims.death;
      const drop = c.sheet.anims.drop;
      if (!death) return false;
      const deathMs = (death.frames.length / Math.max(1, death.frameRate)) * 1000;
      if (c.age < deathMs) {
        const i = Math.min(death.frames.length - 1, Math.floor((c.age / 1000) * death.frameRate));
        c.sprite.setFrame(death.frames[i] ?? death.frames[0] ?? '');
        return true;
      }
      if (drop && c.age < deathMs + DROP_MS) {
        c.sprite.setFrame(drop.frames[0] ?? '');
        return true;
      }
      c.sprite.destroy();
      return false;
    });
  }

  private updateTrail(pos: { x: number; y: number }, pose: KindledPose, dtWorldMs: number): void {
    for (const r of this.recent) r.age += dtWorldMs;
    this.recent = this.recent.filter((r) => r.age < 120);
    this.recent.unshift({ x: pos.x, y: pos.y, pose, age: 0 });
    for (const g of this.ghosts) g.life -= dtWorldMs;
    this.ghosts = this.ghosts.filter((g) => {
      if (g.life > 0) return true;
      g.ink.setVisible(false);
      for (const r of g.rim) r.setVisible(false);
      this.ghostPool.push(g);
      return false;
    });
    if (this.trailLeft > 0) {
      this.trailLeft -= dtWorldMs;
      this.ghostClock -= dtWorldMs;
      if (this.ghostClock <= 0) {
        this.ghostClock = GHOST_EVERY_MS;
        this.ghost(pos.x, pos.y, pose, GHOST_LIFE_MS);
      }
    }
  }
}
