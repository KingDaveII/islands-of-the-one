import { huskParams, SUB, type HuskKind, type Params } from '@iot/sim';
import { DEPTH } from './depth.js';
import { snapToArt } from './scale.js';

/**
 * Where a sprite stands: its origin is the point between the feet, while the
 * sim's position is the body center. The feet come from sim units (×2 in
 * world px at the render boundary), never from a sheet's cell geometry, so a
 * v2 sheet drops in without moving anyone: the Kindled's are 5 sim px below
 * the center (the 16x24 body, docs/design/readability.md); a Husk's are its
 * radius below, where its grounding shadow sits.
 */
export const PLAYER_FEET = 5;

/** A Husk's feet below its body center, sim px: its radius. */
export function huskFeet(P: Params, kind: HuskKind): number {
  return Math.round(huskParams(P, kind).radius / SUB);
}

/**
 * What stands in the bodies layer and y-sorts by its ground line (G1.5h):
 * the Kindled, a Husk (its radius from the run's params) or a chest.
 */
export type Body =
  | { kind: 'kindled' }
  | { kind: 'husk'; husk: HuskKind; P: Params }
  | { kind: 'chest' }
  /** A holding station's prop (M2 Task 3b): its base, like a chest's. */
  | { kind: 'prop' };

/**
 * On the same ground line the order is today's, from under to over: a Husk,
 * then the Kindled, then a chest. So the Kindled still draws over a Husk
 * whose feet are on its line, and a chest over a Kindled whose feet are on
 * its base. Fractions of a world px, so a rank never outweighs a real
 * difference in the line.
 */
const TIE_ORDER: Readonly<Record<Body['kind'], number>> = { husk: 0, kindled: 1, chest: 2, prop: 2 };

/**
 * The line a body stands on, in sim px, from its sim y (the body centre):
 * the Kindled's feet (`PLAYER_FEET` below), a Husk's feet (its radius below,
 * the same `huskFeet` that places it), a chest's position, which is already
 * its base. The one sort key of the bodies layer: a body in front of another
 * on the floor draws over it, whatever their heights.
 */
export function groundLine(body: Body, simY: number): number {
  switch (body.kind) {
    case 'kindled':
      return simY + PLAYER_FEET;
    case 'husk':
      return simY + huskFeet(body.P, body.husk);
    case 'chest':
    case 'prop':
      return simY;
  }
}

/**
 * A body's depth in the bodies layer: `DEPTH.bodies` plus its ground line in
 * whole world px (the row its sprite is drawn on, `snapToArt`) per
 * `DEPTH.perPixel`, plus the tie rank for bodies drawn on the same row. Draw
 * order only; it moves no sprite.
 */
export function bodyDepth(body: Body, simY: number): number {
  return (
    DEPTH.bodies + (snapToArt(groundLine(body, simY)) + TIE_ORDER[body.kind] / 4) * DEPTH.perPixel
  );
}
