/**
 * Draw order inside a layer (Phaser sorts a layer's children by
 * depth, ties by insertion). Bodies sort among themselves by their feet's y
 * so a Husk in front of the Kindled draws over it.
 */
export const DEPTH = {
  room: 0,
  floor: 1,
  /** Chain links go under the bodies. */
  chain: 2,
  /** The perfect-dodge afterimages (rim, then ink one above). */
  trail: 4,
  bodies: 10,
  /** Added per world pixel of y to a body's depth; keeps every body below the overlays. */
  perPixel: 1e-4,
  /** The debug hitbox shapes (F3). */
  debug: 18,
  /** Hitbox flashes, poise bars, the charge meter, the reticle, the hook head and the charge spark. */
  overlay: 20,
  fx: 30,
  floaters: 31,
  prompt: 40,
  /** The mouse reticle, over everything on the UI camera. */
  cursor: 50,
} as const;
