/**
 * Draw order inside a layer (Phaser sorts a layer's children by
 * depth, ties by insertion). Bodies sort among themselves by the line they
 * stand on (`bodyDepth`, feet.ts: the Kindled's and a Husk's feet, a chest's
 * base) so a body in front of another on the floor draws over it.
 */
export const DEPTH = {
  room: 0,
  /** The tile room's doors (roomTiles.ts), over its texture and under the floor decals. */
  roomDoors: 0.5,
  floor: 1,
  /** The Sparkglass pickups from their prop sheet (pickupSprites.ts): over the floor decals and shadows, under the chain. */
  pickups: 1.5,
  /** Chain links go under the bodies. */
  chain: 2,
  /** The perfect-dodge afterimages (rim, then ink one above). */
  trail: 4,
  bodies: 10,
  /** Added per world pixel of a body's ground line to its depth (`bodyDepth`); keeps every body below the overlays. */
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
