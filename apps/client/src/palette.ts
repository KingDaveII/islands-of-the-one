import { paletteData, type PaletteToken } from '@iot/shared';

/**
 * Design-system color tokens (art direction, not balance data), read from
 * packages/shared/data/palette.json (the design system's 32 raw colours, the
 * same list the sprite sheets are checked against; the client names the ones
 * it draws with). Every color the client draws comes from here. See
 * docs/design/readability.md.
 *
 * Reserved signal colors, used for nothing else anywhere:
 * - `signalHit` (#FFFFFF, the only pure white): a struck target for 1-2 frames.
 * - `signalTelegraph` / `signalTelegraphDark`: enemy wind-ups and attack decals.
 * - `sparkGlow` (#FFE7A3): the perfect-dodge afterimage trail (with a 1 px
 *   `hollowDeep` outline). Places the design system would light in spark-glow
 *   (ready frames, full charge, broken poise) use `sparkAmber` / `hollowLight`.
 */
const hex = (token: PaletteToken): number => parseInt(paletteData.tokens[token].slice(1), 16);

export const Tokens = {
  hollowLight: hex('hollow-light'),
  hollowLavender: hex('hollow-lavender'),
  hollowDusk: hex('hollow-dusk'),
  hollowBelow: hex('hollow-below'),
  hollowDeep: hex('hollow-deep'),
  sparkGlow: hex('spark-glow'),
  sparkAmber: hex('spark-amber'),
  sparkEmber: hex('spark-ember'),
  sleeperFlesh: hex('sleeper-flesh'),
  sleeperOchre: hex('sleeper-ochre'),
  sleeperSoil: hex('sleeper-soil'),
  unwrittenTar: hex('unwritten-tar'),
  unwrittenSail: hex('unwritten-sail'),
  huskShell: hex('husk-shell'),
  huskCore: hex('husk-core'),
  choirFlame: hex('choir-flame'),
  choirFlameDeep: hex('choir-flame-deep'),
  dreamNight: hex('dream-night'),
  signalHit: hex('signal-hit'),
  signalTelegraph: hex('signal-telegraph'),
  signalTelegraphDark: hex('signal-telegraph-dark'),
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
  // Hookblade FX (hookblade-fx sheet, tinted at draw time)
  chain: T.hollowLight,
  chainOutline: T.dreamNight,
  chainTaut: T.sparkAmber,
  chargeSpark: T.sparkAmber,
  chargeSparkFull: T.huskCore,
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
  /** Damage numbers over the world: choir-flame reads 5.6:1 against the text outline, where spark-ember is 4.4:1. */
  hurtInk: T.choirFlame,
  // Writ letters (Old Letters), one color per letter state.
  writLit: T.hollowLight,
  writDim: T.hollowDusk,
  writDark: T.hollowBelow,
  writEmber: T.sparkEmber,
  rarity: [T.hollowLavender, T.hollowLight, T.sparkAmber, T.sparkEmber, T.choirFlameDeep],
} as const;

export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
