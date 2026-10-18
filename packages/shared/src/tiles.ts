import tilesCave from '../assets/sprites/tiles-cave.json' with { type: 'json' };
import tilesHolding from '../assets/sprites/tiles-holding.json' with { type: 'json' };
import type { AtlasFrame, SpriteAnim, SpriteAnimSpec } from './sprites.js';

/**
 * Room tiles (docs/design/sprites.md "Tiles", G1.5e): a `tiles-<set>` sheet of
 * named 32×32 world px pieces, chosen per room cell by a 4-neighbour rule,
 * each piece sitting exactly on one of the sim's 16 sim px cells. ART's design:
 * not a 16-tile corner set, which can't draw a wall's front face and whose
 * transitions would straddle the sim's collision edges on a dual grid.
 *
 * The rule (`tileAt`) is a pure function with no runtime dependencies, so the
 * engine (apps/client) and the art pipeline's review (`rooms.png`) both use it
 * and always agree. The sheet's own numbers (`floorWeights`, `faceMidWeights`,
 * `topMidWeights`, `dropMidWeights`) live in its JSON, with its `rule` and
 * whether it carries `doors` (M2 Task 3c, ART 2026-10-18).
 *
 * Two rules (`TileRule`), one per kind of place:
 * - **cave** (G1.5e): walls rising from the floor. A solid cell with open
 *   ground to its south is a wall face; shades fall on the floor beside walls.
 * - **shore** (M2 Task 3c): an island seen at a low ¾ angle, its edge dropping
 *   into the Hollow. Ground draws floors with lips where the void is beside
 *   it; the void cell under a ground cell draws the drop, the cliff hanging
 *   below the island; every other void cell draws nothing.
 */

/** A room as the rule reads it: a template of rooms.json, its name and its rows. */
export interface TileTemplate {
  name: string;
  tiles: readonly string[];
}

/** World px per tile: a 16 sim px cell at the 2× world (sprites.md §2). Pieces draw at 1 world px per sheet px. */
export const TILE_WORLD_PX = 32;

/** Every tile sheet's name starts with this (`spriteSheetSpec` gives it the kind `tiles`). */
export const TILE_SHEET_PREFIX = 'tiles-';

/** The cave set, the first tile sheet (ART's `tiles-cave`). */
export const CAVE_TILE_SHEET = 'tiles-cave';

/** The holding's set (M2 Task 3b): MAIN's placeholder through the pipeline until ART draws it; a shore set without doors (3c). */
export const HOLDING_TILE_SHEET = 'tiles-holding';

/** The rules a tile set can declare in its `tiles` block (`rule`); absent means `cave`. */
export const TILE_RULES = ['cave', 'shore'] as const;
export type TileRule = (typeof TILE_RULES)[number];
export const TILE_RULE_DEFAULT: TileRule = 'cave';

/** Whether a value is a rule's name. */
export function isTileRule(v: unknown): v is TileRule {
  return typeof v === 'string' && (TILE_RULES as readonly string[]).includes(v);
}

/** What a set carries, read from its `tiles` block: its rule and whether it has door pieces. */
export interface TileSetSpec {
  rule: TileRule;
  doors: boolean;
}

/** The set every sheet was before 3c: the cave rule with doors (`tiles-cave`). */
export const TILE_SET_DEFAULT: TileSetSpec = { rule: 'cave', doors: true };

/** The set a `tiles` block (or a recipe) declares: an unknown rule reads as the default, so callers check `isTileRule` themselves. */
export function tileSetOf(tiles: { rule?: unknown; doors?: unknown } | undefined): TileSetSpec {
  return {
    rule: isTileRule(tiles?.rule) ? tiles.rule : TILE_RULE_DEFAULT,
    doors: tiles?.doors === false ? false : TILE_SET_DEFAULT.doors,
  };
}

/** The open sides of a wall cell, in the order its piece names them: n, w, e. */
export const TILE_SIDES = ['n', 'w', 'e'] as const;
export type TileSide = (typeof TILE_SIDES)[number];

/** Every non-empty set of open sides as it appears in a name, in n-w-e order. */
const SIDE_SETS = ['n', 'w', 'e', 'nw', 'ne', 'we', 'nwe'] as const;

