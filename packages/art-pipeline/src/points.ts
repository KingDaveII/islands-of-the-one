import { KINDLED_POINTS, spritePointsFor, type KindledPoint } from '@iot/shared';
import { cellFor, frameName, SPRITE_FACINGS, type Facing } from './contract.js';
import { PipelineError } from './errors.js';
import type { FrameSource, Recipe } from './recipe.js';

/**
 * Named points (sprites.md §5, the recipe's `points`): where a frame's hook
 * tip or throwing hand is, in that frame's source pixels. Each point moves
 * with its frame (the same `flipX`, horizontal centring and `ground` shift),
 * so the sheet stores it in cell pixels. A facing built with `flipX` from
 * another facing's files inherits that facing's points, mirrored, unless it
 * lists its own.
 */

/** A point of a built frame: where it is in the cell, and where it came from. */
export interface PlacedPoint {
  /** In the cell. */
  x: number;
  y: number;
  /** In the frame's source pixels (after any downscale and `flipX`). */
  source: [number, number];
  /** The unmirrored frame it was inherited from, mirrored; absent when the recipe lists it for this frame. */
  from?: string;
}

export type FramePoints = Partial<Record<KindledPoint, PlacedPoint>>;

/** One frame being built: what the points step needs to know about it. */
export interface PointFrame {
  name: string;
  anim: string;
  facing: Facing | null;
  /** Its position in the recipe's `frames`, and the source frame index there (`frames[n]`). */
  n: number;
  index: number;
  source: FrameSource;
  /** The source frame's size, after any downscale. */
  w: number;
  h: number;
  /** Where the source frame's (0, 0) landed in the cell (step 8). */
  dx: number;
  dy: number;
}

/**
 * The unmirrored twin of a `flipX` frame: the first facing (in sheet order)
 * of the same animation that reads the same files unmirrored and lists the
 * same source frame (at the same position, where it repeats). Null when there
 * is none.
 */
export function mirrorTwin(recipe: Recipe, f: PointFrame): string | null {
  if (!f.source.flipX || !f.facing) return null;
  const facings = recipe.anims[f.anim]?.facings ?? {};
  for (const g of SPRITE_FACINGS) {
    const s = facings[g];
    if (!s || g === f.facing || s.flipX || s.src !== f.source.src) continue;
    if ((s.downscale ?? 1) !== (f.source.downscale ?? 1)) continue;
    // The same position when it reads the same source frame (a repeated index), else the first that does.
    const n = s.frames[f.n] === f.index ? f.n : s.frames.indexOf(f.index);
    if (n >= 0) return frameName(f.anim, g, n);
  }
  return null;
}

/**
 * The points of one frame, placed in its cell: the recipe's own, else (for a
 * `flipX` frame) its twin's mirrored. Fails on a point outside the source
 * frame (the recipe's coordinates are wrong) or one that lands outside the
 * cell or on its outer 1 px ring.
 */
export function placePoints(recipe: Recipe, f: PointFrame): FramePoints {
  const file = `art/sheets/${recipe.sheet}.json`;
  const out: FramePoints = {};
  const problems: string[] = [];
  const { cell } = cellFor(recipe.sheet);
  for (const point of KINDLED_POINTS) {
    const listed = recipe.points[point] ?? {};
    let source = listed[f.name];
    let from: string | undefined;
    if (source) {
      const [x, y] = source;
      if (x >= f.w || y >= f.h) {
        problems.push(
          `${file}: points.${point}.${f.name} [${x}, ${y}] is outside the ${f.w}×${f.h} source frame`,
        );
        continue;
      }
    } else {
      const twin = mirrorTwin(recipe, f);
      const own = twin ? listed[twin] : undefined;
      if (!twin || !own) continue;
      // The twin's coordinates are checked against the same files when the twin is built.
      source = [f.w - 1 - own[0], own[1]];
      from = twin;
    }
    const x = source[0] + f.dx;
    const y = source[1] + f.dy;
    if (x <= 0 || y <= 0 || x >= cell.w - 1 || y >= cell.h - 1) {
      problems.push(
        `${f.name}: points.${point}${from ? ` (mirrored from ${from})` : ''} at source (${source[0]}, ${source[1]}) ` +
          `lands at (${x}, ${y}), outside the ${cell.w}×${cell.h} cell or on its outer 1 px ring`,
      );
      continue;
    }
    out[point] = from ? { x, y, source, from } : { x, y, source };
  }
  if (problems.length) throw new PipelineError(problems);
  return out;
}

/** Every required point a built frame lacks (`spritePointsFor`), as messages. */
export function missingPoints(
  recipe: Recipe,
  frames: readonly { name: string; anim: string; points: FramePoints }[],
): string[] {
  const out: string[] = [];
  for (const f of frames) {
    for (const point of spritePointsFor(recipe.sheet, f.anim)) {
      if (!f.points[point])
        out.push(`${recipe.sheet}: ${f.name} has no ${point} point (points.${point}.${f.name})`);
    }
  }
  return out;
}
