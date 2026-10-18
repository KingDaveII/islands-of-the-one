import type Phaser from 'phaser';
import {
  holdingTemplate,
  spriteSheets,
  STATION_SHEETS,
  type AnimTuning,
  type ClayTone,
  type HoldingLayout,
  type LayoutStation,
  type SpriteSheet,
} from '@iot/shared';
import type { RoamState } from '@iot/sim';
import { propBase } from '../game/holdingView.js';
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

/**
 * The holding in the world (docs/design/holding.md, M2 Task 3b), drawn
 * exactly like a room: the layout through the tile rule from the
 * `tiles-holding` sheet, the three station props as sprites from their prop
 * sheets standing on the bottom centre of their tile rectangles with
 * grounding shadows by the prop rule, and the Kindled from its Kindled sheet
 * posed by `roamPose` from the roam state, with its 20 × 6 shadow, all
 * y-sorted by the line they stand on (`bodyDepth`). Purely a view of the
 * roam state and the layout.
 */
export class HoldingWorld {
  readonly tiles: TileRoom;
  private readonly floor: G;
  private readonly props = new Map<string, { station: LayoutStation; image: Phaser.GameObjects.Image; sheet: string }>();
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
    for (const station of layout.stations) {
      const sheet = STATION_SHEETS[station.kind];
      const base = propBase(station);
      const image = scene.add
        .image(snapToArt(base.x), snapToArt(base.y), sheet, 'idle_0')
        .setDepth(bodyDepth({ kind: 'prop' }, base.y));
      layer.add(image);
      this.props.set(station.id, { station, image, sheet });
    }
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

  /** The world px a station's prop stands at (the "+1" floaters rise from above it). */
  propTop(stationId: string): { x: number; y: number } | null {
    const p = this.props.get(stationId);
    if (!p) return null;
    return { x: p.image.x, y: p.image.y - p.image.height + 10 };
  }

  /** Poses the Kindled at its interpolated position (sim px) from the roam state, and draws the shadows. */
  draw(s: RoamState, player: { x: number; y: number }): void {
    this.floor.clear();
    for (const { station, image, sheet } of this.props.values()) {
      const sh = this.propShadow(sheet, image.frame.name);
      const base = propBase(station);
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