export const FLOOR_PIECES = ['floor_0', 'floor_1', 'floor_2', 'floor_3'] as const;
/** Overlays on a floor cell, in the order they stack. */
export const SHADE_PIECES = ['shade_n', 'shade_w', 'shade_e', 'shade_nw', 'shade_ne'] as const;
/** A wall cell whose S neighbour is open: the bottom 24 px is the face, the top 8 px the cap. */
export const FACE_PIECES = [...SIDE_SETS.map((s) => `face_${s}` as const), 'face_mid_0', 'face_mid_1'] as const;
/** A wall cell whose S neighbour is solid. `top_mid_1` is the spare plain top for thick masses. */
export const TOP_PIECES = [...SIDE_SETS.map((s) => `top_${s}` as const), 'top_mid_0', 'top_mid_1'] as const;
/** Overlays on a top cell, in the order they stack. */
export const CORNER_PIECES = ['corner_nw', 'corner_ne'] as const;

/**
 * The shore rule's drops (ART 2026-10-18): a void cell with ground directly
 * north draws the cliff hanging below the island into the Hollow. `drop_mid_0`
 * / `drop_mid_1` where both neighbours are drops too (by the hash, weighted
 * by `dropMidWeights`); `drop_w` where the cliff ends on its west side,
 * `drop_e` on its east, `drop_we` when both ends do (a one-cell drop). The
 * outer corners: `drop_corner_w` on the void cell west of a run's west end,
 * with ground at NE and no ground north (the cliff turning round the corner
 * west of the run), `drop_corner_e` east of a run's east end, with ground at
 * NW.
 */
export const DROP_PIECES = ['drop_mid_0', 'drop_mid_1', 'drop_w', 'drop_e', 'drop_we', 'drop_corner_w', 'drop_corner_e'] as const;
/**
 * The shore rule's lips: overlays on a ground cell beside the void, which
 * stack in this order. Each is the outline and a lit rim, with no face:
 * `lip_n` where the void is north (the island's back edge, which simply
 * ends), `lip_w` / `lip_e` where it is west or east, `lip_nw` (`lip_ne`)
 * where NW (NE) is void while N and W (E) are ground, an inner corner. No
 * south lip: the drop below covers it.
 */
export const LIP_PIECES = ['lip_n', 'lip_w', 'lip_e', 'lip_nw', 'lip_ne'] as const;

export type FloorPiece = (typeof FLOOR_PIECES)[number];
export type ShadePiece = (typeof SHADE_PIECES)[number];
export type FacePiece = (typeof FACE_PIECES)[number];
export type TopPiece = (typeof TOP_PIECES)[number];
export type CornerPiece = (typeof CORNER_PIECES)[number];
export type DropPiece = (typeof DROP_PIECES)[number];
export type LipPiece = (typeof LIP_PIECES)[number];
/** A static (one-frame) piece: its frame in the sheet has the same name. */
export type StaticTilePiece = FloorPiece | ShadePiece | FacePiece | TopPiece | CornerPiece | DropPiece | LipPiece;

/**
 * How much of a piece must be opaque: `full`, every pixel (floors, faces,
 * tops, door frames); `top`, its top row (a drop: opaque where it meets the
 * floor above, while its dither into hollow-deep may end in transparent
 * rows); `none`, an overlay (shades, corners, lips) or an outer corner drop
 * (void to its north).
 */
export type TileOpacity = 'full' | 'top' | 'none';

/** One static piece: its size in sheet px (= world px) and how much of it must be opaque. */
export interface StaticTilePieceSpec {
  name: StaticTilePiece;
  w: number;
  h: number;
  /** Whether every pixel must be opaque (`opacity` is `full`). */
  opaque: boolean;
  opacity: TileOpacity;
}

const piece = (name: StaticTilePiece, opacity: TileOpacity): StaticTilePieceSpec => ({
  name,
  w: TILE_WORLD_PX,
  h: TILE_WORLD_PX,
  opaque: opacity === 'full',
  opacity,
});

/** The cave rule's static pieces, in sheet order: floors, shades, faces, tops, corners. */
export const CAVE_STATIC_PIECES: readonly StaticTilePieceSpec[] = [
  ...FLOOR_PIECES.map((p) => piece(p, 'full')),
  ...SHADE_PIECES.map((p) => piece(p, 'none')),
  ...FACE_PIECES.map((p) => piece(p, 'full')),
  ...TOP_PIECES.map((p) => piece(p, 'full')),
  ...CORNER_PIECES.map((p) => piece(p, 'none')),
];

