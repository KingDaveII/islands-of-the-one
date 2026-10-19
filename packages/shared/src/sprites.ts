import palette from '../data/palette.json' with { type: 'json' };
import huskNutshell from '../assets/sprites/husk-nutshell.json' with { type: 'json' };
import huskPeeling from '../assets/sprites/husk-peeling.json' with { type: 'json' };
import kindledAsh from '../assets/sprites/kindled-ash.json' with { type: 'json' };
import kindledAshSheathed from '../assets/sprites/kindled-ash-sheathed.json' with { type: 'json' };
import npcKesh from '../assets/sprites/npc-kesh.json' with { type: 'json' };
import propChest from '../assets/sprites/prop-chest.json' with { type: 'json' };
import propHoldingStore from '../assets/sprites/prop-holding-store.json' with { type: 'json' };
import propKeshRock from '../assets/sprites/prop-kesh-rock.json' with { type: 'json' };
import propStoneOutcrop from '../assets/sprites/prop-stone-outcrop.json' with { type: 'json' };
import propTwistedTree from '../assets/sprites/prop-twisted-tree.json' with { type: 'json' };
import propWritPost from '../assets/sprites/prop-writ-post.json' with { type: 'json' };
import { TILE_DOOR_ANIMS, TILE_WORLD_PX } from './tiles.js';

/**
 * Animated sprite sheets (docs/design/sprites.md): a 1× PNG plus a Phaser
 * JSON Hash atlas with two extra blocks the engine reads itself, `anims` and
 * `palette`. The sheets live in packages/shared/assets/sprites, built by the
 * art pipeline from ART's recipes; a redrawn sheet replaces the PNG + JSON
 * pair without any engine change. `packages/shared/test/sprites.test.ts`
 * checks every sheet against its PNG.
 *
 * Every sheet is on the v2 contract (sprites.md §2, §5): option B's art on
 * 64×64 canvases with the soles on row 53, drawn at 1 world px per sheet px,
 * with the cells below and a skin mask for the Kindled's clay tones. M1's v1
 * sheets (drawn at 2×) are retired (G1.5g); the sheet test rejects one. The
 * engine, the test and the art pipeline all read these numbers from here.
 */

/**
 * World px per sim pixel: the world renders at 2× (G1.5), so a 16 px sim
 * tile is 32 world px. The client converts every sim number it draws once,
 * at the render boundary; the sim, its units and the tuning never change.
 */
export const WORLD_PX_PER_UNIT = 2;

/** The art canvas every B sprite comes on (style sheet, option B): 64×64, the soles on row 53. */
export const SPRITE_CANVAS = { w: 64, h: 64, soleRow: 53 } as const;

/** A v2 sheet's cell, its origin (the line under the soles) and where the 64×64 art canvas sits in the cell. */
export interface SpriteCellSpec {
  cell: { w: number; h: number };
  origin: { x: number; y: number };
  canvasAt: { x: number; y: number };
}

/**
 * A cell spec from a cell size and the origin's row: the canvas centred
 * horizontally, its sole row on the row above the origin. A future kind that
 * needs more room declares a bigger cell this way.
 */
export function spriteCellSpec(w: number, h: number, originY: number): SpriteCellSpec {
  const canvasAt = { x: (w - SPRITE_CANVAS.w) / 2, y: originY - 1 - SPRITE_CANVAS.soleRow };
  return { cell: { w, h }, origin: { x: canvasAt.x + SPRITE_CANVAS.w / 2, y: originY }, canvasAt };
}

/**
 * The v2 cells (sprites.md §2): the Kindled's 96×80 has room for its actions,
 * which reach at most 34 px from the feet (SS-01; v3 draws them on a 68×68
 * canvas), the Haul throw and the death fall (canvas at (16, 10), so canvas
 * row 53 is cell row 63, origin (48, 64));
 * every other sheet (Husks and other enemies, NPCs) is the 64×64 canvas
 * itself, origin (32, 54).
 */
export const SPRITE_CELLS = {
  kindled: spriteCellSpec(96, 80, 64),
  other: spriteCellSpec(64, 64, 54),
} as const;

/**
 * Props that need more room than the 64×64 prop cell (sprites.md §2, ART
 * 2026-10-18), by the name after `prop-`: a tall prop's canopy overhangs
 * upwards and sideways, so it gets a 96×128 cell with the origin at (48, 118),
 * the line under the trunk (the canvas at (16, 64): canvas row 53 is cell row
 * 117; ART on #82: the tree stands 2.5 times the Kindled's height and its crown
 * overhangs the 2 × 2 footprint by about 10 px a side, so the grove's crowns
 * just meet; 64×96 at first, M2 Task 3c). The
 * ground-line sort (G1.5h) puts the Kindled behind it; collision stays the
 * layout's footprint. The first is the holding's twisted tree. Declared here,
 * not in a recipe: `spriteSheetSpec` returns it, so the pipeline places frames
 * on it and the sheet test checks it.
 */
export const PROP_CELLS: Readonly<Record<'twisted-tree' | 'twisted-tree-2' | PieceProp | 'weapon-rack', SpriteCellSpec>> = {
  'twisted-tree': spriteCellSpec(96, 128, 118),
  // The second tree (ART 2026-10-18: a forked crown, from the holding job's candidate 2) on the same cell.
  'twisted-tree-2': spriteCellSpec(96, 128, 118),
  // The field's upgrade pieces (M2 Task 6; ART on #102): a cell each, holding both facings, the origin at the bottom
  // centre of the piece's footprint (as the holding's props stand on theirs).
  // The clay channel, 1 × 4 tiles lengthwise and 4 × 1 turned: 136×136.
  'clay-channel': spriteCellSpec(136, 136, 132),
  // The seed jars, 2 × 1 across and 1 × 2 along, the jars rising about 20 px over the plank: 80×104.
  'seed-jars': spriteCellSpec(80, 104, 96),
  // The threshing floor, 3 × 3, the chaff rising about 24 px over its far edge: 112×128.
  'threshing-floor': spriteCellSpec(112, 128, 120),
  // The weapon rack (M2 Task 8; ART's contract): 2 × 1 tiles, at most 62 px wide and about 40 px tall, on the bottom
  // centre of its rect like every prop: 64×72, origin (32, 64).
  'weapon-rack': spriteCellSpec(64, 72, 64),
};

