import type Phaser from 'phaser';
import {
  spriteSheets,
  type AnimTuning,
  type ClayTone,
  type SpriteSheet,
  type SpriteSheetName,
} from '@iot/shared';
import { SUB, type HuskKind, type Params, type Run } from '@iot/sim';
import type { Session } from '../game/session.js';
import { Palette } from '../palette.js';
import {
  backpedals,
  GaitClock,
  huskFlip,
  huskPose,
  kindledPose,
  separationDeg,
  simDeg,
  type Clocks,
  type KindledPose,
  type Pose,
} from './animState.js';
import { DEPTH } from './depth.js';
import { bodyDepth, huskFeet, PLAYER_FEET } from './feet.js';
import type { Fx } from './fx.js';
import { snapToArt } from './scale.js';
import { toneTextureKey } from './spriteSheets.js';
import { StrideMeter } from './stride.js';

type Sprite = Phaser.GameObjects.Sprite;

/**
 * The player's sheet: the one place the client names it (the loader lists
 * every sheet). Today every Remembrance wears kindled-ash; the engine reads
 * the sheet, its scale and its points from `CharacterSprites.playerSheet`.
 */
export const PLAYER_SHEET: SpriteSheetName = 'kindled-ash';

/**
 * The player's sheet outside combat (`kindled-<rem>-sheathed`, ART #87): the
 * blade put away under the cloak, David's playtest of the holding. The
 * holding draws the Kindled from it; encounters keep `PLAYER_SHEET`.
 */
export const PLAYER_SHEATHED_SHEET: SpriteSheetName = 'kindled-ash-sheathed';

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
 * Positions come in sim px and become world px here: each sprite stands on
 * a whole world px (a sheet px is a world px), its feet 5 sim px (the
 * Kindled) or a radius (a Husk) below the centre.
 * Effects stay in the engine: the grounding shadow (world.ts), the white hit
 * flash (a fill tint), chips as particles (fx.ts), the Hookblade FX at the
 * hook tip (hookblade.ts). Facing comes from the sim's aim or move direction;
 * Husks flip horizontally when they move or lunge west. Bodies y-sort by the
 * line they stand on (`bodyDepth`), so one in front on the floor draws over.
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
  /** The player's sheet (`PLAYER_SHEET`): the Hookblade's points read it. */
  readonly playerSheet: SpriteSheet = spriteSheets[PLAYER_SHEET];
  /** The run's params at the last draw (a corpse's feet come from its kind's radius). */
  private params: Params | null = null;
  /** How far the player has moved (world px), for the run and walk cycles, and which way last. */
  private readonly stride = new StrideMeter();
  /** The Kindled runs backwards (`backpedals`, with hysteresis): its movement is away from where it faces. */
  private backpedal = false;
  /** When the Kindled started or stopped, for the run transitions (`run_start`, `run_stop`). */
  private readonly gait = new GaitClock();
  /** Recent player positions (sim px), for the trail to start behind the dodge. */
  private recent: { x: number; y: number; pose: KindledPose; age: number }[] = [];
  private trailLeft = 0;
  private ghostClock = 0;
  /** The pose shown this frame (the debug overlay and playtests read it). */
  pose: KindledPose | null = null;
  /** The player's frame this frame, and the world px it is drawn at (its origin): the Hookblade's points move with it. */
  playerFrame = '';
  playerAnchor = { x: 0, y: 0 };
  /** The Husks' poses this frame, in sim order (playtests). */
  huskPoses: Pose[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly anim: () => AnimTuning,
    tone: ClayTone = spriteSheets[PLAYER_SHEET].palette?.drawn as ClayTone,
  ) {
    this.tone = tone;
    this.player = this.sprite(this.playerTexture());
    this.player.setDepth(bodyDepth({ kind: 'kindled' }, 0));
  }

  /** The Kindled's texture in the current tone (built on first use). */
  private playerTexture(): string {
    return toneTextureKey(this.scene, PLAYER_SHEET, this.tone);
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
    const feet = this.params ? huskFeet(this.params, kind) : 0;
    sprite
      .setPosition(prev?.sprite.x ?? snapToArt(x / SUB), prev?.sprite.y ?? snapToArt(y / SUB + feet))
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

  /** An afterimage at a body centre (sim px): the sprite's frame over a 1 world px rim. */
  private ghost(x: number, y: number, pose: KindledPose, life: number): void {
    if (life <= 0 || this.ghosts.length >= MAX_GHOSTS) return;
    const g = this.ghostPool.pop() ?? {
      ink: this.sprite(this.playerTexture()),
      rim: RIM.map(() => this.sprite(this.playerTexture())),
      life: 0,
    };
    g.life = life;
    const frame = this.frameName(this.playerSheet, pose);
    const wx = snapToArt(x);
    const wy = snapToArt(y + PLAYER_FEET);
    g.ink
      .setTexture(this.playerTexture(), frame)
      .setPosition(wx, wy)
      .setTintFill(Palette.trail)
      .setDepth(DEPTH.trail + 1)
      .setVisible(true);
    g.rim.forEach((r, i) => {
      const [dx, dy] = RIM[i] ?? [0, 0];
      r.setTexture(this.playerTexture(), frame)
        .setPosition(wx + dx, wy + dy)
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
   * interpolated body centers in sim px (unrounded: each sprite snaps to a
   * whole world px); `dtWorldMs` slows with slow-mo (the trail and
   * corpses), `dtRealMs` does not (the hit and regrow clocks).
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
    this.params = P;

    // The player.
    if (p.action === 'dead' && this.deathAt < 0) this.deathAt = this.now;
    if (p.action !== 'dead') this.deathAt = -1;
    const distancePx = this.stride.step(player.x, player.y);
    // The backpedal: the movement (the render positions' heading) against the facing, the aim.
    const heading = this.stride.headingDeg;
    if (heading !== null) this.backpedal = backpedals(this.backpedal, separationDeg(heading, simDeg(p.aim)));
    const stride = { distancePx, cycles: this.anim(), backpedal: this.backpedal };
    const pose = kindledPose(s, P, this.playerSheet, { ...this.clocks('p'), ...this.gait.update(s) }, stride);
    this.pose = pose;
    this.playerFrame = this.frameName(this.playerSheet, pose);
    this.show(this.player, this.playerTexture(), this.playerSheet, pose);
    const invulnerable = p.iframes > 0 || p.hurtInvuln > 0;
    const flash = fx.isFlashing('p');
    const hidden = invulnerable && !flash && (s.tick & 1) === 1;
    // Sprites stand on their origin, the point between the feet; the sim position is the body center.
    this.playerAnchor = { x: snapToArt(player.x), y: snapToArt(player.y + PLAYER_FEET) };
    this.player
      .setPosition(this.playerAnchor.x, this.playerAnchor.y)
      .setVisible(!hidden)
      .setDepth(bodyDepth({ kind: 'kindled' }, player.y));
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
      const pos = huskPos.get(h.id) ?? { x: h.x / SUB, y: h.y / SUB };
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
      const feet = huskFeet(P, h.kind);
      sprite
        .setPosition(snapToArt(x), snapToArt(y + feet))
        .setFlipX(entry.flip)
        .setVisible(true)
        .setDepth(bodyDepth({ kind: 'husk', husk: h.kind, P }, y));
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
