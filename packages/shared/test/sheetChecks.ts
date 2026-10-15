import {
  hexOf,
  isKindledSheet,
  paletteData,
  SPRITE_WHITELIST,
  spriteCellSpecFor,
  type SpriteSheet,
} from '../src/index.js';

/** A decoded RGBA image (png.ts). */
export interface Rgba {
  width: number;
  height: number;
  rgba: Uint8Array;
}

const WHITELIST = new Set(SPRITE_WHITELIST);
const TELEGRAPH = new Set(paletteData.signals.telegraph.map((h) => h.toLowerCase()));
const NEVER = new Set([paletteData.signals.hit, paletteData.tokens['spark-glow']].map((h) => h.toLowerCase()));

const alphaAt = (img: Rgba, x: number, y: number): number => img.rgba[(y * img.width + x) * 4 + 3] ?? 0;
const hexAt = (img: Rgba, x: number, y: number): string => {
  const i = (y * img.width + x) * 4;
  return hexOf(img.rgba[i] ?? 0, img.rgba[i + 1] ?? 0, img.rgba[i + 2] ?? 0);
};

/**
 * What breaks the v2 contract (docs/design/sprites.md §2, §5, §6) in a sheet
 * and its PNG (and its skin mask, for a sheet with a palette block): the
 * cell and origin of its kind, `meta.pixelScale` 1, nothing on a cell's
 * outer 1 px ring, only the whitelist's colours (the telegraph colours in
 * `telegraph*` frames only, #FFFFFF and #FFE7A3 nowhere), and a mask the
 * size of the sheet, opaque only over swap-key colours, covering every key.
 * An empty list is a sheet that passes.
 */
export function v2Problems(name: string, sheet: SpriteSheet, png: Rgba, mask: Rgba | null): string[] {
  const problems: string[] = [];
  const spec = spriteCellSpecFor(name);
  const { cell, origin } = sheet.meta;
  if (sheet.meta.version !== '2') problems.push(`meta.version is ${sheet.meta.version}, not "2"`);
  if (cell.w !== spec.cell.w || cell.h !== spec.cell.h)
    problems.push(`cell ${cell.w}×${cell.h}, not ${spec.cell.w}×${spec.cell.h}`);
  if (origin.x !== spec.origin.x || origin.y !== spec.origin.y)
    problems.push(`origin (${origin.x}, ${origin.y}), not (${spec.origin.x}, ${spec.origin.y})`);
  if (sheet.meta.pixelScale !== 1) problems.push(`meta.pixelScale is ${String(sheet.meta.pixelScale)}, not 1`);

  const offList = new Set<string>();
  const never = new Set<string>();
  const ring = new Set<string>();
  const telegraphOutside = new Set<string>();
  for (const [frameName, f] of Object.entries(sheet.frames)) {
    const r = f.frame;
    for (let y = r.y; y < r.y + r.h && y < png.height; y++) {
      for (let x = r.x; x < r.x + r.w && x < png.width; x++) {
        if (alphaAt(png, x, y) === 0) continue;
        if (x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1) ring.add(frameName);
        const hex = hexAt(png, x, y);
        if (NEVER.has(hex)) never.add(hex);
        else if (TELEGRAPH.has(hex)) {
          if (!frameName.startsWith('telegraph')) telegraphOutside.add(frameName);
        } else if (!WHITELIST.has(hex)) offList.add(hex);
      }
    }
  }
  if (ring.size) problems.push(`opaque pixels on the outer 1 px ring (clipped?): ${[...ring].join(', ')}`);
  if (offList.size) problems.push(`colours outside the whitelist: ${[...offList].join(', ')}`);
  if (never.size) problems.push(`colours never allowed in a sheet: ${[...never].join(', ')}`);
  if (telegraphOutside.size) problems.push(`telegraph colours outside telegraph frames: ${[...telegraphOutside].join(', ')}`);

  const palette = sheet.palette;
  if (isKindledSheet(name) && !palette) problems.push('a Kindled sheet without a palette block');
  if (!palette) return problems;
  if (palette.mask !== `${name}.skin.png`) problems.push(`palette.mask is ${String(palette.mask)}, not ${name}.skin.png`);
  if (!mask) return [...problems, 'no skin mask'];
  if (mask.width !== png.width || mask.height !== png.height) {
    return [...problems, `mask ${mask.width}×${mask.height}, sheet ${png.width}×${png.height}`];
  }
  const keys = new Set(Object.values(palette.swaps).flatMap((s) => Object.keys(s).map((k) => k.toLowerCase())));
  const covered = new Set<string>();
  let stray = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (alphaAt(mask, x, y) === 0) continue;
      const hex = hexAt(png, x, y);
      if (alphaAt(png, x, y) === 0 || !keys.has(hex)) stray++;
      else covered.add(hex);
    }
  }
  if (stray) problems.push(`${stray} masked pixels are not a swap-key colour`);
  const missing = [...keys].filter((k) => !covered.has(k));
  if (missing.length) problems.push(`swap keys with no masked pixel: ${missing.join(', ')}`);
  return problems;
}