/** The field's upgrade pieces' props (M2 Task 6), by the name after `prop-`: each piece's id is its sheet's name. */
export type PieceProp = 'clay-channel' | 'seed-jars' | 'threshing-floor';

/** The tall prop cell (`PROP_CELLS`): 96×128, origin (48, 118). */
export const TALL_PROP_CELL: SpriteCellSpec = PROP_CELLS['twisted-tree'];

/**
 * A tile sheet's cell (tiles.ts): one 32×32 world px tile, its origin at the
 * top left, since a tile is placed by its cell, not its feet. Door pieces span
 * two cells.
 */
export const TILE_CELL: SpriteCellSpec = {
  cell: { w: TILE_WORLD_PX, h: TILE_WORLD_PX },
  origin: { x: 0, y: 0 },
  canvasAt: { x: 0, y: 0 },
};

/** The design-system colour tokens (name → "#rrggbb") and the clay tones of the Kindled. */
export const paletteData = palette;
export type PaletteToken = keyof typeof palette.tokens;

/** The four clay tones; Kindled sheets are drawn in `paletteData.clay.drawn` and swapped to the others at load. */
export const CLAY_TONES = Object.keys(palette.clay.tones) as ClayTone[];
export type ClayTone = keyof typeof palette.clay.tones;

export interface AtlasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One frame of a Phaser JSON Hash atlas. */
export interface AtlasFrame {
  frame: AtlasRect;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: AtlasRect;
  sourceSize: { w: number; h: number };
  /** The origin as a fraction of the cell (Phaser's setOrigin). */
  anchor: { x: number; y: number };
  /**
   * Kindled frames that need them (`spritePointsFor`): named pixel positions
   * in the frame's cell, `[x, y]` from the cell's top left, written by ART's
   * recipe and placed by the art pipeline with the frame (sprites.md §5).
   */
  points?: Readonly<Record<string, readonly number[]>>;
}

/** One entry of the `anims` block: frame names in order, fps, -1 loops / 0 once, `hold` keeps the last frame. */
export interface SpriteAnim {
  frames: string[];
  frameRate: number;
  repeat: number;
  hold?: boolean;
}

export interface SpriteSheetMeta {
  image: string;
  size: { w: number; h: number };
  scale: string;
  format: string;
  /** "iot-art-pipeline": every shipped sheet is built by the art pipeline (the fixtures say "fixture"). */
  app: string;
  /** "2", the v2 contract; the sheet test rejects anything else. */
  version: string;
  cell: { w: number; h: number };
  /** The origin in pixels from the cell's top left (the point between the feet). */
  origin: { x: number; y: number };
  /** Kindled sheets only, in sheet order: S, SE, E, NE, N, NW, W, SW. */
  facings?: string[];
  /** World px per sheet px: 1 (the sheet test holds it there); the engine draws every sprite sheet at 1. */
  pixelScale: number;
}

/** Palette swaps: the drawn tone's hex values → each other tone's. */
export interface SpritePalette {
  drawn: string;
  swaps: Record<string, Record<string, string>>;
  /**
   * The skin mask, `<name>.skin.png` next to the sheet and the same size; the
   * swaps apply only under its opaque pixels (the clay ramp is shared with
   * wood, rope, belts and boots).
   */
  mask: string;
}

export interface SpriteSheet {
  frames: Record<string, AtlasFrame>;
  meta: SpriteSheetMeta;
  anims: Record<string, SpriteAnim>;
  palette?: SpritePalette;
}

/**
 * The sheets the client loads: the Kindled (its combat sheet and its sheathed
 * sheet, the holding's), the two Husks, the chest
 * (`CHEST_SHEET`), the holding's station props (`STATION_SHEETS`, M2 Task
 * 3b and 3c), Kesh's needle of rock off its shore (`KESH_ROCK_SHEET`, 3c)
 * and Old Kesh himself on it (`KESH_SHEET`, 4b).
 * The sheet test runs on every sheet on disk and checks that each name here
 * is one of them; a sheet on disk (an NPC's, say) joins this list when the
 * client starts using it. Tile sheets load apart (tiles.ts).
 */
export const SPRITE_SHEET_NAMES = [
  'kindled-ash',
  'kindled-ash-sheathed',
  'husk-peeling',
  'husk-nutshell',
  'prop-chest',
  'prop-writ-post',
  'prop-twisted-tree',
  'prop-stone-outcrop',
  'prop-holding-store',
  'prop-kesh-rock',
  'npc-kesh',
] as const;
export type SpriteSheetName = (typeof SPRITE_SHEET_NAMES)[number];

/** Every animated sheet the client loads, by name (the texture key the engine uses). */
export const spriteSheets: Readonly<Record<SpriteSheetName, SpriteSheet>> = {
  'kindled-ash': kindledAsh,
  'kindled-ash-sheathed': kindledAshSheathed,
  'husk-peeling': huskPeeling,
  'husk-nutshell': huskNutshell,
  'prop-chest': propChest,
  'prop-writ-post': propWritPost,
  'prop-twisted-tree': propTwistedTree,
  'prop-stone-outcrop': propStoneOutcrop,
  'prop-holding-store': propHoldingStore,
  'prop-kesh-rock': propKeshRock,
  'npc-kesh': npcKesh,
};

