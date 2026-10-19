import Phaser from 'phaser';
import {
  holdingTemplate,
  KESH_ROCK_SHEET,
  KESH_SHEET,
  SPARKGLASS_SHEET,
  spriteSheets,
  STATION_SHEETS,
  type AnimTuning,
  type ClayTone,
  type HoldingLayout,
  type KeshTuning,
  SPRITE_FACINGS,
  type SpriteSheet,
  type SpriteSheetName,
  type TileRect,
} from '@iot/shared';
import { TURN, type RoamState } from '@iot/sim';
import {
  nearestPart,
  opaqueBoundsIn,
  propBase,
  propIdlePlays,
  standsOnGround,
} from '../game/holdingView.js';
import { RoamGaitClock, roamPose, sheetFacing, type KindledPose } from './animState.js';
import { PLAYER_SHEATHED_SHEET } from './characters.js';
import { DEPTH } from './depth.js';
import { bodyDepth, PLAYER_FEET } from './feet.js';
import { tossPoint, tossReleaseFrame, tossReleasePoint } from './keshToss.js';
import { pickupFrameAt } from './pickupSprites.js';
import { shadowEllipse } from './pixels.js';
import { propShadowSizes, type ShadowSize } from './propShadow.js';
import { HOLDING_SHEET, TileRoom } from './roomTiles.js';
import { ITEM_ICON_TEXTURE } from './sheets.js';
import { Palette } from '../palette.js';
import { snapToArt } from './scale.js';
import { animKey, optionalSheet, texturePixels, toneTextureKey } from './spriteSheets.js';
import { StrideMeter } from './stride.js';

type G = Phaser.GameObjects.Graphics;

/** A prop sheet's data: a loaded sheet's, or an optional one's (the second tree) when it was on disk at build time. */
function sheetData(name: string): SpriteSheet | undefined {
  return Object.hasOwn(spriteSheets, name)
    ? spriteSheets[name as SpriteSheetName]
    : optionalSheet(name);
}

/** The seeds Kesh throws, drawn from their item icon (kesh.json names the item; the icon sheet has a cell per item). */
const SEEDS_ITEM = 'grey-seeds';

/** The Kindled's grounding shadow, world px (readability.md §2). */
const SHADOW_W = 20;
const SHADOW_H = 6;

/** Kesh's rows (sprites.md §4 "Old Kesh"): `fish` loops by default, `talk` while his line is open, `toss` once, then `fish`. */
export type KeshRow = 'fish' | 'talk' | 'toss';

/** What Kesh throws (kesh.json `toss`): a sliver from `prop-sparkglass`, the clay tile (a placeholder texture), the seeds' item icon. */
export type TossKind = 'sliver' | 'word' | 'seeds';

/** The thrown thing in the air: from the hand to the feet over `tossMs`, drawn from its own sprite. */
interface Flight {
  image: Phaser.GameObjects.Image;
  kind: TossKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  startMs: number;
  onLand: () => void;
}

/** The clay tile's placeholder texture (M2 Task 5): a small rectangle in two tokens, drawn once as a sprite texture. */
export const CLAY_TILE_TEXTURE = 'clay-tile';
const CLAY_TILE_W = 10;
const CLAY_TILE_H = 7;

