import type Phaser from 'phaser';
import {
  CAVE_TILE_SHEET,
  caveTileSheet,
  HOLDING_TILE_SHEET,
  holdingTileSheet,
  DOOR_STATES,
  doorAnimKey,
  doorFrameName,
  roomTiles,
  TILE_WORLD_PX,
  type DoorPiece,
  type TileDoor,
  type TileSheet,
  type TileTemplate,
} from '@iot/shared';
import { DEPTH } from './depth.js';
import { nextOpenView, openingStateAt, type OpenView } from './opening.js';
import { spritePngUrl } from './spriteSheets.js';

/**
 * The room drawn from the tile sheet (docs/design/sprites.md "Tiles", G1.5e):
 * the static pieces `tileAt` picks, drawn once per room into a texture under
 * everything, and the doors as images over it, animated on the client clock
 * from the state's `doorOpen` (the client only renders it). A cell (c, r) is
 * at world (c × 32, r × 32), no piece scaled (`pixelScale` 1).
 *
 * The sheet is ART's `tiles-cave` (`caveTileSheet`, bundled with the code like
 * the sprite sheets); its PNG loads like theirs (`preloadTileSheet`), and a
 * missing PNG is the same error as a missing sprite sheet's. There is no other
 * room: M1's procedural room went in G1.5g.
 */

/** The tile sheet the room draws from: its texture key and its JSON contract. */
export const TILE_SHEET: { key: string; sheet: TileSheet } = { key: CAVE_TILE_SHEET, sheet: caveTileSheet };

/** The holding's tile sheet (M2 Task 3b): MAIN's placeholder `tiles-holding` until ART draws it; the same rule draws it. */
export const HOLDING_SHEET: { key: string; sheet: TileSheet } = { key: HOLDING_TILE_SHEET, sheet: holdingTileSheet };

/** Loads a tile sheet as an atlas (its JSON is bundled with the code); the PNG must be next to it. The cave's by default. */
export function preloadTileSheet(scene: Phaser.Scene, active: { key: string; sheet: TileSheet } = TILE_SHEET): void {
  const { key, sheet } = active;
  if (scene.textures.exists(key)) return;
  const url = spritePngUrl(sheet.meta.image);
  if (!url) throw new Error(`no PNG for the ${key} sheet`);
  scene.load.atlas(key, url, sheet);
}

/** One static piece to draw into the room texture: its frame and its top left in world px. */
export interface TileFrameDraw {
  frame: string;
  x: number;
  y: number;
}

/** The room texture's size in world px: the room's cells at 32 each (never 0, so the texture exists). */
export function roomTextureSize(template: TileTemplate): { w: number; h: number } {
  const cols = template.tiles.reduce((m, r) => Math.max(m, r.length), 0);
  return { w: Math.max(1, cols * TILE_WORLD_PX), h: Math.max(1, template.tiles.length * TILE_WORLD_PX) };
}

/** A room as frames of a tile sheet: every static piece (base, then overlays, row-major) and the doors. */
export function roomTileFrames(
  template: TileTemplate,
  sheet: TileSheet,
): { pieces: TileFrameDraw[]; doors: TileDoor[] } {
  const { draws, doors } = roomTiles(template, sheet.tiles);
  return {
    pieces: draws.map((d) => ({ frame: d.piece, x: d.col * TILE_WORLD_PX, y: d.row * TILE_WORLD_PX })),
    doors,
  };
}

/** What the client has seen of a room's door (opening.ts): open or not, and since when it has been opening (null: open at load). */
export type DoorView = OpenView;

/**
 * The door's view after this frame's `doorOpen`: a room that loads with the
 * door open shows it open (`prev` null); `doorOpen` turning true starts the
 * opening at `timeMs`; turning false closes it. The chest shares it (opening.ts).
 */
export const nextDoorView: (prev: DoorView | null, doorOpen: boolean, timeMs: number) => DoorView = nextOpenView;

/**
 * The door's frame: `<door>_closed_0` while shut; `<door>_opening_<k>`, played
 * once at the sheet's rate from when it turned open; then `<door>_open_0`, held
 * (also for a door that was open when the room loaded).
 */