/**
 * The holding's station props (docs/design/holding.md), by station kind: a
 * prop without a table each, `idle` alone, one frame (MAIN's placeholders
 * through the pipeline; ART replaces the pixels without an engine change).
 * The twisted tree stands on the tall cell (`PROP_CELLS`). The weapon rack's
 * sheet (`RACK_SHEET`, M2 Task 8) is optional: drawn when it is on disk, and
 * a placeholder box of its rect in the piece tokens until then. A kind with
 * no entry draws no prop.
 */
export const STATION_SHEETS: Readonly<Partial<Record<'post' | 'trees' | 'outcrop' | 'store' | 'rack', string>>> = {
  post: 'prop-writ-post',
  trees: 'prop-twisted-tree',
  outcrop: 'prop-stone-outcrop',
  store: 'prop-holding-store',
  rack: 'prop-weapon-rack',
};

/**
 * The weapon rack's sheet (M2 Task 8; ART: "lashed twisted logs in the
 * twisted tree's bronze and brass-dark, bound with sleeper-ochre rope"): a
 * prop without a table, `idle` alone, on its own cell in `PROP_CELLS` (64×72,
 * origin (32, 64)), with the prop rule's shadow, optional
 * (`OPTIONAL_SPRITE_SHEETS`). Its frames may carry the peg points
 * (`RACK_PEGS`), where a hung weapon's sprite goes later; nothing hangs on
 * them in M2.
 */
export const RACK_SHEET = 'prop-weapon-rack';

/** Kesh's needle of rock (M2 Task 3c): a solid prop in the void off the holding's south-east shore, `idle` alone, with a perch cut into its tip (ART #93). */
export const KESH_ROCK_SHEET: SpriteSheetName = 'prop-kesh-rock';

/** Old Kesh (M2 Task 4b, ART #93): seated on his rock, drawn at the rock's world point one depth step above it, no shadow (`NPC_TABLES.kesh`). */
export const KESH_SHEET: SpriteSheetName = 'npc-kesh';

/** Kindled facings in sheet order. */
export const SPRITE_FACINGS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type SpriteFacing = (typeof SPRITE_FACINGS)[number];
/** The facings of a 4-facing animation (hit, death, carry); the engine maps diagonals to the nearest. */
export const SPRITE_FACINGS_4: readonly SpriteFacing[] = ['S', 'E', 'N', 'W'];
/** The facings of `sit`. */
export const SPRITE_FACINGS_2: readonly SpriteFacing[] = ['S', 'E'];

/** The milestones an animation table row can belong to, in order. */
export const SPRITE_MILESTONES = ['M1', 'M2', 'M3'] as const;
export type SpriteMilestone = (typeof SPRITE_MILESTONES)[number];

/**
 * The milestone a finished sheet is complete for: it must carry every table
 * row at or before it; later rows are optional, but complete when present
 * (every facing, the right frame count). The sheet test and the art pipeline
 * both read this. M2 Task 9, or whichever task first uses carry or sit, moves
 * it to "M2".
 */
export const REQUIRED_MILESTONE: SpriteMilestone = 'M1';

/**
 * Table rows the contract has but ART hasn't drawn yet (sprites.md §4). While
 * an animation is here, the sheet test and the art pipeline treat it as
 * optional (complete when present) and the engine plays its stand-in
 * (`run` → `walk`; `run_back` → the run in reverse; `run_start` and
 * `run_stop` → none, the run and idle switch directly). When ART's sheet
 * lands with it, MAIN removes it here. Empty from kindled-ash's run (#46) to
 * the M1 polish (ART 2026-10-17), which added the run transitions and
 * `run_back`; `run_start` and `run_stop` came off when ART's frames landed (#72), `run_back`
 * with the backwards-run job (#74). Empty again.
 */
export const ANIMS_AWAITING_ART: readonly string[] = [];

/** Whether a table row is still waiting for ART (`ANIMS_AWAITING_ART`). */
export function isAwaitingArt(row: Pick<SpriteAnimSpec, 'name'>): boolean {
  return ANIMS_AWAITING_ART.includes(row.name);
}

/**
 * Whether a table row must be in a finished sheet: it isn't waiting for ART,
 * and it is `required` by its table (the sheathed sheet's own rule) or its
 * milestone is at or before `REQUIRED_MILESTONE`.
 */
export function isRequiredAnim(row: Pick<SpriteAnimSpec, 'milestone' | 'name' | 'required'>): boolean {
  if (isAwaitingArt(row)) return false;
  return (
    row.required === true || SPRITE_MILESTONES.indexOf(row.milestone) <= SPRITE_MILESTONES.indexOf(REQUIRED_MILESTONE)
  );
}

/** Why an optional row may be left out, for messages: `awaiting art` or `optional until M2`. */
export function optionalReason(row: Pick<SpriteAnimSpec, 'milestone' | 'name'>): string {
  return isAwaitingArt(row) ? 'awaiting art' : `optional until ${row.milestone}`;
}

/** One row of an animation table (sprites.md §4): frame count, rate, loop and hold, its facings and its milestone. */
export interface SpriteAnimSpec {
  name: string;
  frames: number;
  /** 0 for a single held frame (or one stretched by the engine). */
  fps: number;
  loop: boolean;
  hold: boolean;
  /** The facings it is drawn in; empty for kinds without facings (Husks, props). */
  facings: readonly SpriteFacing[];
  /** The milestone that first uses it; a finished sheet may leave out rows after `REQUIRED_MILESTONE`. */
  milestone: SpriteMilestone;
  /**
   * Every finished sheet of this table carries the row, whatever its
   * milestone: the sheathed sheet's own finished-sheet rule (ART,
   * 2026-10-18), complete with its five roaming rows.
   */
  required?: true;
  /**
   * Props only: the recipe gives this row's frame count, within the range, and
   * its rate, like a prop's `idle` (`PROP_IDLE`). In a table (`PROP_TABLES`)
   * `frames` is then the most it may have and `fps` the default; `propTableFor`
   * resolves such rows to what a recipe or a sheet gives them (`propAnimSpec`).
   */
  fromRecipe?: PropRecipeAnim;
}

