/** Art palette (colors are art direction, not balance data). */
export const Palette = {
  // Hollow violet
  floor: 0x5b5478,
  floorLine: 0x544d70,
  wall: 0x2a2540,
  wallEdge: 0x3a3354,
  void: 0x1a1628,
  // Warm sailcloth (player)
  sail: 0xead9b6,
  sailShade: 0xc79d6a,
  sailDark: 0x7d5236,
  blade: 0xfff8ea,
  // Husks
  pearl: 0xe8e2d6,
  core: 0xfff4c7,
  // Sparkglass
  spark: 0xffe7a3,
  sparkDeep: 0xf2b65a,
  // UI / feedback
  ink: 0x14111f,
  white: 0xffffff,
  danger: 0xff6b5a,
  telegraph: 0xffd2a8,
  hpFill: 0xe56b6f,
  hpBack: 0x3a2236,
  locked: 0x6f6788,
} as const;

export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