/** A prop standing in the world: a station part's, or Kesh's rock; its image's origin is the line under its base. */
interface Prop {
  /** The station it belongs to; null for Kesh's rock. */
  stationId: string | null;
  rect: TileRect;
  image: Phaser.GameObjects.Sprite;
  sheet: string;
  /** False for a prop in the void (Kesh's rock): no grounding shadow. */
  grounded: boolean;
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
 * (`bodyDepth`): the Kindled north of a tree draws behind its canopy. Old
 * Kesh (M2 Task 4b) sits on his rock from `npc-kesh`, at the rock's world
 * point one depth step above it with no shadow: `fish` looping, `talk`
 * while the talk box shows his line, `toss` once when he throws; the thrown
 * thing leaves his hand on the release frame and flies its arc
 * (keshToss.ts) from `prop-sparkglass`'s `idle`. Purely a view of the roam
 * state, the layout and what the scene says Kesh is doing.
 */
export class HoldingWorld {
  readonly tiles: TileRoom;
  private readonly floor: G;
  private readonly props: Prop[] = [];
  private readonly player: Phaser.GameObjects.Sprite;
  private readonly stride = new StrideMeter();
  private readonly gait = new RoamGaitClock();
  private shadows = new Map<string, Map<string, ShadowSize>>();
  /** The Kindled on the holding: its sheathed sheet, no blade in hand outside combat. */
  readonly playerSheet: SpriteSheet = spriteSheets[PLAYER_SHEATHED_SHEET];
  /** The pose shown this frame (playtests). */
  pose: KindledPose | null = null;
  /** Sleep (M2 Task 7): the Kindled sits against the post facing `angle` (the `sit` row when the sheet has it, else `idle`), still. */
  sitting: { angle: number } | null = null;
  /** Old Kesh on his rock. */
  private readonly kesh: Phaser.GameObjects.Sprite;
  private readonly keshBounds: { x: number; y: number; w: number; h: number } | null;
  readonly keshSheet: SpriteSheet = spriteSheets[KESH_SHEET];
  private keshRow: KeshRow = 'fish';
  /** The row to go back to once a toss has played (`talk` while his line is open, else `fish`). */
  private keshRest: 'fish' | 'talk' = 'fish';
  /** While a toss plays: what to throw once the release frame shows (the server has answered), and whether it has. */
  private tossPending: (() => void) | null = null;
  private tossReleasedAt = false;
  private flight: Flight | null = null;
  private keshTop = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    readonly layout: HoldingLayout,
    private readonly anim: () => AnimTuning,
    private tone: ClayTone,
    private readonly keshTuning: () => KeshTuning,
  ) {
    this.floor = scene.add.graphics().setDepth(DEPTH.floor);
    layer.add(this.floor);
    this.tiles = new TileRoom(scene, layer, HOLDING_SHEET);
    const template = holdingTemplate(layout);
    this.tiles.build(template);
    const stand = (stationId: string | null, rect: TileRect, sheet: string): void => {
      const base = propBase({ rect });
      const image = scene.add
        .sprite(snapToArt(base.x), snapToArt(base.y), sheet, 'idle_0')
        .setDepth(bodyDepth({ kind: 'prop' }, base.y));
      // A prop whose idle has more frames plays it at its rate (the Writ post's tablet pulses, ART's holding art).
      const data = sheetData(sheet);
      if (data && propIdlePlays(data) && scene.anims.exists(animKey(sheet, 'idle')))
        image.play(animKey(sheet, 'idle'));
      layer.add(image);
      this.props.push({ stationId, rect, image, sheet, grounded: standsOnGround(template, rect) });
    };
    for (const station of layout.stations) {
      const kindSheet = STATION_SHEETS[station.kind];
      if (!kindSheet || station.reserved) continue;
      // A part may name its own sheet (the second tree); until that optional sheet is on disk, the kind's.
      for (const part of station.parts)
        stand(
          station.id,
          part.rect,
          part.sheet && scene.textures.exists(part.sheet) ? part.sheet : kindSheet,
        );
    }
    stand(null, layout.kesh.rock, KESH_ROCK_SHEET);
    // Kesh at the rock's world point, one depth step above it, no shadow (his clay is drawn in: no tone swap).
    const rockBase = propBase({ rect: layout.kesh.rock });
    this.kesh = scene.add
      .sprite(snapToArt(rockBase.x), snapToArt(rockBase.y), KESH_SHEET, 'fish_0')
      .setDepth(bodyDepth({ kind: 'prop' }, rockBase.y) + DEPTH.perPixel);
    layer.add(this.kesh);
    this.kesh.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.keshRow === 'toss') this.playKesh(this.keshRest);
    });
    this.playKesh('fish');
    this.keshTop = this.readKeshTop();
    this.keshBounds = this.readKeshBounds();
    this.player = scene.add.sprite(0, 0, this.playerTexture()).setVisible(false);
    layer.add(this.player);
  }

  /** The union of Kesh's opaque pixels over all his frames, relative to his cell origin (world px); null without pixels. */
  private readKeshBounds(): { x: number; y: number; w: number; h: number } | null {
    const img = texturePixels(this.scene, KESH_SHEET);
    if (!img) return null;
    const { origin } = this.keshSheet.meta;
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (const f of Object.values(this.keshSheet.frames)) {
      const b = opaqueBoundsIn(img, f.frame);
      if (!b) continue;
      box = box
        ? {
            x0: Math.min(box.x0, b.x),
            y0: Math.min(box.y0, b.y),
            x1: Math.max(box.x1, b.x + b.w),
            y1: Math.max(box.y1, b.y + b.h),
          }
        : { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
    }
    return box
      ? { x: box.x0 - origin.x, y: box.y0 - origin.y, w: box.x1 - box.x0, h: box.y1 - box.y0 }
      : null;
  }

  /** Kesh's drawn box in world px (his opaque pixels over every frame), for the HUD's dither: he is a body while he can be talked to. */
  keshBox(): { x: number; y: number; w: number; h: number } | null {
    const b = this.keshBounds;
    return b ? { x: this.kesh.x + b.x, y: this.kesh.y + b.y, w: b.w, h: b.h } : null;
  }

  /** How far above his world point Kesh's head is (the prompt stands there): the first opaque row of `fish_0`, else the cell's. */
  private readKeshTop(): number {
    const img = texturePixels(this.scene, KESH_SHEET);
    const f = this.keshSheet.frames.fish_0;
    const { origin, cell } = this.keshSheet.meta;
    if (!img || !f) return cell.h - origin.y;
    for (let y = 0; y < f.frame.h; y++)
      for (let x = 0; x < f.frame.w; x++)
        if ((img.data[((f.frame.y + y) * img.width + f.frame.x + x) * 4 + 3] ?? 0) > 0)
          return origin.y - y;
    return cell.h - origin.y;
  }

  private playKesh(row: KeshRow): void {
    const key = animKey(KESH_SHEET, row);
    this.keshRow = row;
    if (this.scene.anims.exists(key)) this.kesh.play(key);
    else this.kesh.setFrame(`${row}_0`);
  }

  /** Whether Kesh speaks (`talk` loops) or fishes while nothing is thrown; a toss in progress finishes first. */
  setKeshTalking(talking: boolean): void {
    this.keshRest = talking ? 'talk' : 'fish';
    if (this.keshRow !== 'toss' && this.keshRow !== this.keshRest) this.playKesh(this.keshRest);
  }

  /**
   * Kesh throws: `toss` plays once at its rate, then his rest row. The thrown
   * thing leaves his hand when the release frame shows: `release` is called
   * then (or at once if the frame has already passed), so the scene can
   * launch the flight once the server has answered.
   */
  toss(release: () => void): void {
    this.tossPending = release;
    this.tossReleasedAt = false;
    this.playKesh('toss');
  }

  /** Whether a toss is in the air or still in his hand. */
  get tossing(): boolean {
    return this.keshRow === 'toss' || this.flight !== null;
  }

  /** The clay tile's texture, made on first use: a `clayTile` face with a `clayTileEdge` 1 px rim and the player outline. */
  private clayTileTexture(): string | null {
    if (this.scene.textures.exists(CLAY_TILE_TEXTURE)) return CLAY_TILE_TEXTURE;
    const canvas = this.scene.textures.createCanvas(
      CLAY_TILE_TEXTURE,
      CLAY_TILE_W + 2,
      CLAY_TILE_H + 2,
    );
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return null;
    const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = hex(Palette.playerOutline);
    ctx.fillRect(0, 0, CLAY_TILE_W + 2, CLAY_TILE_H + 2);
    ctx.fillStyle = hex(Palette.clayTileEdge);
    ctx.fillRect(1, 1, CLAY_TILE_W, CLAY_TILE_H);
    ctx.fillStyle = hex(Palette.clayTile);
    ctx.fillRect(2, 2, CLAY_TILE_W - 2, CLAY_TILE_H - 2);
    canvas.refresh();
    return CLAY_TILE_TEXTURE;
  }

  /** The texture and frame a toss flies as, or null when the client lacks it (the flight is then skipped). */
  private tossTexture(kind: TossKind): { key: string; frame: string | undefined } | null {
    switch (kind) {
      case 'sliver':
        return optionalSheet(SPARKGLASS_SHEET) && this.scene.textures.exists(SPARKGLASS_SHEET)
          ? { key: SPARKGLASS_SHEET, frame: 'idle_0' }
          : null;
      case 'word': {
        const key = this.clayTileTexture();
        return key ? { key, frame: undefined } : null;
      }
      case 'seeds':
        return this.scene.textures.exists(ITEM_ICON_TEXTURE) &&
          this.scene.textures.get(ITEM_ICON_TEXTURE).has(SEEDS_ITEM)
          ? { key: ITEM_ICON_TEXTURE, frame: SEEDS_ITEM }
          : null;
    }
  }

  /**
   * Launches the thrown thing from the release frame's `hand` point to the
   * Kindled's feet (sim px) in the arc from tuning: a sliver from
   * `prop-sparkglass`'s `idle`, the clay tile from its placeholder texture,
   * the seeds from their 16 px item icon (M2 Task 5); `onLand` fires where it
   * lands. Without the texture the flight is skipped and `onLand` fires at
   * once.
   */
  launchToss(feet: { x: number; y: number }, onLand: () => void, kind: TossKind = 'sliver'): void {
    const from = tossReleasePoint(this.keshSheet, { x: this.kesh.x, y: this.kesh.y });
    const to = { x: snapToArt(feet.x), y: snapToArt(feet.y + PLAYER_FEET) };
    const texture = from ? this.tossTexture(kind) : null;
    if (!from || !texture) {
      onLand();
      return;
    }
    this.flight?.image.destroy();
    const image = this.scene.add
      .image(from.x, from.y, texture.key, texture.frame)
      .setDepth(DEPTH.fx);
    this.layer.add(image);
    this.flight = { image, kind, from, to, startMs: this.scene.time.now, onLand };
  }

  /** Where the prompt stands over Kesh (world px): above his head. */
  keshPrompt(): { x: number; y: number } {
    return { x: this.kesh.x, y: this.kesh.y - this.keshTop - 2 };
  }

  /** Kesh's row and frame this frame, and the thrown thing's place and kind while it flies (playtests). */
  keshState(): {
    row: KeshRow;
    frame: string;
    flight: { x: number; y: number; kind: TossKind } | null;
  } {
    return {
      row: this.keshRow,
      frame: this.kesh.frame.name,
      flight: this.flight
        ? { x: this.flight.image.x, y: this.flight.image.y, kind: this.flight.kind }
        : null,
    };
  }

  /** The release and the flight, each frame: the thing leaves the hand on the release frame, then flies for `tossMs`. */
  private updateToss(): void {
    if (
      this.keshRow === 'toss' &&
      !this.tossReleasedAt &&
      this.kesh.frame.name === tossReleaseFrame()
    ) {
      this.tossReleasedAt = true;
      const release = this.tossPending;
      this.tossPending = null;
      release?.();
    }
    const f = this.flight;
    if (!f) return;
    const { tossMs, tossArcPx } = this.keshTuning();
    const t = (this.scene.time.now - f.startMs) / Math.max(1, tossMs);
    const sheet = f.kind === 'sliver' ? optionalSheet(SPARKGLASS_SHEET) : undefined;
    if (sheet) f.image.setFrame(pickupFrameAt(sheet, this.scene.time.now));
    const p = tossPoint(f.from, f.to, t, tossArcPx);
    f.image.setPosition(p.x, p.y);
    if (t >= 1) {
      f.image.destroy();
      this.flight = null;
      f.onLand();
    }
  }

  /** Whether the toss has released (the thing is in the air or the frame passed) while a toss plays; the scene launches on the server's answer. */
  get tossReleased(): boolean {
    return this.tossReleasedAt;
  }

  private playerTexture(): string {
    return toneTextureKey(this.scene, PLAYER_SHEATHED_SHEET, this.tone);
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
      const def = sheetData(sheet);
      if (img && def) {
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
    const part =
      station && near ? nearestPart(station, near.x, near.y) : (station?.parts[0] ?? null);
    const p = this.props.find((x) => x.stationId === stationId && (!part || x.rect === part.rect));
    if (!p) return null;
    return { x: p.image.x, y: p.image.y - p.image.height + 10 };
  }

  /** Every prop's sheet and frame, in layout order, Kesh's rock last (playtests). */
  propFrames(): {
    stationId: string | null;
    sheet: string;
    frame: string;
    x: number;
    y: number;
    depth: number;
  }[] {
    return this.props.map((p) => ({
      stationId: p.stationId,
      sheet: p.sheet,
      frame: p.image.frame.name,
      x: p.image.x,
      y: p.image.y,
      depth: p.image.depth,
    }));
  }

  /** The Kindled's depth this frame (playtests: behind a tree's canopy when its feet are north of the tree's base). */
  playerDepth(): number {
    return this.player.depth;
  }

  /** Poses the Kindled at its interpolated position (sim px) from the roam state, draws the shadows, and runs Kesh's toss. */
  draw(s: RoamState, player: { x: number; y: number }): void {
    this.updateToss();
    this.floor.clear();
    for (const { rect, image, sheet, grounded } of this.props) {
      if (!grounded) continue;
      const sh = this.propShadow(sheet, image.frame.name);
      const base = propBase({ rect });
      if (sh.w > 0) this.shadowAt(snapToArt(base.x), snapToArt(base.y), sh.w, sh.h);
    }
    this.shadowAt(snapToArt(player.x), snapToArt(player.y + PLAYER_FEET), SHADOW_W, SHADOW_H);
    const distancePx = this.stride.step(player.x, player.y);
    const pose = this.sitting
      ? sitPose(this.playerSheet, this.sitting.angle)
      : roamPose(s, this.playerSheet, this.gait.update(s), { distancePx, cycles: this.anim() });
    this.pose = pose;
    const frame =
      this.playerSheet.anims[pose.anim]?.frames[pose.frame] ??
      this.playerSheet.anims[pose.anim]?.frames[0] ??
      '';
    const texture = this.playerTexture();
    if (this.player.texture.key !== texture || this.player.frame.name !== frame)
      this.player.setTexture(texture, frame);
    this.player
      .setPosition(snapToArt(player.x), snapToArt(player.y + PLAYER_FEET))
      .setVisible(true)
      .setDepth(bodyDepth({ kind: 'kindled' }, player.y));
  }
}

/**
 * The sleep pose (M2 Task 7): `sit` when the sheet has the row (2 facings, S
 * or E, by the angle to the post), frame 0, held. Without the row the
 * stand-in is `idle_S`: the Kindled sits with its back to the post (ART,
 * 2026-10-19), so it faces the player, never the post, and nothing turns
 * round when the row lands.
 */
export function sitPose(sheet: SpriteSheet, angle: number): KindledPose {
  const FACING_S_ANGLE = TURN / 4; // The sim's angle: clockwise from east, screen y down, so a quarter turn faces south.
  if (SPRITE_FACINGS.some((f) => `sit_${f}` in sheet.anims)) {
    const facing = sheetFacing(sheet, 'sit', angle);
    return { name: 'sit', facing, anim: `sit_${facing}`, frame: 0 };
  }
  const facing = sheetFacing(sheet, 'idle', FACING_S_ANGLE);
  return { name: 'idle', facing, anim: `idle_${facing}`, frame: 0 };
}