/** One row of the Kindled table (the name it had before every kind had a table). */
export type KindledAnimSpec = SpriteAnimSpec;

const spec = (
  name: string,
  frames: number,
  fps: number,
  loop: boolean,
  hold: boolean,
  facings: readonly SpriteFacing[] = SPRITE_FACINGS,
  milestone: SpriteMilestone = 'M1',
): SpriteAnimSpec => ({ name, frames, fps, loop, hold, facings, milestone });

const NO_FACINGS: readonly SpriteFacing[] = [];

/**
 * The Kindled animations of every `kindled-<remembrance>` combat sheet, per
 * facing; everything outside combat is on the sheathed sheet
 * (`KINDLED_SHEATHED_ANIMS`; carry and sit moved there, ART 2026-10-18).
 * `run` is M1's (the Kindled always runs in encounters) and required like the
 * rest. The run transitions (`run_start`, `run_stop`: 2 frames at 20 fps,
 * played once by time, 100 ms) and `run_back` (4 frames by distance, one
 * cycle per `anim.backCyclePx`; its 12 fps is nominal, for tools and previews
 * where nothing drives it by distance; ART's answer on #69) landed in #72 and
 * #74.
 */
export const KINDLED_ANIMS: readonly SpriteAnimSpec[] = [
  spec('idle', 2, 2, true, false),
  spec('walk', 6, 10, true, false),
  spec('run', 8, 16, true, false),
  spec('run_start', 2, 20, false, false),
  spec('run_stop', 2, 20, false, false),
  spec('run_back', 4, 12, true, false),
  spec('dodge', 4, 16, false, false),
  spec('light_1', 3, 15, false, false),
  spec('light_2', 3, 15, false, false),
  spec('light_3', 3, 15, false, false),
  spec('heavy_charge', 3, 12, false, true),
  spec('heavy_thrust', 2, 20, false, false),
  spec('heavy_hold', 1, 0, false, true),
  spec('heavy_recover', 2, 12, false, false),
  spec('haul_throw', 2, 15, false, true),
  spec('haul_recover', 2, 12, false, false),
  spec('haul_pull', 2, 12, true, false),
  spec('haul_slide', 2, 12, true, false),
  spec('hit', 2, 0, false, true, SPRITE_FACINGS_4),
  spec('death', 6, 8, false, true, SPRITE_FACINGS_4),
];

/** A row every finished sheet of its table carries (`required`), M2's. */
const requiredSpec = (name: string, frames: number, fps: number, loop: boolean): SpriteAnimSpec => ({
  ...spec(name, frames, fps, loop, false, SPRITE_FACINGS, 'M2'),
  required: true,
});

/**
 * The Kindled outside combat, `kindled-<remembrance>-sheathed` (ART,
 * 2026-10-18): the blade put away under the cloak, not drawn. The same cell,
 * origin, 8 facings, palette block and skin mask as the combat sheet; ART
 * erases the blade from the combat sheet's own frames, so the two match frame
 * for frame. Its five roaming rows have the same counts, rates and playback
 * as `KINDLED_ANIMS`' and are its finished-sheet rule (`required`); no
 * `run_back` (backpedalling is combat only). Carry and sit live here (M2,
 * optional until `REQUIRED_MILESTONE` is M2), and the M2 station animations
 * join them. The combat sheet keeps combat only: 2048 × 2048 holds 525 cells
 * and kindled-ash uses 456.
 */
export const KINDLED_SHEATHED_ANIMS: readonly SpriteAnimSpec[] = [
  requiredSpec('idle', 2, 2, true),
  requiredSpec('walk', 6, 10, true),
  requiredSpec('run', 8, 16, true),
  requiredSpec('run_start', 2, 20, false),
  requiredSpec('run_stop', 2, 20, false),
  spec('carry_idle', 2, 2, true, false, SPRITE_FACINGS_4, 'M2'),
  spec('carry_walk', 6, 10, true, false, SPRITE_FACINGS_4, 'M2'),
  spec('sit', 1, 0, false, true, SPRITE_FACINGS_2, 'M2'),
];

/** The suffix of a Kindled's sheathed sheet: `kindled-ash` → `kindled-ash-sheathed`. */
export const SHEATHED_SUFFIX = '-sheathed';

/** The sheathed sheet of a Kindled combat sheet. */
export function sheathedSheetName(combat: string): string {
  return `${combat}${SHEATHED_SUFFIX}`;
}

/** Whether a sheet name is a Kindled's sheathed sheet. */
export function isSheathedSheet(name: string): boolean {
  return name.startsWith('kindled-') && name.endsWith(SHEATHED_SUFFIX) && name.length > 'kindled-'.length + SHEATHED_SUFFIX.length;
}

/**
 * Named points in a Kindled frame (sprites.md §5): `tip`, the hook's tip, and
 * `hand`, the hand the Haul chain leaves from. The engine draws the charge
 * spark at `tip` and starts the chain at `hand`.
 */
export const KINDLED_POINTS = ['tip', 'hand'] as const;
export type KindledPoint = (typeof KINDLED_POINTS)[number];

/**
 * The weapon rack's pegs (M2 Task 8; ART: "Please reserve the pegs in the
 * contract now"): three named points on `prop-weapon-rack`'s `idle`, where
 * each unequipped weapon's small "hung" sprite is drawn later, one rack frame
 * however many weapons come. Optional: a finished rack sheet may carry any of
 * them; no other sheet may.
 */
export const RACK_PEGS = ['peg_0', 'peg_1', 'peg_2'] as const;
export type RackPeg = (typeof RACK_PEGS)[number];

/** Every point name a sheet may carry: the Kindled's (Kesh's `hand` among them) and the rack's pegs. */
export const SPRITE_POINTS = [...KINDLED_POINTS, ...RACK_PEGS] as const;
export type SpritePoint = (typeof SPRITE_POINTS)[number];

