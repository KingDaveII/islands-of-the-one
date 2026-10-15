import { huskParams, SUB, type HuskKind, type Params } from '@iot/sim';

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
