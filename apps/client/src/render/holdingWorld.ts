import type Phaser from 'phaser';
import {
  holdingTemplate,
  KESH_ROCK_SHEET,
  spriteSheets,
  STATION_SHEETS,
  type AnimTuning,
  type ClayTone,
  type HoldingLayout,
  type SpriteSheet,
  type TileRect,
} from '@iot/shared';
import type { RoamState } from '@iot/sim';
import { nearestPart, propBase } from '../game/holdingView.js';
import { RoamGaitClock, roamPose, type KindledPose } from './animState.js';
import { PLAYER_SHEET } from './characters.js';
import { DEPTH } from './depth.js';
import { bodyDepth, PLAYER_FEET } from './feet.js';
import { shadowEllipse } from './pixels.js';
import { propShadowSizes, type ShadowSize } from './propShadow.js';
import { HOLDING_SHEET, TileRoom } from './roomTiles.js';
import { snapToArt } from './scale.js';
import { texturePixels, toneTextureKey } from './spriteSheets.js';
import { StrideMeter } from './stride.js';

type G = Phaser.GameObjects.Graphics;

/** The Kindled's grounding shadow, world px (readability.md §2). */
const SHADOW_W = 20;
const SHADOW_H = 6;

/** A prop standing in the world: a station part's, or Kesh's rock; its image's origin is the line under its base. */
interface Prop {
  /** The station it belongs to; null for Kesh's rock. */
  stationId: string | null;
  rect: TileRect;
  image: Phaser.GameObjects.Image;
  sheet: string;
}

/**
 * The holding in the world (docs/design/holding.md, M2 Task 3b, 3c), drawn
 * like a room: the layout through the shore tile rule from the
 * `tiles-holding` sheet (the void transparent over the hollow background),
 * a prop per station part (the six trees on the tall cell, the post, the
 * store, the outcrop; a reserved spot draws none) and Kesh's rock in the
 * void, each a sprite from its prop sheet standing on the bottom centre of
 * its tile rectangle with a grounding shadow by the prop rule, and the
 * Kindled from its Kindled sheet posed by `roamPose` from the roam state,
 * with its 20 × 6 shadow, all y-sorted by the line they stand on
 * (`bodyDepth`): the Kindled north of a tree draws behind its canopy. Purely
 * a view of the roam state and the layout.
 */