/** The points a finished sheet need not carry: the rack's pegs (ART places them when the hung sprites come). */
export const OPTIONAL_POINTS: readonly SpritePoint[] = RACK_PEGS;

/**
 * Where each point is required: on every frame and facing of these
 * animations, and allowed nowhere else (for now). The sheet test and the art
 * pipeline both read this.
 */
export const KINDLED_POINT_ANIMS: Readonly<Record<KindledPoint, readonly string[]>> = {
  tip: ['heavy_charge'],
  hand: ['haul_throw', 'haul_pull', 'haul_slide', 'haul_recover'],
};

/**
 * The same for NPCs, by the name after `npc-` (M2 Task 4b, ART 2026-10-18):
 * Kesh's `hand` on every frame of `toss`, where the thrown thing leaves his
 * hand (`KESH_TOSS_RELEASE_FRAME`). An NPC without an entry carries none.
 */
export const NPC_POINT_ANIMS: Readonly<Record<string, Partial<Record<SpritePoint, readonly string[]>>>> = {
  kesh: { hand: ['toss'] },
};

/** The `toss` frame on which the thrown thing leaves Kesh's hand (ART: `toss_2`); the engine flies it from that frame's `hand`. */
export const KESH_TOSS_RELEASE_FRAME = 2;

/** The same for props, by the name after `prop-`: the weapon rack's pegs on `idle` (M2 Task 8). A prop without an entry carries none. */
export const PROP_POINT_ANIMS: Readonly<Record<string, Partial<Record<SpritePoint, readonly string[]>>>> = {
  'weapon-rack': { peg_0: ['idle'], peg_1: ['idle'], peg_2: ['idle'] },
};

/**
 * The animations a point goes on, on a sheet: `KINDLED_POINT_ANIMS` for a
 * Kindled sheet, `NPC_POINT_ANIMS` for an NPC's, `PROP_POINT_ANIMS` for a
 * prop's, none otherwise.
 */
export function pointAnimsFor(sheetName: string, point: SpritePoint): readonly string[] {
  if (isKindledSheet(sheetName)) return isKindledPoint(point) ? KINDLED_POINT_ANIMS[point] : [];
  if (sheetName.startsWith('npc-')) return NPC_POINT_ANIMS[sheetName.slice('npc-'.length)]?.[point] ?? [];
  if (sheetName.startsWith('prop-')) return PROP_POINT_ANIMS[sheetName.slice('prop-'.length)]?.[point] ?? [];
  return [];
}

/** The points a frame of an animation may carry on a sheet (`pointAnimsFor`); the required ones are those not in `OPTIONAL_POINTS`. */
export function spritePointsFor(sheetName: string, anim: string): readonly SpritePoint[] {
  return SPRITE_POINTS.filter((p) => pointAnimsFor(sheetName, p).includes(anim));
}

/** The points every frame of an animation must carry on a finished sheet: `spritePointsFor` less the optional ones. */
export function requiredPointsFor(sheetName: string, anim: string): readonly SpritePoint[] {
  return spritePointsFor(sheetName, anim).filter((p) => !OPTIONAL_POINTS.includes(p));
}

/** Whether a name is one of `KINDLED_POINTS`. */
export function isKindledPoint(name: string): name is KindledPoint {
  return (KINDLED_POINTS as readonly string[]).includes(name);
}

/** Whether a name is one of `SPRITE_POINTS`. */
export function isSpritePoint(name: string): name is SpritePoint {
  return (SPRITE_POINTS as readonly string[]).includes(name);
}

/**
 * A frame's point as `{ x, y }` in its cell, or null when the frame has none
 * (a frame that carries no points, a malformed entry).
 */
export function framePoint(sheet: SpriteSheet, frame: string, point: SpritePoint): { x: number; y: number } | null {
  const p = sheet.frames[frame]?.points?.[point];
  if (!p || p.length !== 2) return null;
  const [x, y] = p;
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null;
}

/**
 * The Husk tables (sprites.md §4), one per Husk, with no facings: the engine
 * flips a Husk instead. `telegraph` frames carry the pre-tinted telegraph
 * colours. A later enemy adds its own table here, keyed by its sheet name
 * without `husk-`.
 */
export const HUSK_TABLES: Readonly<Record<'peeling' | 'nutshell', readonly SpriteAnimSpec[]>> = {
  peeling: [
    spec('spawn', 4, 0, false, false, NO_FACINGS),
    spec('idle', 2, 3, true, false, NO_FACINGS),
    spec('telegraph', 2, 8, false, true, NO_FACINGS),
    spec('lunge', 3, 15, false, false, NO_FACINGS),
    spec('hit', 1, 0, false, true, NO_FACINGS),
    spec('chipped', 1, 0, false, true, NO_FACINGS),
    spec('death', 4, 10, false, true, NO_FACINGS),
    spec('drop', 1, 0, false, true, NO_FACINGS),
  ],
  nutshell: [
    spec('spawn', 4, 0, false, false, NO_FACINGS),
    spec('idle', 2, 2, true, false, NO_FACINGS),
    spec('walk', 4, 6, true, false, NO_FACINGS),
    spec('telegraph', 2, 8, false, true, NO_FACINGS),
    spec('slam', 2, 0, false, true, NO_FACINGS),
    spec('hit', 1, 0, false, true, NO_FACINGS),
    spec('chipped_outer', 1, 0, false, true, NO_FACINGS),
    spec('chipped_inner', 1, 0, false, true, NO_FACINGS),
    spec('regrow', 3, 6, false, true, NO_FACINGS),
    spec('death', 4, 10, false, true, NO_FACINGS),
    spec('drop', 1, 0, false, true, NO_FACINGS),
  ],
};

/** The Husk animation names per Husk, in table order. */
export const HUSK_ANIMS: Readonly<Record<'peeling' | 'nutshell', readonly string[]>> = {
  peeling: HUSK_TABLES.peeling.map((a) => a.name),
  nutshell: HUSK_TABLES.nutshell.map((a) => a.name),
};