/**
 * The shore rule's static pieces, in sheet order: floors (fully opaque), drops
 * (opaque in their top row, where they meet the floor above; the outer
 * corners have void to their north, so they may be transparent anywhere) and
 * lips (overlays).
 */
export const SHORE_STATIC_PIECES: readonly StaticTilePieceSpec[] = [
  ...FLOOR_PIECES.map((p) => piece(p, 'full')),
  ...DROP_PIECES.map((p) => piece(p, p.startsWith('drop_corner') ? 'none' : 'top')),
  ...LIP_PIECES.map((p) => piece(p, 'none')),
];

/** The static pieces a finished sheet of a rule carries, in sheet order. */
export function staticTilePieces(rule: TileRule): readonly StaticTilePieceSpec[] {
  return rule === 'shore' ? SHORE_STATIC_PIECES : CAVE_STATIC_PIECES;
}

/** Every static piece a finished cave sheet carries, in sheet order (the set before 3c). */
export const STATIC_TILE_PIECES: readonly StaticTilePieceSpec[] = CAVE_STATIC_PIECES;

/** Every static piece of either rule, by name. */
const ANY_STATIC_PIECE: ReadonlyMap<string, StaticTilePieceSpec> = new Map(
  [...CAVE_STATIC_PIECES, ...SHORE_STATIC_PIECES].map((p) => [p.name, p]),
);

/** The spec of a static piece of either rule, or undefined for a name that is none. */
export function staticTilePiece(name: string): StaticTilePieceSpec | undefined {
  return ANY_STATIC_PIECE.get(name);
}

/**
 * The doors, by the wall their two `D` cells sit in: `door_n` covers a
 * horizontal `DD` in the north wall (64×32), `door_w` and `door_e` a vertical
 * one in the west or east wall (32×64). No template has a south door.
 */
export const DOOR_PIECES = [
  { name: 'door_n', w: 2 * TILE_WORLD_PX, h: TILE_WORLD_PX, cols: 2, rows: 1 },
  { name: 'door_w', w: TILE_WORLD_PX, h: 2 * TILE_WORLD_PX, cols: 1, rows: 2 },
  { name: 'door_e', w: TILE_WORLD_PX, h: 2 * TILE_WORLD_PX, cols: 1, rows: 2 },
] as const;
export type DoorPiece = (typeof DOOR_PIECES)[number]['name'];

/**
 * A door's three animations: `closed` (1 frame), `opening` (6 frames, played
 * once when the client sees `doorOpen` turn true, at 12 fps; ART may ask to
 * change it) and `open` (1 frame, held). The open frame draws the passage
 * floor itself.
 */
export const DOOR_STATES = [
  { state: 'closed', frames: 1, fps: 0 },
  { state: 'opening', frames: 6, fps: 12 },
  { state: 'open', frames: 1, fps: 0 },
] as const;
export type DoorState = (typeof DOOR_STATES)[number]['state'];

/** A door animation's key in the sheet's `anims`: `door_n_opening`. */
export function doorAnimKey(door: DoorPiece, state: DoorState): string {
  return `${door}_${state}`;
}

/** A frame of a door animation: `door_n_opening_3`. */
export function doorFrameName(door: DoorPiece, state: DoorState, n: number): string {
  return `${doorAnimKey(door, state)}_${n}`;
}

/** The door animations as table rows (the sprite contract's shape): once, holding the last frame. */
export const TILE_DOOR_ANIMS: readonly SpriteAnimSpec[] = DOOR_PIECES.flatMap((d) =>
  DOOR_STATES.map((s) => ({
    name: doorAnimKey(d.name, s.state),
    frames: s.frames,
    fps: s.fps,
    loop: false,
    hold: true,
    facings: [],
    milestone: 'M1' as const,
  })),
);

/** The door animations a set carries: every door's for a set with doors, none for a doorless one. */
export function tileDoorAnimsFor(set: TileSetSpec): readonly SpriteAnimSpec[] {
  return set.doors ? TILE_DOOR_ANIMS : [];
}

/** One frame a finished tile sheet carries: a static piece or a door animation's frame. */
export interface TileFrameSpec {
  name: string;
  w: number;
  h: number;
  /** Whether every pixel must be opaque (`opacity` is `full`). */
  opaque: boolean;
  opacity: TileOpacity;
  /** The piece (a door's animation key for a door frame) and the frame's index in it. */
  piece: string;
  n: number;
}

