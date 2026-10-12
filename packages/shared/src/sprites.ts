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
 */

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
}

/** Palette swaps: the drawn tone's hex values → each other tone's. */
export interface SpritePalette {
  drawn: string;
  swaps: Record<string, Record<string, string>>;
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
  spec('haul_pull', 2, 12, true, false),
  spec('haul_slide', 2, 12, true, false),
  spec('hit', 1, 0, false, true, SPRITE_FACINGS_4),
  spec('death', 6, 8, false, true, SPRITE_FACINGS_4),
  spec('carry_idle', 2, 2, true, false, SPRITE_FACINGS_4),
  spec('carry_walk', 6, 10, true, false, SPRITE_FACINGS_4),
  spec('sit', 1, 0, false, true, SPRITE_FACINGS_2),
];

/** The Husk animations (no facings) per kind, as the sheets must carry them. */
export const HUSK_ANIMS: Readonly<Record<'peeling' | 'nutshell', readonly string[]>> = {
  peeling: ['idle', 'telegraph', 'lunge', 'hit', 'chipped', 'death', 'drop'],
  nutshell: ['idle', 'telegraph', 'roll', 'hit', 'chipped_outer', 'chipped_inner', 'regrow', 'death', 'drop'],
};

/** True for a Kindled sheet (`kindled-<remembrance>`), which has facings and a palette block. */
export function isKindledSheet(name: string): boolean {
  return name.startsWith('kindled-');
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