/**
 * The NPC table (`npc-<name>`): idle and walk in all 8 facings, in the
 * Kindled order. NPC sheets carry `meta.facings` and no palette block or mask
 * (each NPC is generated in its own clay tone). More animations come later,
 * per NPC, as data.
 */
export const NPC_ANIMS: readonly SpriteAnimSpec[] = [spec('idle', 2, 2, true, false), spec('walk', 6, 10, true, false)];

/** A seated row of one facing, required on a finished sheet of its table (`required`). */
const seated = (name: string, frames: number, fps: number, loop: boolean): SpriteAnimSpec => ({
  ...spec(name, frames, fps, loop, false, NO_FACINGS, 'M2'),
  required: true,
});

/**
 * An NPC's own table instead of `NPC_ANIMS`, by the name after `npc-`. Old
 * Kesh (M2 Task 4b, ART 2026-10-18) sits on his needle of rock: three seated
 * rows of one facing (south-east, out over the Hollow), named without a
 * facing like a prop's (`fish_0`), and required: `fish` (4 at 4 fps, looping),
 * `talk` (2 at 3, looping while the dialogue is open) and `toss` (4 at 10,
 * once, then back to `fish`; `hand` on every frame, `KESH_TOSS_RELEASE_FRAME`).
 * His standing `idle` and `walk` in 8 facings are optional until hour two
 * (M3), when he leaves the rock.
 */
export const NPC_TABLES: Readonly<Record<string, readonly SpriteAnimSpec[]>> = {
  kesh: [
    seated('fish', 4, 4, true),
    seated('talk', 2, 3, true),
    seated('toss', 4, 10, false),
    spec('idle', 2, 2, true, false, SPRITE_FACINGS, 'M3'),
    spec('walk', 6, 10, true, false, SPRITE_FACINGS, 'M3'),
  ],
};

/**
 * An NPC's own cell instead of the 64×64, by the name after `npc-`: Kesh is
 * drawn on the tall cell (96×128, origin (48, 118)) at his rock's world point,
 * one depth step above it, seated on its summit inside the cell, so no seat
 * offset lives in data; his standing rows later stand with their soles on the
 * origin as usual.
 */
export const NPC_CELLS: Readonly<Record<string, SpriteCellSpec>> = {
  kesh: spriteCellSpec(96, 128, 118),
};

/**
 * An animation a prop draws at the recipe's frame count and rate (sprites.md
 * §4): `name`, from `minFrames` to `maxFrames` frames, at the recipe's `fps`
 * (`defaultFps` when it gives none); looping with more than one frame, held
 * with one (`propAnimSpec`).
 */
export interface PropRecipeAnim {
  name: string;
  minFrames: number;
  maxFrames: number;
  defaultFps: number;
}

/** A prop (`prop-<name>`) without a table of its own has only `idle`, no facings, 1 to 8 frames at a rate its recipe gives. */
export const PROP_IDLE: PropRecipeAnim = { name: 'idle', minFrames: 1, maxFrames: 8, defaultFps: 8 };

/**
 * A turnable piece's second facing (M2 Task 6; ART on #102): the piece turned 90°, a look of its own under the
 * top-left light, 1 to 8 frames like `idle`. A piece turned 180° shows `idle` again and 270° shows `idle_turned`,
 * never mirrored (the light stays top left).
 */
export const PROP_IDLE_TURNED: PropRecipeAnim = { name: 'idle_turned', minFrames: 1, maxFrames: 8, defaultFps: 8 };

/** The chest's `closed`: like `idle`, capped at 2 frames (ART's clasp glint, about 2 fps); 1 frame is still, with no glint. */
export const CHEST_CLOSED: PropRecipeAnim = { name: 'closed', minFrames: 1, maxFrames: 2, defaultFps: PROP_IDLE.defaultFps };

/**
 * The table row of a recipe-rated prop animation with `frames` frames at
 * `fps`: looping when there is more than one, else held. The row keeps
 * `fromRecipe`, so the sheet test and the pipeline can check the range.
 */
export function propAnimSpec(anim: PropRecipeAnim, frames: number, fps: number = anim.defaultFps): SpriteAnimSpec {
  return {
    name: anim.name,
    frames,
    fps,
    loop: frames > 1,
    hold: frames === 1,
    facings: NO_FACINGS,
    milestone: 'M1',
    fromRecipe: anim,
  };
}

/** The table row of a prop's `idle` with `frames` frames: looping when there is more than one, else held. */
export function propIdleSpec(frames: number, fps: number = PROP_IDLE.defaultFps): SpriteAnimSpec {
  return propAnimSpec(PROP_IDLE, frames, fps);
}

/** The chest's sheet (`prop-chest`), the first prop with a table of its own; the engine draws every chest from it (`SPRITE_SHEET_NAMES`). */
export const CHEST_SHEET: SpriteSheetName = 'prop-chest';

/**
 * The Sparkglass pickup's sheet (ART delivers it; M1 polish 2026-10-17): a
 * prop without a table, so `idle` alone, a 9 × 11 chip with a 2-frame glint
 * at the recipe's fps. Optional: the client draws pickups from it when it is
 * on disk and keeps its own drawing as the fallback until then
 * (`OPTIONAL_SPRITE_SHEETS`), so it is not in `SPRITE_SHEET_NAMES`.
 */
export const SPARKGLASS_SHEET = 'prop-sparkglass';

/**
 * Sheets the client loads when they are on disk and does without otherwise
 * (each with its fallback in the engine). The sheet test checks one like any
 * other sheet once it lands.
 */
export const OPTIONAL_SPRITE_SHEETS: readonly string[] = [
  SPARKGLASS_SHEET,
  'prop-twisted-tree-2',
  // The field's upgrade pieces (`PIECE_SHEETS`).
  'prop-clay-channel',
  'prop-seed-jars',
  'prop-threshing-floor',
  // The weapon rack (`RACK_SHEET`, M2 Task 8): a placeholder box until ART's sheet lands.
  RACK_SHEET,
];