/** Every frame of a finished sheet of a set, in sheet order: the rule's static pieces, then each door's frames when it has doors. */
export function tileFramesFor(set: TileSetSpec): readonly TileFrameSpec[] {
  return [
    ...staticTilePieces(set.rule).map((p) => ({ name: p.name, w: p.w, h: p.h, opaque: p.opaque, opacity: p.opacity, piece: p.name, n: 0 })),
    ...(set.doors
      ? DOOR_PIECES.flatMap((d) =>
          DOOR_STATES.flatMap((s) =>
            Array.from({ length: s.frames }, (_, n) => ({
              name: doorFrameName(d.name, s.state, n),
              w: d.w,
              h: d.h,
              opaque: true,
              opacity: 'full' as const,
              piece: doorAnimKey(d.name, s.state),
              n,
            })),
          ),
        )
      : []),
  ];
}

/** Every frame of a finished cave sheet with doors, in sheet order (the set before 3c). */
export const TILE_FRAMES: readonly TileFrameSpec[] = tileFramesFor(TILE_SET_DEFAULT);

/** One piece a tile recipe lists: a static piece (one frame) or a door animation (its frames). */
export interface TileRecipePieceSpec {
  name: string;
  w: number;
  h: number;
  /** The count a finished sheet carries. */
  frames: number;
  opaque: boolean;
  opacity: TileOpacity;
}

/**
 * The pieces a tile recipe of a set lists (docs/design/art-pipeline.md
 * "pieces"): the rule's static pieces, one frame each, and, with doors, every
 * door animation, its frames in order. Keyed by name.
 */
export function tileRecipePiecesFor(set: TileSetSpec): readonly TileRecipePieceSpec[] {
  return [
    ...staticTilePieces(set.rule).map((p) => ({ name: p.name, w: p.w, h: p.h, frames: 1, opaque: p.opaque, opacity: p.opacity })),
    ...(set.doors
      ? DOOR_PIECES.flatMap((d) =>
          DOOR_STATES.map((s) => ({
            name: doorAnimKey(d.name, s.state),
            w: d.w,
            h: d.h,
            frames: s.frames,
            opaque: true,
            opacity: 'full' as const,
          })),
        )
      : []),
  ];
}

/** The pieces a cave recipe with doors lists (the set before 3c). */
export const TILE_RECIPE_PIECES: readonly TileRecipePieceSpec[] = tileRecipePiecesFor(TILE_SET_DEFAULT);

/** Whether a name is a door animation's (`door_n_opening`) or a door frame's (`door_n_opening_3`). */
export function isDoorPieceName(name: string): boolean {
  return DOOR_PIECES.some((d) => name === d.name || name.startsWith(`${d.name}_`));
}

/**
 * The weights the picks read (G1.5f): `floorWeights` for `floor_0` … `floor_3`
 * (four positive integers), `faceMidWeights` for `face_mid_0` / `face_mid_1`,
 * `topMidWeights` for `top_mid_0` / `top_mid_1` and, on a shore set,
 * `dropMidWeights` for `drop_mid_0` / `drop_mid_1` (two positive integers
 * each; absent means `MID_WEIGHTS_DEFAULT`, an even pick), with the set's
 * `rule` (absent: cave) and `doors` (absent: true). A sheet's `tiles` block
 * is one, so `tileAt(template, col, row, sheet.tiles)`.
 */
export interface TileWeights {
  floorWeights: readonly number[];
  faceMidWeights?: readonly number[];
  topMidWeights?: readonly number[];
  dropMidWeights?: readonly number[];
  /** `cave` or `shore` (`TileRule`); typed loosely because it is read from JSON, and `tileRuleOf` resolves it. */
  rule?: string;
  doors?: boolean;
}

/** The plain-wall weights when a sheet gives none: `*_mid_0` and `*_mid_1` as often as each other. */
export const MID_WEIGHTS_DEFAULT: readonly number[] = [1, 1];

/** The rule a weights block (a sheet's `tiles`) draws by: its `rule`, or the cave's. */
export function tileRuleOf(weights: Pick<TileWeights, 'rule'>): TileRule {
  return tileSetOf(weights).rule;
}