export class HoldingWorld {
  readonly tiles: TileRoom;
  private readonly floor: G;
  private readonly props: Prop[] = [];
  private readonly player: Phaser.GameObjects.Sprite;
  private readonly stride = new StrideMeter();
  private readonly gait = new RoamGaitClock();
  private shadows = new Map<string, Map<string, ShadowSize>>();
  readonly playerSheet: SpriteSheet = spriteSheets[PLAYER_SHEET];
  /** The pose shown this frame (playtests). */
  pose: KindledPose | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    readonly layout: HoldingLayout,
    private readonly anim: () => AnimTuning,
    private tone: ClayTone,
  ) {
    this.floor = scene.add.graphics().setDepth(DEPTH.floor);
    layer.add(this.floor);
    this.tiles = new TileRoom(scene, layer, HOLDING_SHEET);
    this.tiles.build(holdingTemplate(layout));
    const stand = (stationId: string | null, rect: TileRect, sheet: string): void => {
      const base = propBase({ rect });
      const image = scene.add
        .image(snapToArt(base.x), snapToArt(base.y), sheet, 'idle_0')
        .setDepth(bodyDepth({ kind: 'prop' }, base.y));
      layer.add(image);
      this.props.push({ stationId, rect, image, sheet });
    };
    for (const station of layout.stations) {
      const sheet = STATION_SHEETS[station.kind];
      if (!sheet || station.reserved) continue;
      for (const part of station.parts) stand(station.id, part.rect, sheet);
    }
    stand(null, layout.kesh.rock, KESH_ROCK_SHEET);
    this.player = scene.add.sprite(0, 0, this.playerTexture()).setVisible(false);
    layer.add(this.player);
  }

  private playerTexture(): string {
    return toneTextureKey(this.scene, PLAYER_SHEET, this.tone);
  }

  setTone(tone: ClayTone): void {
    this.tone = tone;
    this.player.setTexture(this.playerTexture(), this.player.frame.name);
  }

  /** A prop's shadow by the prop rule, from its sheet's pixels (read once per sheet). */
  private propShadow(sheet: string, frame: string): ShadowSize {
    let sizes = this.shadows.get(sheet);
    if (!sizes) {
      const img = texturePixels(this.scene, sheet);
      const def = spriteSheets[sheet as keyof typeof spriteSheets];
      if (img) {
        sizes = propShadowSizes(def, img);
        this.shadows.set(sheet, sizes);
      }
    }
    return sizes?.get(frame) ?? { w: 0, h: 0 };
  }

  /** A grounding shadow `w` × `h` world px, centred on x, its middle row on the line under the soles (footY). */
  private shadowAt(x: number, footY: number, w: number, h: number): void {
    const sw = Math.max(2, Math.round(w));
    const sh = Math.max(2, Math.round(h));
    shadowEllipse(this.floor, x - Math.floor(sw / 2), footY - Math.floor(sh / 2), sw, sh);
  }

  /**
   * The world px over a station's prop (the floaters rise from above it, the
   * prompt stands there): the part nearest `near` (sim px) when the station
   * has several (the trees), else its one prop; null for a station without
   * a prop (a reserved spot).
   */
  propTop(stationId: string, near?: { x: number; y: number }): { x: number; y: number } | null {
    const station = this.layout.stations.find((s) => s.id === stationId);
    const part = station && near ? nearestPart(station, near.x, near.y) : (station?.parts[0] ?? null);
    const p = this.props.find((x) => x.stationId === stationId && (!part || x.rect === part.rect));
    if (!p) return null;
    return { x: p.image.x, y: p.image.y - p.image.height + 10 };
  }

  /** Every prop's sheet and frame, in layout order, Kesh's rock last (playtests). */
  propFrames(): { stationId: string | null; sheet: string; frame: string; x: number; y: number; depth: number }[] {
    return this.props.map((p) => ({ stationId: p.stationId, sheet: p.sheet, frame: p.image.frame.name, x: p.image.x, y: p.image.y, depth: p.image.depth }));
  }

  /** The Kindled's depth this frame (playtests: behind a tree's canopy when its feet are north of the tree's base). */
  playerDepth(): number {
    return this.player.depth;
  }

  /** Poses the Kindled at its interpolated position (sim px) from the roam state, and draws the shadows. */
  draw(s: RoamState, player: { x: number; y: number }): void {
    this.floor.clear();
    for (const { rect, image, sheet } of this.props) {
      const sh = this.propShadow(sheet, image.frame.name);
      const base = propBase({ rect });
      if (sh.w > 0) this.shadowAt(snapToArt(base.x), snapToArt(base.y), sh.w, sh.h);
    }
    this.shadowAt(snapToArt(player.x), snapToArt(player.y + PLAYER_FEET), SHADOW_W, SHADOW_H);
    const distancePx = this.stride.step(player.x, player.y);
    const pose = roamPose(s, this.playerSheet, this.gait.update(s), { distancePx, cycles: this.anim() });
    this.pose = pose;
    const frame = this.playerSheet.anims[pose.anim]?.frames[pose.frame] ?? this.playerSheet.anims[pose.anim]?.frames[0] ?? '';
    const texture = this.playerTexture();
    if (this.player.texture.key !== texture || this.player.frame.name !== frame) this.player.setTexture(texture, frame);
    this.player
      .setPosition(snapToArt(player.x), snapToArt(player.y + PLAYER_FEET))
      .setVisible(true)
      .setDepth(bodyDepth({ kind: 'kindled' }, player.y));
  }
}