/**
 * The field's upgrade pieces' sheets (M2 Task 6; ART on #102), by piece id: `prop-<piece id>`. Optional until ART's
 * sheets land (the build mode draws its placeholders until then). Rows: `idle`, and `idle_turned` for a turnable
 * piece (`PROP_TABLES`); a piece turned 90° or 270° shows `idle_turned` when its sheet has it, else `idle`
 * (`pieceAnim`). Shadow: the seed jars stand up off the ground and take the prop rule's; the channel (sunk) and the
 * floor (flat) take none (`PIECE_SHADOWS`).
 */
export const PIECE_SHEETS: Readonly<Record<PieceProp, string>> = {
  'clay-channel': 'prop-clay-channel',
  'seed-jars': 'prop-seed-jars',
  'threshing-floor': 'prop-threshing-floor',
};

/** Which pieces cast the prop rule's grounding shadow (ART on #102). */
export const PIECE_SHADOWS: Readonly<Record<PieceProp, boolean>> = {
  'clay-channel': false,
  'seed-jars': true,
  'threshing-floor': false,
};

/** The row a piece shows at a rotation (0, 90, 180, 270): `idle_turned` at 90 and 270 when the sheet has it, else `idle`. */
export function pieceAnim(rotation: number, hasTurned: boolean): 'idle' | 'idle_turned' {
  return (rotation === 90 || rotation === 270) && hasTurned ? 'idle_turned' : 'idle';
}

/**
 * The sheets a station's part may name instead of its kind's
 * (`STATION_SHEETS`), by station kind: the second twisted tree (ART
 * 2026-10-18; a second sheet, not a mirror, which would be lit from the top
 * right, nor an `idle_1`, which would animate). Optional sheets: until one is
 * on disk, the part draws its kind's sheet.
 */
export const STATION_PART_SHEETS: Readonly<Partial<Record<'post' | 'trees' | 'outcrop' | 'store' | 'rack', readonly string[]>>> = {
  trees: ['prop-twisted-tree-2'],
};

/** The chest's animations, in table order: `closed` (looping), `opening` (once), `open` (held). */
export const CHEST_ANIMS = ['closed', 'opening', 'open'] as const;
export type ChestAnim = (typeof CHEST_ANIMS)[number];

/**
 * The prop tables (sprites.md §4), keyed by the sheet name after `prop-`, each
 * with no facings and all M1. A prop without an entry has `idle` alone
 * (`PROP_IDLE`). The chest: `closed`, 1 or 2 frames at the recipe's rate
 * (`CHEST_CLOSED`, the glint), `opening`, 4 frames at 12 fps played once, and
 * `open`, 1 frame held; the engine plays `opening` when `ChestState.opened`
 * turns true and shows `open` for a chest already open when it first sees it.
 */
export const PROP_TABLES: Readonly<Record<'chest' | 'clay-channel' | 'seed-jars', readonly SpriteAnimSpec[]>> = {
  chest: [
    propAnimSpec(CHEST_CLOSED, CHEST_CLOSED.maxFrames),
    spec('opening', 4, 12, false, true, NO_FACINGS),
    spec('open', 1, 0, false, true, NO_FACINGS),
  ],
  // The turnable pieces (M2 Task 6; ART on #102): `idle` lengthwise or across, `idle_turned` turned 90°, both from
  // the recipe. The threshing floor is round and has no entry: `idle` alone, its chaff spiral looping.
  'clay-channel': [propAnimSpec(PROP_IDLE, PROP_IDLE.maxFrames), propAnimSpec(PROP_IDLE_TURNED, PROP_IDLE_TURNED.maxFrames)],
  'seed-jars': [propAnimSpec(PROP_IDLE, PROP_IDLE.maxFrames), propAnimSpec(PROP_IDLE_TURNED, PROP_IDLE_TURNED.maxFrames)],
};

/** The frame name of a prop animation's frame `n`: `closed_0`, `opening_3` (no facings). */
export function propFrameName(anim: string, n: number): string {
  return `${anim}_${n}`;
}

/** What a recipe or a sheet gives a recipe-rated prop animation: its frame count and, when it says, its rate. */
export interface PropAnimGiven {
  frames: number;
  fps?: number;
}

/**
 * A prop sheet's table resolved to what `given` says of each recipe-rated
 * animation (by name): its own table (`PROP_TABLES`) or `idle` alone, each
 * `fromRecipe` row at the given frame count and rate (`propAnimSpec`); a row
 * given nothing keeps its most frames at its default rate. A count outside the
 * row's range stays in the row, for the checks to report. Null for other kinds.
 */
export function propTableFor(
  name: string,
  given: (anim: string) => PropAnimGiven | undefined,
): SpriteAnimSpec[] | null {
  const kind = spriteSheetSpec(name);
  if (kind.kind !== 'prop') return null;
  const table = kind.anims ?? [propAnimSpec(PROP_IDLE, PROP_IDLE.maxFrames)];
  return table.map((row) => {
    if (!row.fromRecipe) return row;
    const g = given(row.name);
    return g ? propAnimSpec(row.fromRecipe, g.frames, g.fps) : row;
  });
}

/** The recipe-rated animations of a prop sheet (`fromRecipe` rows of its table, or `idle`); none for other kinds. */
export function propRecipeAnims(name: string): readonly PropRecipeAnim[] {
  const kind = spriteSheetSpec(name);
  if (kind.kind !== 'prop') return [];
  return kind.anims ? kind.anims.flatMap((r) => (r.fromRecipe ? [r.fromRecipe] : [])) : [PROP_IDLE];
}

/** Why a recipe-rated row's frame count breaks its range, or null: `a prop's closed has 1 to 2 frames, not 3`. */
export function propFrameRangeProblem(anim: PropRecipeAnim, frames: number): string | null {
  if (frames >= anim.minFrames && frames <= anim.maxFrames) return null;
  return `a prop's ${anim.name} has ${anim.minFrames} to ${anim.maxFrames} frames, not ${frames}`;
}