/** The sheet's own block: its tile size, the weights (`TileWeights`), its rule and whether it has doors. */
export interface TileSheetTiles {
  tileSize: number;
  floorWeights: number[];
  faceMidWeights?: number[];
  topMidWeights?: number[];
  dropMidWeights?: number[];
  /** `cave` (absent) or `shore`. */
  rule?: string;
  /** Whether the sheet carries door pieces; absent means true. */
  doors?: boolean;
}

export interface TileSheetMeta {
  image: string;
  size: { w: number; h: number };
  scale: string;
  format: string;
  app: string;
  /** "2": option B's art. */
  version: string;
  /** World px per sheet px: 1. */
  pixelScale: number;
}

/**
 * A tile sheet (`tiles-<set>.png` + `.json` in packages/shared/assets/sprites):
 * named frames in the Phaser JSON Hash shape of the other sheets, door
 * animations under `anims`, and the `tiles` block.
 */
export interface TileSheet {
  frames: Record<string, AtlasFrame>;
  meta: TileSheetMeta;
  anims: Record<string, SpriteAnim>;
  tiles: TileSheetTiles;
}

/**
 * The cave set's sheet (ART's `tiles-cave`, packages/shared/assets/sprites),
 * the one the client draws every room from, bundled with the code like the
 * sprite sheets (`spriteSheets`); its PNG loads as the atlas's image.
 */
export const caveTileSheet: TileSheet = tilesCave;

/** The holding's sheet (`tiles-holding`), the one the holding scene draws its ground and edge from, bundled like the cave's. */
export const holdingTileSheet: TileSheet = tilesHolding;

/** Whether a sheet name is a tile sheet's (`tiles-<set>`). */
export function isTileSheetName(name: string): boolean {
  return name.startsWith(TILE_SHEET_PREFIX) && name.length > TILE_SHEET_PREFIX.length;
}

/**
 * The cell hash the floors and the plain walls pick their variant by: an
 * integer hash of (template name, col, row, salt), FNV-1a over the name, then
 * each number, then a 32-bit finaliser. No `Math.random`, so a room always
 * looks the same and screenshots are stable.
 */