export function doorFrameAt(sheet: TileSheet, door: DoorPiece, view: DoorView, timeMs: number): string {
  const opening = DOOR_STATES.find((s) => s.state === 'opening');
  const anim = sheet.anims[doorAnimKey(door, 'opening')];
  const state = openingStateAt(
    view,
    { frames: anim?.frames.length ?? opening?.frames ?? 0, fps: anim?.frameRate ?? opening?.fps ?? 1 },
    timeMs,
  );
  if (state.state === 'closed') return doorFrameName(door, 'closed', 0);
  if (state.state === 'opening') return doorFrameName(door, 'opening', state.n);
  return doorFrameName(door, 'open', 0);
}

/**
 * A RenderTexture's texture is a DynamicTexture (Phaser types it as a plain
 * Texture): its WebGL render target, null on the Canvas renderer.
 */
function renderTargetOf(texture: Phaser.Textures.Texture): Phaser.Renderer.WebGL.RenderTarget | null {
  const dynamic: { renderTarget?: Phaser.Renderer.WebGL.RenderTarget | null } = texture as object;
  return dynamic.renderTarget ?? null;
}

/**
 * The tile room in the scene: one RenderTexture of the room's static pieces,
 * made anew at the room's size when the room changes, and an image per door,
 * its frame set every render frame from `doorOpen`. All at `DEPTH.room`,
 * under the floor decals.
 */
export class TileRoom {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private doors: { door: TileDoor; image: Phaser.GameObjects.Image; view: DoorView | null }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly active: { key: string; sheet: TileSheet } = TILE_SHEET,
  ) {}

  /** Draws a new room: its static pieces into the texture, its doors as images. */
  build(template: TileTemplate): void {
    const { key, sheet } = this.active;
    const { w, h } = roomTextureSize(template);
    // A new texture per room, the old one destroyed (G1.5i). Phaser's
    // RenderTexture.resize grows the frame and the drawing camera but not the
    // WebGL render target behind them (the DynamicTexture creates it without
    // autoResize), so a room larger than the first in either direction was
    // cut off at the first room's size. Destroying the old texture also frees
    // its GPU texture and framebuffer (DynamicTexture.destroy → RenderTarget.destroy).
    this.rt?.destroy();
    const rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(DEPTH.room);
    this.layer.add(rt);
    this.rt = rt;
    const { pieces, doors } = roomTileFrames(template, sheet);
    rt.beginDraw();
    for (const p of pieces) rt.batchDrawFrame(key, p.frame, p.x, p.y);
    rt.endDraw();
    for (const d of this.doors) d.image.destroy();
    this.doors = doors.map((door) => {
      const image = this.scene.add
        .image(door.col * TILE_WORLD_PX, door.row * TILE_WORLD_PX, key, doorFrameName(door.piece, 'closed', 0))
        .setOrigin(0, 0)
        .setDepth(DEPTH.roomDoors);
      this.layer.add(image);
      return { door, image, view: null };
    });
  }

  /** Sets each door's frame from the state's `doorOpen` on the client clock. */
  update(doorOpen: boolean, timeMs: number): void {
    for (const d of this.doors) {
      d.view = nextDoorView(d.view, doorOpen, timeMs);
      const frame = doorFrameAt(this.active.sheet, d.door.piece, d.view, timeMs);
      if (d.image.frame.name !== frame) d.image.setFrame(frame);
    }
  }

  /**
   * The room texture's size in world px, and its GPU render target's (null on
   * the Canvas renderer): playtests check both match the room after a room
   * change (tools/screenshots-g15.mjs --room-changes).
   */
  textureSize(): { w: number; h: number; target: { w: number; h: number } | null } | null {
    const rt = this.rt;
    if (!rt) return null;
    const target = renderTargetOf(rt.texture);
    return { w: rt.width, h: rt.height, target: target ? { w: target.width, h: target.height } : null };
  }

  /** Each door's frame this render frame, in room order (playtests). */
  doorFrames(): string[] {
    return this.doors.map((d) => d.image.frame.name);
  }

  /**
   * The whole room at 1× as a PNG data URL: the static pieces and each door
   * in its current frame (screenshots: tools/screenshots-g15.mjs --rooms).
   */
  snapshot(): Promise<string | null> {
    const rt = this.rt;
    if (!rt) return Promise.resolve(null);
    const shot = this.scene.make.renderTexture({ x: 0, y: 0, width: rt.width, height: rt.height }, false);
    shot.draw(rt, 0, 0);
    for (const d of this.doors) shot.draw(d.image);
    return new Promise((resolve) => {
      shot.snapshot((img) => {
        shot.destroy();
        resolve(img instanceof HTMLImageElement ? img.src : null);
      });
    });
  }
}