/** The kinds of sheet, each named by its prefix: `kindled-`, `husk-`, `npc-`, `prop-`, `tiles-` (room tiles, tiles.ts). */
export const SPRITE_KINDS = ['kindled', 'husk', 'npc', 'prop', 'tiles'] as const;
export type SpriteKind = (typeof SPRITE_KINDS)[number];

/** What a sheet's name decides (sprites.md §2–§4). */
export interface SpriteSheetSpec {
  kind: SpriteKind;
  /** The v2 cell, origin and canvas position: the Kindled's, a tall prop's (`PROP_CELLS`), or the 64×64 cell; for tiles, one 32×32 tile with its origin at the top left. */
  cell: SpriteCellSpec;
  /**
   * The animations a finished sheet carries, or null when its count is the
   * recipe's (a prop without a table in `PROP_TABLES`: `idle` only, see
   * `PROP_IDLE`) or when the contract has no table for it yet (a Husk that is
   * not in `HUSK_TABLES`). A prop's table may have rows the recipe rates
   * (`fromRecipe`); `propTableFor` resolves them. For tiles, the door
   * animations (`TILE_DOOR_ANIMS`); its static pieces are in tiles.ts.
   */
  anims: readonly SpriteAnimSpec[] | null;
  /** Whether frames and anims are named per facing and `meta.facings` is present (Kindled, NPCs). */
  facings: boolean;
  /** Whether the sheet has a palette block and a skin mask (Kindled only). */
  palette: boolean;
}

/**
 * The kind, cell and animation table of a sheet, from its name's prefix. The
 * client, the sheet test and the art pipeline all use this one function; an
 * unknown prefix throws.
 */
export function spriteSheetSpec(name: string): SpriteSheetSpec {
  const kind = SPRITE_KINDS.find((k) => name.startsWith(`${k}-`) && name.length > k.length + 1);
  switch (kind) {
    case 'kindled':
      return {
        kind,
        cell: SPRITE_CELLS.kindled,
        anims: isSheathedSheet(name) ? KINDLED_SHEATHED_ANIMS : KINDLED_ANIMS,
        facings: true,
        palette: true,
      };
    case 'husk': {
      const husk = name.slice('husk-'.length);
      const anims = husk === 'peeling' || husk === 'nutshell' ? HUSK_TABLES[husk] : null;
      return { kind, cell: SPRITE_CELLS.other, anims, facings: false, palette: false };
    }
    case 'npc': {
      const npc = name.slice('npc-'.length);
      const anims = (Object.hasOwn(NPC_TABLES, npc) ? NPC_TABLES[npc] : undefined) ?? NPC_ANIMS;
      const cell = (Object.hasOwn(NPC_CELLS, npc) ? NPC_CELLS[npc] : undefined) ?? SPRITE_CELLS.other;
      return { kind, cell, anims, facings: true, palette: false };
    }
    case 'prop': {
      const prop = name.slice('prop-'.length);
      const anims = Object.hasOwn(PROP_TABLES, prop) ? PROP_TABLES[prop as keyof typeof PROP_TABLES] : null;
      const cell = Object.hasOwn(PROP_CELLS, prop) ? PROP_CELLS[prop as keyof typeof PROP_CELLS] : SPRITE_CELLS.other;
      return { kind, cell, anims, facings: false, palette: false };
    }
    case 'tiles':
      return { kind, cell: TILE_CELL, anims: TILE_DOOR_ANIMS, facings: false, palette: false };
    default:
      throw new Error(`sprite sheet "${name}" has no known kind: its name must start with ${SPRITE_KINDS.map((k) => `${k}-`).join(', ')}`);
  }
}

/** True for a Kindled sheet (`kindled-<remembrance>`), which has facings and a palette block. */
export function isKindledSheet(name: string): boolean {
  return name.startsWith('kindled-');
}

/** The contract's version: every sprite sheet is "2"; the sheet test rejects a v1 sheet (M1's, drawn at 2×, retired in G1.5g). */
export const SPRITE_SHEET_VERSION = '2';

/** The v2 cell spec of a sheet by its name: the Kindled's, a tall prop's, or every other kind's (`spriteSheetSpec`). */
export function spriteCellSpecFor(name: string): SpriteCellSpec {
  return spriteSheetSpec(name).cell;
}

/** The tokens a v2 sheet may not use anywhere: spark-glow (the perfect-dodge trail) and the three signal colours. */
const NOT_IN_SPRITES: readonly PaletteToken[] = ['spark-glow', 'signal-hit', 'signal-telegraph', 'signal-telegraph-dark'];

/**
 * The colour whitelist of v2 sheets (style sheet "Colour"): palette.json's
 * tokens minus spark-glow and the signal colours, 28 lowercase hexes. The two
 * telegraph colours are allowed besides, in `telegraph*` frames only.
 */
export const SPRITE_WHITELIST: readonly string[] = (Object.entries(palette.tokens) as [PaletteToken, string][])
  .filter(([token]) => !NOT_IN_SPRITES.includes(token))
  .map(([, hex]) => hex.toLowerCase());

/** The skin mask's file name for a sheet: `<name>.skin.png`. */
export function skinMaskName(name: string): string {
  return `${name}.skin.png`;
}

/** Frame name of a Kindled animation frame: `<anim>_<FACING>_<n>`. */
export function kindledFrameName(anim: string, facing: SpriteFacing, n: number): string {
  return `${anim}_${facing}_${n}`;
}

/** Animation key of a Kindled animation for a facing: `<anim>_<FACING>`. */
export function kindledAnimKey(anim: string, facing: SpriteFacing): string {
  return `${anim}_${facing}`;
}

/** The hex colour ("#rrggbb", lowercase) of an RGB triple. */
export function hexOf(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