export function tileHash(name: string, col: number, row: number, salt = 0): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  for (const v of [col, row, salt]) h = Math.imul(h ^ (v | 0), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The salts of the picks, so a floor's pick and a wall's (or a drop's) never share bits. */
const SALT = { floor: 0, face: 1, top: 2, drop: 3 } as const;

/** Index into `weights` for a hash: `hash mod total` through the running sums. Weights are positive integers. */
export function pickWeighted(hash: number, weights: readonly number[]): number {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return 0;
  let r = hash % total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Whether `v` is `n` positive integers. */
function isWeights(v: unknown, n: number): v is number[] {
  return Array.isArray(v) && v.length === n && v.every((w) => typeof w === 'number' && Number.isInteger(w) && w > 0);
}

/** Whether a `floorWeights` value is valid: four positive integers. */
export function isFloorWeights(v: unknown): v is number[] {
  return isWeights(v, FLOOR_PIECES.length);
}

/** Whether a `faceMidWeights` or `topMidWeights` value is valid: two positive integers. */
export function isMidWeights(v: unknown): v is number[] {
  return isWeights(v, 2);
}

/** The template's width in cells: its longest row (shorter rows are wall past their end, as in the sim). */
export function templateCols(template: TileTemplate): number {
  return template.tiles.reduce((m, r) => Math.max(m, r.length), 0);
}

/** The legend character at a cell; `#` past a row's end or outside the room. */
function charAt(template: TileTemplate, col: number, row: number): string {
  if (row < 0 || col < 0 || row >= template.tiles.length || col >= templateCols(template)) return '#';
  return template.tiles[row]?.[col] ?? '#';
}

/**
 * Whether a cell is solid for its neighbours: `#`, `o` and `D` (a door counts
 * as wall; it draws its own piece) and every cell outside the room. Everything
 * else (`.`, `P`, `S`, `C`) is open and draws as plain floor.
 */
export function isSolidTile(template: TileTemplate, col: number, row: number): boolean {
  const t = charAt(template, col, row);
  return t === '#' || t === 'o' || t === 'D';
}

/** A placed door: its piece and its cells, from the top-left one (`col`, `row`). */
export interface TileDoor {
  piece: DoorPiece;
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/** What draws at one cell: its base piece and the overlays stacked on it, in order, or the door it is part of. */
export interface TileCell {
  /** Null for a door cell (its door draws it) and for a cell outside the room. */
  base: StaticTilePiece | null;
  overlays: StaticTilePiece[];
  /** The door this cell is part of, null for every other cell (and for a `D` the rule can't place). */
  door: TileDoor | null;
}

/**
 * Every door of a template, and why any `D` can't be placed: a door is two
 * 4-connected `D` cells, horizontal in the north wall (row 0) or vertical in
 * the west or east wall (the first or last column). A south door, a single
 * `D`, a longer run or a pair away from the border has no piece; each problem
 * names the template, so a new template that needs a new piece is caught by
 * the test over rooms.json.
 */
export function tileDoors(template: TileTemplate): { doors: TileDoor[]; problems: string[] } {
  const rows = template.tiles.length;
  const cols = templateCols(template);
  const seen = new Set<number>();
  const doors: TileDoor[] = [];
  const problems: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (charAt(template, c, r) !== 'D' || seen.has(r * cols + c)) continue;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[c, r]];
      seen.add(r * cols + c);
      while (stack.length) {
        const cell = stack.pop();
        if (!cell) break;
        cells.push(cell);
        const [x, y] = cell;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(ny * cols + nx)) continue;
          if (charAt(template, nx, ny) !== 'D') continue;
          seen.add(ny * cols + nx);
          stack.push([nx, ny]);
        }
      }
      const c0 = Math.min(...cells.map(([x]) => x));
      const r0 = Math.min(...cells.map(([, y]) => y));
      const at = cells
        .sort(([ax, ay], [bx, by]) => ay - by || ax - bx)
        .map(([x, y]) => `(${x}, ${y})`)
        .join(' ');
      const where = `${template.name}: the D cells at ${at}`;
      if (cells.length !== 2) {
        problems.push(`${where} are not a pair; a door is two D cells side by side in a border wall`);
        continue;
      }
      const horizontal = cells.every(([, y]) => y === r0);
      let door: DoorPiece | null = null;
      if (horizontal && r0 === 0) door = 'door_n';
      else if (!horizontal && c0 === 0) door = 'door_w';
      else if (!horizontal && c0 === cols - 1) door = 'door_e';
      if (!door) {
        const south = horizontal && r0 === rows - 1;
        problems.push(
          south
            ? `${where} are a south door; no piece draws one (door_n, door_w and door_e only)`
            : `${where} are not in the north, west or east border wall, so no door piece fits them`,
        );
        continue;
      }
      doors.push({ piece: door, col: c0, row: r0, cols: horizontal ? 2 : 1, rows: horizontal ? 1 : 2 });
    }
  }
  return { doors, problems };
}

/** `prefix_` plus the open sides among n, w, e in that order, or one of the two plain variants by the hash, weighted by the sheet. */
function wallPiece(
  prefix: 'face' | 'top',
  open: readonly TileSide[],
  template: TileTemplate,
  col: number,
  row: number,
  weights: TileWeights,
): FacePiece | TopPiece {
  if (open.length) return `${prefix}_${open.join('')}` as FacePiece | TopPiece;
  const w = (prefix === 'face' ? weights.faceMidWeights : weights.topMidWeights) ?? MID_WEIGHTS_DEFAULT;
  const variant = pickWeighted(tileHash(template.name, col, row, SALT[prefix]), w);
  return `${prefix}_mid_${variant}` as FacePiece | TopPiece;
}

/**
 * The pieces at one cell (sprites.md "Tiles"):
 * - an open cell is a floor, `floor_0` … `floor_3` by the cell hash weighted
 *   by `floorWeights`, under `shade_n`, `shade_w` and `shade_e` where that
 *   neighbour is solid, and `shade_nw` (`shade_ne`) where NW (NE) is solid and
 *   N and W (E) are both open; no south shade;
 * - a solid, non-door cell with an open S is a wall face, `face_` plus its
 *   open sides among N, W, E (`face_n` … `face_nwe`), or `face_mid_0` /
 *   `face_mid_1` by the hash weighted by `faceMidWeights` with none open;
 * - a solid, non-door cell with a solid S is a wall top, named the same way
 *   (`top_n` … `top_nwe`, `top_mid_0` / `top_mid_1` by `topMidWeights`), under
 *   `corner_nw` where N and W are solid and NW is open, and `corner_ne` the
 *   same way;
 * - a `D` cell is part of its door (`tileDoors`), which draws it.
 * Cells outside the room are solid for their neighbours and draw nothing.
 * `weights` is the sheet's `tiles` block (`TileWeights`).
 */
