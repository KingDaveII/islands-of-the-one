/**
 * Design-system color tokens (art direction, not balance data). Every color
 * the client draws comes from here. See docs/design/readability.md.
 *
 * Reserved signal colors, used for nothing else anywhere:
 * - `signalHit` (#FFFFFF, the only pure white): a struck target for 1-2 frames.
 * - `signalTelegraph` / `signalTelegraphDark`: enemy wind-ups and attack decals.
 * - `sparkGlow` (#FFE7A3): the perfect-dodge afterimage trail (with a 1 px
 *   `hollowDeep` outline). Places the design system would light in spark-glow
 *   (ready frames, full charge, broken poise) use `sparkAmber` / `hollowLight`.
 */
export const Tokens = {
  hollowLight: 0xf4efe6,
  hollowLavender: 0xd9d2e9,
  hollowDusk: 0xa99fc4,
  hollowBelow: 0x5b5478,
  hollowDeep: 0x2a2540,
  sparkGlow: 0xffe7a3,
  sparkAmber: 0xf2b65a,
  sparkEmber: 0xc9733a,
  sleeperFlesh: 0xc98f78,
  sleeperOchre: 0x9c5b4a,
  sleeperSoil: 0xe3c29e,
  unwrittenTar: 0x5e5448,
  huskShell: 0xe8e2d6,
  huskCore: 0xfff4c7,
  choirFlame: 0xf07a3a,
  choirFlameDeep: 0xb5402e,
  dreamNight: 0x1c2147,
  signalHit: 0xffffff,
  signalTelegraph: 0xe0457b,
  signalTelegraphDark: 0x8e2550,
} as const;

const T = Tokens;

/** Role names used by the renderer and UI. */
export const Palette = {
  // World
  hollow: T.hollowDeep, // the Hollow around a room
  floor: T.hollowLavender,
  floorFleck: T.hollowLight,
  floorEdge: T.hollowDusk,
  wall: T.hollowBelow,
  wallLine: T.hollowDeep,
  wallTop: T.hollowDeep,
  ground: T.hollowDeep,
  // Kindled (player, Clay Remembrance): the darkest outline in the room.
  playerOutline: T.dreamNight,
  playerShirt: T.sleeperOchre,
  playerSkin: T.sleeperFlesh,
  playerHair: T.unwrittenTar,
  playerTrousers: T.hollowBelow,
  blade: T.hollowLight,
  // Husks
  huskOutline: T.hollowDeep,
  shell: T.huskShell,
  shellShade: T.hollowLavender,
  shellCrack: T.hollowBelow,
  core: T.huskCore,
  coreRing: T.hollowDeep,
  // Sparkglass
  spark: T.sparkAmber,
  sparkDeep: T.sparkEmber,
  // Signals (reserved)
  hit: T.signalHit,
  telegraph: T.signalTelegraph,
  telegraphDark: T.signalTelegraphDark,
  trail: T.sparkGlow,
  trailOutline: T.hollowDeep,
  // UI
  uiPanel: T.hollowDeep,
  uiBevel: T.hollowBelow,
  uiOutline: T.dreamNight,
  uiRim: T.sparkAmber,
  uiInk: T.hollowLight,
  uiInkMuted: T.hollowDusk,
  uiInkOnGlow: T.hollowDeep,
  uiFocus: T.sparkAmber,
  healthFill: T.hollowLight,
  healthShade: T.hollowLavender,
  healthLoss: T.sparkEmber,
  healthLow: T.choirFlameDeep,
  poiseFill: T.hollowLavender,
  poiseTrack: T.hollowBelow,
  hurt: T.sparkEmber,
  rarity: [T.hollowLavender, T.hollowLight, T.sparkAmber, T.sparkEmber, T.choirFlameDeep],
} as const;

export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
