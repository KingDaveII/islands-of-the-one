import {
  HUSK_ANIMS,
  KINDLED_ANIMS,
  SPRITE_CANVAS,
  SPRITE_CELLS,
  SPRITE_FACINGS,
  type KindledAnimSpec,
  type SpriteCellSpec,
  type SpriteFacing,
} from '@iot/shared';

/**
 * What a recipe's `kind` decides, read from the sprite contract in
 * `@iot/shared` (docs/design/sprites.md §2–§4): the cell, the facings and the
 * animation table a finished sheet must carry.
 */

export const KINDS = ['kindled', 'npc', 'enemy', 'prop'] as const;
export type Kind = (typeof KINDS)[number];

export { SPRITE_CANVAS, SPRITE_FACINGS };
export type Facing = SpriteFacing;

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

/**
 * The animation table a non-draft sheet of this kind must carry, or null when
 * the contract has none yet. Only the Kindled's table has frame counts and
 * frame rates in `@iot/shared` today; Husks have names only (`HUSK_ANIMS`) and
 * NPCs and props have nothing (see the PR's "Requests for MAIN").
 */
export function animTable(kind: Kind): readonly KindledAnimSpec[] | null {
  return kind === 'kindled' ? KINDLED_ANIMS : null;
}

/**
 * The animation names a recipe of this kind may use, in the contract's order,
 * or null when any name is allowed (a draft of a kind with no table).
 */
export function animNames(kind: Kind, sheet: string): readonly string[] | null {
  if (kind === 'kindled') return KINDLED_ANIMS.map((a) => a.name);
  if (kind === 'enemy') {
    const husk = sheet.replace(/^husk-/, '');
    if (husk === 'peeling' || husk === 'nutshell') return HUSK_ANIMS[husk];
  }
  return null;
}

/** The facings an animation may have: its row of the table for the Kindled, all 8 for NPCs, none otherwise. */
export function facingsFor(kind: Kind, anim: string): readonly Facing[] {
  if (kind === 'kindled')
    return KINDLED_ANIMS.find((a) => a.name === anim)?.facings ?? SPRITE_FACINGS;
  if (kind === 'npc') return SPRITE_FACINGS;
  return [];
}

/** The table row of an animation by name (the Kindled's table is the only one with numbers). */
export function animSpec(anim: string): KindledAnimSpec | undefined {
  return KINDLED_ANIMS.find((a) => a.name === anim);
}

/** Loops are checked for their seam; the table says which animations loop, by name. */
export function isLooping(anim: string): boolean {
  return animSpec(anim)?.loop ?? false;
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