export function tileAt(template: TileTemplate, col: number, row: number, weights: TileWeights): TileCell {
  const empty: TileCell = { base: null, overlays: [], door: null };
  if (row < 0 || col < 0 || row >= template.tiles.length || col >= templateCols(template)) return empty;
  if (tileRuleOf(weights) === 'shore') return shoreTileAt(template, col, row, weights);
  const t = charAt(template, col, row);
  if (t === 'D') {
    const door = tileDoors(template).doors.find(
      (d) => col >= d.col && col < d.col + d.cols && row >= d.row && row < d.row + d.rows,
    );
    return { ...empty, door: door ?? null };
  }
  const solid = (dc: number, dr: number): boolean => isSolidTile(template, col + dc, row + dr);
  const n = solid(0, -1);
  const w = solid(-1, 0);
  const e = solid(1, 0);
  const overlays: StaticTilePiece[] = [];
  if (!isSolidTile(template, col, row)) {
    const base =
      FLOOR_PIECES[pickWeighted(tileHash(template.name, col, row, SALT.floor), weights.floorWeights)] ?? 'floor_0';
    if (n) overlays.push('shade_n');
    if (w) overlays.push('shade_w');
    if (e) overlays.push('shade_e');
    if (solid(-1, -1) && !n && !w) overlays.push('shade_nw');
    if (solid(1, -1) && !n && !e) overlays.push('shade_ne');
    return { base, overlays, door: null };
  }
  const open = TILE_SIDES.filter((s) => !{ n, w, e }[s]);
  if (!solid(0, 1)) return { base: wallPiece('face', open, template, col, row, weights), overlays, door: null };
  if (n && w && !solid(-1, -1)) overlays.push('corner_nw');
  if (n && e && !solid(1, -1)) overlays.push('corner_ne');
  return { base: wallPiece('top', open, template, col, row, weights), overlays, door: null };
}

/**
 * Whether a cell is ground for the shore rule: inside the template and not
 * the edge (`#`). Station letters (`W`, `T`, `R`…) are ground for drawing,
 * though solid for collision; the edge and everything outside is void.
 */
export function isShoreGround(template: TileTemplate, col: number, row: number): boolean {
  return charAt(template, col, row) !== '#';
}

/**
 * The shore rule (ART 2026-10-18, sprites.md "Tiles"), for a cell inside the template:
 * - a ground cell is a floor, `floor_0` … `floor_3` by the cell hash weighted
 *   by `floorWeights`, under `lip_n`, `lip_w` and `lip_e` where that neighbour
 *   is void, and `lip_nw` (`lip_ne`) where NW (NE) is void and N and W (E) are
 *   both ground; no south lip (the drop below covers it); no shades;
 * - a void cell with ground directly north is a drop: `drop_mid_0` /
 *   `drop_mid_1` by the hash weighted by `dropMidWeights` where both the W and
 *   E neighbours are drops too, `drop_w` where the W neighbour is not a drop
 *   (the cliff ends there), `drop_e` the same way, `drop_we` when both ends do;
 * - a void cell with no ground north, ground at NE and the drop run starting
 *   at its east neighbour is `drop_corner_w`, the cliff turning round the
 *   corner west of the run; with ground at NW and the run ending at its west
 *   neighbour instead, `drop_corner_e` (a void cell beside a straight west or
 *   east edge has ground at NE or NW too, but no run to turn round, and draws
 *   nothing); with ground at both NW and NE it is a one-cell notch no piece
 *   draws (`shoreProblems` names it) and draws nothing;
 * - every other void cell draws nothing: the Hollow shows through.
 * A `D` is ground here (a shore set has no doors; `roomTiles` reports one).
 */
