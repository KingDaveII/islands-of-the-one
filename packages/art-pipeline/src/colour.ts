import { paletteData, SPRITE_WHITELIST } from '@iot/shared';

/**
 * The colours the pipeline reasons about, all read from palette.json through
 * `@iot/shared`: the 32 tokens in file order, the 28-colour whitelist, the
 * signal colours and the roles the steps use (outline, skin, freckle).
 */

const lower = (h: string): string => h.toLowerCase();

/** The 32 tokens in palette.json's order, lowercase. */
export const TOKENS: readonly { name: string; hex: string }[] = Object.entries(
  paletteData.tokens,
).map(([name, hex]) => ({
  name,
  hex: lower(hex),
}));

const tokenName = new Map(TOKENS.map((t) => [t.hex, t.name]));
/** "name #hex" for a token, or the bare hex for anything else. */
export function describeHex(hex: string): string {
  const name = tokenName.get(hex);
  return name ? `${name} ${hex}` : hex;
}

export const TELEGRAPH: readonly string[] = paletteData.signals.telegraph.map(lower);
export const WHITELIST: readonly string[] = SPRITE_WHITELIST;
/** Whitelist plus the two telegraph colours, in palette.json order: what a `telegraph*` frame snaps to. */
export const WHITELIST_TELEGRAPH: readonly string[] = TOKENS.map((t) => t.hex).filter(
  (h) => WHITELIST.includes(h) || TELEGRAPH.includes(h),
);

/** Colours whose nearest token fails the build anywhere: the hit flash and the perfect-dodge glow. */
export const NEVER: readonly string[] = [
  lower(paletteData.signals.hit),
  lower(paletteData.tokens['spark-glow']),
];

const T = paletteData.tokens;
export const DREAM_NIGHT = lower(T['dream-night']);
export const HOLLOW_DEEP = lower(T['hollow-deep']);
export const SLEEPER_NIGHT = lower(T['sleeper-night']);
/** Edge pixels in these colours are outline and take the role's outline colour. */
export const OUTLINE_SET: readonly string[] = [DREAM_NIGHT, HOLLOW_DEEP, SLEEPER_NIGHT];
export const FRECKLE = lower(T['spark-amber']);

const drawnTone =
  paletteData.clay.tones[paletteData.clay.drawn as keyof typeof paletteData.clay.tones];
/** The drawn clay tone's skin and shade: unwritten-sail and unwritten-tar. */
export const SKIN = lower(drawnTone.skin);
export const SKIN_SHADE = lower(drawnTone.shade);

/** The review backgrounds: the floor and the wall face. */
export const FLOOR = lower(T['hollow-lavender']);
export const WALL = lower(T['hollow-below']);

const labMemo = new Map<string, readonly [number, number, number]>();

/** OKLab of an sRGB "#rrggbb" colour (Björn Ottosson's matrices). */
export function oklab(hex: string): readonly [number, number, number] {
  let hit = labMemo.get(hex);
  if (!hit) {
    hit = toOklab(hex);
    labMemo.set(hex, hit);
  }
  return hit;
}

function toOklab(hex: string): readonly [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((v >> 16) & 0xff);
  const g = lin((v >> 8) & 0xff);
  const b = lin(v & 0xff);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** ΔE in OKLab: Euclidean distance × 100. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

/** Distances are compared at this resolution of ΔE, so float noise never decides a tie. */
const TIE_RESOLUTION = 1e4;

/**
 * The nearest of `candidates` to `hex` in OKLab (Euclidean). Distances equal
 * to 1/10 000 of a ΔE are a tie, and on a tie the earlier candidate wins, so
 * pass candidates in palette.json's order.
 */
export function nearest(hex: string, candidates: readonly string[]): { hex: string; dE: number } {
  let best = candidates[0] ?? hex;
  let bestKey = Infinity;
  let bestDE = Infinity;
  for (const c of candidates) {
    const dE = deltaE(hex, c);
    const key = Math.round(dE * TIE_RESOLUTION);
    if (key < bestKey) {
      best = c;
      bestKey = key;
      bestDE = dE;
    }
  }
  return { hex: best, dE: bestDE };
}

/** A memo of `nearest` per candidate list. */
export function nearestCache(
  candidates: readonly string[],
): (hex: string) => { hex: string; dE: number } {
  const memo = new Map<string, { hex: string; dE: number }>();
  return (hex) => {
    let hit = memo.get(hex);
    if (!hit) {
      hit = nearest(hex, candidates);
      memo.set(hex, hit);
    }
    return hit;
  };
}
