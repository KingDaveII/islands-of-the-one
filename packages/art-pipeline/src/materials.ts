import { TOKENS } from './colour.js';

/**
 * The style sheet's material rows (art/anchors/style-sheet.md, "Colour", the
 * table of materials light → dark), as data: which ramps each whitelist token
 * belongs to. The report names a snap target's ramp from here, so ART can see
 * a grey that snapped into the skin or the shell instead of the steel. When
 * the style sheet's table changes, change this with it (the test reads the
 * style sheet and fails when the two disagree).
 */
export const MATERIALS: readonly { row: string; short: string; tokens: readonly string[] }[] = [
  { row: 'Outline, player only', short: 'player outline', tokens: ['dream-night'] },
  { row: 'Outline, everyone else', short: 'outline', tokens: ['hollow-deep'] },
  {
    row: 'Clay skin (grey-ochre) + freckles',
    short: 'skin',
    tokens: ['unwritten-sail', 'unwritten-tar', 'spark-amber'],
  },
  { row: 'Soot cloth', short: 'cloth', tokens: ['watcher-stone', 'watcher-iron', 'hollow-deep'] },
  { row: 'Ember singe', short: 'ember', tokens: ['choir-flame', 'spark-ember', 'sleeper-ochre'] },
  {
    row: 'Fired red clay',
    short: 'red clay',
    tokens: ['sleeper-soil', 'sleeper-flesh', 'sleeper-ochre'],
  },
  {
    row: 'Brass and gold',
    short: 'brass',
    tokens: ['choir-gold', 'wheel-brass', 'wheel-brass-dark'],
  },
  {
    row: 'Bronze, wood, rope, leather',
    short: 'leather',
    tokens: ['watcher-bronze', 'wheel-brass-dark', 'hollow-deep'],
  },
  {
    row: 'Pale shell (Husks) + core',
    short: 'shell',
    tokens: ['hollow-light', 'husk-shell', 'hollow-dusk', 'husk-core', 'hollow-deep'],
  },
  {
    row: 'Stone, floor, wall',
    short: 'stone',
    tokens: ['hollow-lavender', 'hollow-dusk', 'hollow-below', 'hollow-deep'],
  },
  {
    row: 'Water, patina, rain',
    short: 'water',
    tokens: ['wheel-patina', 'watcher-rain', 'sleeper-night'],
  },
  {
    row: 'Paper, eye-white, night',
    short: 'paper',
    tokens: ['choir-paper', 'wheel-eye', 'dream-night'],
  },
  {
    row: 'Steel (the Hookblade, metal edges)',
    short: 'steel',
    tokens: ['husk-shell', 'watcher-stone', 'watcher-iron'],
  },
  {
    row: 'Dark hair (everyone but the player)',
    short: 'hair',
    tokens: ['hollow-below', 'hollow-deep', 'sleeper-night'],
  },
  { row: 'Flame (Choirs, fire)', short: 'flame', tokens: ['choir-flame', 'choir-flame-deep'] },
];

const byHex = new Map<string, string[]>();
for (const m of MATERIALS) {
  for (const token of m.tokens) {
    const hex = TOKENS.find((t) => t.name === token)?.hex;
    if (hex) byHex.set(hex, [...(byHex.get(hex) ?? []), m.short]);
  }
}

/** The short names of the materials a colour is a ramp step of, in the style sheet's order (none for a non-token). */
export function materialsOf(hex: string): readonly string[] {
  return byHex.get(hex) ?? [];
}