function shoreTileAt(template: TileTemplate, col: number, row: number, weights: TileWeights): TileCell {
  const ground = (dc: number, dr: number): boolean => isShoreGround(template, col + dc, row + dr);
  const overlays: StaticTilePiece[] = [];
  if (ground(0, 0)) {
    const base =
      FLOOR_PIECES[pickWeighted(tileHash(template.name, col, row, SALT.floor), weights.floorWeights)] ?? 'floor_0';
    const n = !ground(0, -1);
    const w = !ground(-1, 0);
    const e = !ground(1, 0);
    if (n) overlays.push('lip_n');
    if (w) overlays.push('lip_w');
    if (e) overlays.push('lip_e');
    if (!ground(-1, -1) && !n && !w) overlays.push('lip_nw');
    if (!ground(1, -1) && !n && !e) overlays.push('lip_ne');
    return { base, overlays, door: null };
  }
  const drop = (dc: number): boolean => !ground(dc, 0) && ground(dc, -1);
  if (ground(0, -1)) {
    const w = drop(-1);
    const e = drop(1);
    let base: DropPiece;
    if (w && e) {
      const variant = pickWeighted(tileHash(template.name, col, row, SALT.drop), weights.dropMidWeights ?? MID_WEIGHTS_DEFAULT);
      base = `drop_mid_${variant}` as DropPiece;
    } else if (!w && !e) base = 'drop_we';
    else base = w ? 'drop_e' : 'drop_w';
    return { base, overlays, door: null };
  }
  const cornerW = ground(1, -1) && drop(1);
  const cornerE = ground(-1, -1) && drop(-1);
  if (cornerW && !cornerE) return { base: 'drop_corner_w', overlays, door: null };
  if (cornerE && !cornerW) return { base: 'drop_corner_e', overlays, door: null };
  return { base: null, overlays, door: null };
}

/**
 * What the shore pieces can't draw in a template, one line each: a void cell
 * with ground at both NW and NE but not N, a one-cell notch (the layout
 * validator refuses it, so a layout never needs it).
 */
export function shoreProblems(template: TileTemplate): string[] {
  const problems: string[] = [];
  const cols = templateCols(template);
  for (let r = 0; r < template.tiles.length; r++) {
    for (let c = 0; c < cols; c++) {
      if (isShoreGround(template, c, r) || isShoreGround(template, c, r - 1)) continue;
      if (isShoreGround(template, c - 1, r - 1) && isShoreGround(template, c + 1, r - 1))
        problems.push(
          `${template.name}: the void cell at (${c}, ${r}) is a one-cell notch (ground at NW and NE but not N); no shore piece draws it`,
        );
    }
  }
  return problems;
}

/**
 * The `D` cells of a template drawn with a set that has no doors, as one
 * problem naming the template, or none.
 */
export function doorlessProblems(template: TileTemplate): string[] {
  const cells: string[] = [];
  const cols = templateCols(template);
  for (let r = 0; r < template.tiles.length; r++)
    for (let c = 0; c < cols; c++) if (charAt(template, c, r) === 'D') cells.push(`(${c}, ${r})`);
  return cells.length ? [`${template.name}: has D cells at ${cells.join(' ')}, but the tile set has no doors (doors: false)`] : [];
}

/** One static piece to draw: the piece and its cell. A cell's base comes before its overlays. */
export interface TileDraw {
  piece: StaticTilePiece;
  col: number;
  row: number;
}

/**
 * A whole room as the set's rule draws it: every cell's static pieces,
 * row-major, base then overlays (one texture, drawn once per room), the doors
 * (drawn on their own, animated; none with a doorless set), and the problems:
 * a `D` the rule can't place (`tileDoors`), any `D` with a doorless set
 * (`doorlessProblems`), a notch on a shore set (`shoreProblems`).
 */
export function roomTiles(
  template: TileTemplate,
  weights: TileWeights,
): { draws: TileDraw[]; doors: TileDoor[]; problems: string[] } {
  const draws: TileDraw[] = [];
  const cols = templateCols(template);
  for (let row = 0; row < template.tiles.length; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = tileAt(template, col, row, weights);
      if (cell.base) draws.push({ piece: cell.base, col, row });
      for (const p of cell.overlays) draws.push({ piece: p, col, row });
    }
  }
  const set = tileSetOf(weights);
  const placed = set.doors ? tileDoors(template) : { doors: [], problems: doorlessProblems(template) };
  const problems = [...placed.problems, ...(set.rule === 'shore' ? shoreProblems(template) : [])];
  return { draws, doors: placed.doors, problems };
}
