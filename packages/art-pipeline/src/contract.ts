import {
  propIdleSpec,
  PROP_IDLE,
  SPRITE_CANVAS,
  SPRITE_CELLS,
  SPRITE_FACINGS,
  SPRITE_KINDS,
  spriteSheetSpec,
  type SpriteAnimSpec,
  type SpriteCellSpec,
  type SpriteFacing,
  type SpriteKind,
} from '@iot/shared';

/**
 * What a sheet's kind decides, read from the sprite contract in `@iot/shared`
 * (docs/design/sprites.md §2–§4, `spriteSheetSpec`): the cell, the facings and
 * the animation table a finished sheet must carry. The kind comes from the
 * sheet's name (`kindled-`, `husk-`, `npc-`, `prop-`); a recipe states it too.
 */

export const KINDS = SPRITE_KINDS;
export type Kind = SpriteKind;

export { PROP_IDLE, SPRITE_CANVAS, SPRITE_FACINGS };
export type Facing = SpriteFacing;

/** The kind a sheet name makes, or null for an unknown prefix. */
export function kindOfName(sheet: string): Kind | null {
  try {
    return spriteSheetSpec(sheet).kind;
  } catch {
    return null;
  }
}

export function cellFor(kind: Kind): SpriteCellSpec {
  return kind === 'kindled' ? SPRITE_CELLS.kindled : SPRITE_CELLS.other;
}

/** The cell row the soles go on: the row above the origin. */
export function solesRow(kind: Kind): number {
  return cellFor(kind).origin.y - 1;
}

/** Whether frames of this kind are named per facing (`walk_S_0`) or not (`idle_0`). */
export function hasFacings(kind: Kind): boolean {
  return kind === 'kindled' || kind === 'npc';
}

/** A recipe's own numbers for a prop's `idle`: how many frames, at what rate. */
export interface PropIdle {
  frames: number;
  fps?: number;
}

/**
 * The animation table a finished sheet carries, in the contract's order: the
 * Kindled's, a Husk's, the NPCs', or a prop's `idle` from its recipe. Null when
 * the contract has no table for the sheet yet (a Husk not in `HUSK_TABLES`).
 */
export function sheetTable(
  sheet: string,
  prop: PropIdle | null = null,
): readonly SpriteAnimSpec[] | null {
  const spec = spriteSheetSpec(sheet);
  if (spec.kind === 'prop') return prop ? [propIdleSpec(prop.frames, prop.fps)] : [propIdleSpec(1)];
  return spec.anims;
}

/** The animation names a recipe for this sheet may use, in the contract's order, or null when any name is allowed. */
export function animNames(sheet: string): readonly string[] | null {
  return sheetTable(sheet)?.map((a) => a.name) ?? null;
}

/** The facings an animation may have: its table row's (Kindled, NPCs), none for Husks and props. */
export function facingsFor(sheet: string, anim: string): readonly Facing[] {
  const spec = spriteSheetSpec(sheet);
  if (!spec.facings) return [];
  return spec.anims?.find((a) => a.name === anim)?.facings ?? SPRITE_FACINGS;
}

/** The table row of one animation of a sheet, if the contract has it. */
export function animRow(
  sheet: string,
  anim: string,
  prop: PropIdle | null = null,
): SpriteAnimSpec | undefined {
  return sheetTable(sheet, prop)?.find((a) => a.name === anim);
}

/** idle, walk and carry stand on their own feet per frame; everything else keeps one shift per facing. */
export function defaultGround(anim: string): 'frame' | { ref: number } {
  return ['idle', 'walk', 'carry_idle', 'carry_walk'].includes(anim) ? 'frame' : { ref: 0 };
}

/** The frame name: `<anim>_<FACING>_<n>` with facings, `<anim>_<n>` without. */
export function frameName(anim: string, facing: Facing | null, n: number): string {
  return facing ? `${anim}_${facing}_${n}` : `${anim}_${n}`;
}

/** The anim key: `<anim>_<FACING>` with facings, `<anim>` without. */
export function animKey(anim: string, facing: Facing | null): string {
  return facing ? `${anim}_${facing}` : anim;
}

/** The largest sheet the pipeline writes. */
export const MAX_SHEET = 2048;
