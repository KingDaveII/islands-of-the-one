import type Phaser from 'phaser';
import {
  CAVE_TILE_SHEET,
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
 * The room drawn from a tile sheet (docs/design/sprites.md "Tiles", G1.5e):
 * the static pieces `tileAt` picks, drawn once per room into a texture under
 * everything, and the doors as images over it, animated on the client clock
 * from the state's `doorOpen` (the client only renders it). A cell (c, r) is
 * at world (c × 32, r × 32), no piece scaled (`pixelScale` 1).
 *
 * The sheet is ART's `tiles-cave` (packages/shared/assets/sprites). Until it
 * lands, `activeTileSheet` is null and the world draws M1's procedural room,
 * the fallback (world.ts), unless a playtest hands in a sheet (`setTileSheet`;
 * the G1.5e screenshots use the test fixture).
 */

/** A tile sheet the client can draw from: its texture key, its JSON contract and its PNG's URL. */
export interface ActiveTileSheet {
  key: string;
  sheet: TileSheet;
  url: string;
}

/** Tile sheets on disk, by file name: empty until ART's tiles-cave lands. */
const TILE_JSON: Record<string, TileSheet> = Object.fromEntries(
  Object.entries(
    import.meta.glob<TileSheet>('../../../../packages/shared/assets/sprites/tiles-*.json', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, sheet]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), sheet]),
);

/** A sheet a playtest hands in (`setTileSheet`): the G1.5e screenshots draw rooms from the test fixture this way. */
let override: ActiveTileSheet | null = null;

/**
 * The tile sheet the room draws from: ART's tiles-cave when it is on disk,
 * else one a playtest set (`setTileSheet`), else null (the procedural fallback).
 */
export function activeTileSheet(): ActiveTileSheet | null {
  const cave = TILE_JSON[CAVE_TILE_SHEET];
  const url = cave ? spritePngUrl(cave.meta.image) : undefined;
  if (cave && url) return { key: CAVE_TILE_SHEET, sheet: cave, url };
  return override;
}

/**
 * Playtests and screenshots: draw rooms from this sheet while ART's
 * tiles-cave is not on disk (`window.__iot.useTileSheet`, which
 * tools/screenshots-g15.mjs --rooms calls with the test fixture); null
 * clears it. Takes effect from the next run.
 */
export function setTileSheet(sheet: ActiveTileSheet | null): void {
  override = sheet;
}

/** Which room the world draws: from the tile sheet when one is loaded, else the procedural fallback. */
export function roomRenderer(texturesHave: (key: string) => boolean): 'tiles' | 'procedural' {
  const active = activeTileSheet();
  return active && texturesHave(active.key) ? 'tiles' : 'procedural';
}

/** Loads the active tile sheet as an atlas (its JSON is bundled with the code); nothing without one. */
export function preloadTileSheet(scene: Phaser.Scene): void {
  const active = activeTileSheet();
  if (active && !scene.textures.exists(active.key)) scene.load.atlas(active.key, active.url, active.sheet);
}

/** One static piece to draw into the room texture: its frame and its top left in world px. */
export interface TileFrameDraw {
  frame: string;
  x: number;
  y: number;
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
 * The tile room in the scene: one RenderTexture of the room's static pieces,
 * redrawn when the room changes, and an image per door, its frame set every
 * render frame from `doorOpen`. All at `DEPTH.room`, under the floor decals.
 */
export class TileRoom {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private doors: { door: TileDoor; image: Phaser.GameObjects.Image; view: DoorView | null }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly active: ActiveTileSheet,
  ) {}

  /** Draws a new room: its static pieces into the texture, its doors as images. */
  build(template: TileTemplate): void {
    const { key, sheet } = this.active;
    const cols = template.tiles.reduce((m, r) => Math.max(m, r.length), 0);
    const w = Math.max(1, cols * TILE_WORLD_PX);
    const h = Math.max(1, template.tiles.length * TILE_WORLD_PX);
    if (!this.rt) {
      this.rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(DEPTH.room);
      this.layer.add(this.rt);
    } else this.rt.resize(w, h);
    const rt = this.rt;
    rt.clear();
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
