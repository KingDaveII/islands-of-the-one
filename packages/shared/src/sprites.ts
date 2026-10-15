import palette from '../data/palette.json' with { type: 'json' };
import huskNutshell from '../assets/sprites/husk-nutshell.json' with { type: 'json' };
import huskPeeling from '../assets/sprites/husk-peeling.json' with { type: 'json' };
import kindledAsh from '../assets/sprites/kindled-ash.json' with { type: 'json' };

/**
 * Animated character sheets (docs/design/sprites.md): a 1× PNG plus a Phaser
 * JSON Hash atlas with two extra blocks the engine reads itself, `anims` and
 * `palette`. The sheets live in packages/shared/assets/sprites; a hand-drawn
 * sheet replaces a placeholder PNG + JSON pair without any engine change.
 * `packages/shared/test/sprites.test.ts` checks every sheet against its PNG.
 *
 * Two versions of the contract (sprites.md §2, §5): v1 sheets are M1's art,
 * drawn at 2× in the world; v2 sheets are option B's (64×64 art canvases,
 * soles on row 53), drawn at 1×, with the cells below and a skin mask for the
 * Kindled's clay tones. The engine, the test and the G1.2 pipeline all read
 * these numbers from here.
 */

/**
 * World px per sim pixel: the world renders at 2× (G1.5), so a 16 px sim
 * tile is 32 world px. The client converts every sim number it draws once,
 * at the render boundary; the sim, its units and the tuning never change.
 */
export const WORLD_PX_PER_UNIT = 2;

/** World px per sheet px of a v1 sheet and of the engine's M1 art (hookblade-fx, the room, the FX): drawn at 2× until replaced. */
export const LEGACY_PIXEL_SCALE = 2;

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
 * The v2 cells (sprites.md §2): the Kindled's 112×80 has room for the heavy
 * thrust (about 52 px from the feet), the Haul throw and the death fall
 * (canvas at (24, 10), so canvas row 53 is cell row 63, origin (56, 64));
 * every other sheet (Husks and other enemies, NPCs) is the 64×64 canvas
 * itself, origin (32, 54).
 */
export const SPRITE_CELLS = {
  kindled: spriteCellSpec(112, 80, 64),
  other: spriteCellSpec(64, 64, 54),
} as const;

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
  /** "placeholder" for sheets drawn by tools/placeholder-sheets.py; the art pipeline writes its own id. */
  app: string;
  version: string;
  cell: { w: number; h: number };
  /** The origin in pixels from the cell's top left (the point between the feet). */
  origin: { x: number; y: number };
  /** Kindled sheets only, in sheet order: S, SE, E, NE, N, NW, W, SW. */
  facings?: string[];
  /** v2 only: world px per sheet px (1). A v1 sheet has none and draws at `LEGACY_PIXEL_SCALE`. */
  pixelScale?: number;
}

/** Palette swaps: the drawn tone's hex values → each other tone's. */
export interface SpritePalette {
  drawn: string;
  swaps: Record<string, Record<string, string>>;
  /**
   * v2 Kindled sheets: the skin mask, `<name>.skin.png` next to the sheet and
   * the same size; the swaps apply only under its opaque pixels (the clay ramp
   * is shared with wood, rope, belts and boots). A v1 sheet swaps everywhere.
   */
  mask?: string;
}

export interface SpriteSheet {
  frames: Record<string, AtlasFrame>;
  meta: SpriteSheetMeta;
  anims: Record<string, SpriteAnim>;
  palette?: SpritePalette;
}

export const SPRITE_SHEET_NAMES = ['kindled-ash', 'husk-peeling', 'husk-nutshell'] as const;
export type SpriteSheetName = (typeof SPRITE_SHEET_NAMES)[number];

/** Every animated sheet in packages/shared/assets/sprites, by name (the texture key the engine uses). */
export const spriteSheets: Readonly<Record<SpriteSheetName, SpriteSheet>> = {
  'kindled-ash': kindledAsh,
  'husk-peeling': huskPeeling,
  'husk-nutshell': huskNutshell,
};

/** Kindled facings in sheet order. */
export const SPRITE_FACINGS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'] as const;
export type SpriteFacing = (typeof SPRITE_FACINGS)[number];
/** The facings of a 4-facing animation (hit, death, carry); the engine maps diagonals to the nearest. */
export const SPRITE_FACINGS_4: readonly SpriteFacing[] = ['S', 'E', 'N', 'W'];
/** The facings of `sit`. */
export const SPRITE_FACINGS_2: readonly SpriteFacing[] = ['S', 'E'];

/** One row of the M1 Kindled animation table (sprites.md §4). */
export interface KindledAnimSpec {
  name: string;
  frames: number;
  /** 0 for a single held frame. */
  fps: number;
  loop: boolean;
  hold: boolean;
  facings: readonly SpriteFacing[];
}

const spec = (
  name: string,
  frames: number,
  fps: number,
  loop: boolean,
  hold: boolean,
  facings: readonly SpriteFacing[] = SPRITE_FACINGS,
): KindledAnimSpec => ({ name, frames, fps, loop, hold, facings });

/** The M1 Kindled animations every `kindled-<remembrance>` sheet must carry, per facing. */
export const KINDLED_ANIMS: readonly KindledAnimSpec[] = [
  spec('idle', 2, 2, true, false),
  spec('walk', 6, 10, true, false),
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
  spec('carry_idle', 2, 2, true, false, SPRITE_FACINGS_4),
  spec('carry_walk', 6, 10, true, false, SPRITE_FACINGS_4),
  spec('sit', 1, 0, false, true, SPRITE_FACINGS_2),
];

/** The Husk animations (no facings) per kind, as the sheets must carry them. */
export const HUSK_ANIMS: Readonly<Record<'peeling' | 'nutshell', readonly string[]>> = {
  peeling: ['spawn', 'idle', 'telegraph', 'lunge', 'hit', 'chipped', 'death', 'drop'],
  nutshell: ['spawn', 'idle', 'walk', 'telegraph', 'slam', 'hit', 'chipped_outer', 'chipped_inner', 'regrow', 'death', 'drop'],
};

/** True for a Kindled sheet (`kindled-<remembrance>`), which has facings and a palette block. */
export function isKindledSheet(name: string): boolean {
  return name.startsWith('kindled-');
}

/** True for a sheet on the v2 contract (option B art, `meta.version` "2"). */
export function isV2Sheet(sheet: SpriteSheet): boolean {
  return sheet.meta.version === '2';
}

/** The v2 cell spec of a sheet by its name: the Kindled's, or every other kind's. */
export function spriteCellSpecFor(name: string): SpriteCellSpec {
  return isKindledSheet(name) ? SPRITE_CELLS.kindled : SPRITE_CELLS.other;
}

/** World px per sheet px: a v2 sheet's `meta.pixelScale` (1), a v1 sheet's legacy 2. */
export function sheetPixelScale(sheet: SpriteSheet): number {
  return isV2Sheet(sheet) ? (sheet.meta.pixelScale ?? 1) : LEGACY_PIXEL_SCALE;
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
