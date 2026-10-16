import {
  hexOf,
  isKindledPoint,
  isRequiredAnim,
  isV2Sheet,
  kindledAnimKey,
  kindledFrameName,
  optionalReason,
  paletteData,
  propFrameRangeProblem,
  REQUIRED_MILESTONE,
  SPRITE_FACINGS,
  SPRITE_WHITELIST,
  spritePointsFor,
  spriteSheetSpec,
  type SpriteAnimSpec,
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
  const kind = spriteSheetSpec(name);
  const spec = kind.cell;
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
  if (kind.palette && !palette) problems.push('a Kindled sheet without a palette block');
  if (!kind.palette && palette) problems.push(`a palette block on a ${kind.kind} sheet (only Kindled sheets have one)`);
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

/**
 * What breaks a finished sheet's animation table (sprites.md §4): `table` is
 * its kind's (`spriteSheetSpec`, or a prop's resolved by `propTableFor`).
 * Every row at or before `REQUIRED_MILESTONE` is there in every facing, with
 * its frames in order and its rate, loop and hold; a recipe-rated row
 * (`fromRecipe`) has a frame count in its range. A later row is optional, but
 * once any facing of it is there it is complete like the others. Nothing
 * outside the table. An empty list is a sheet that passes.
 */
export function tableProblems(name: string, sheet: SpriteSheet, table: readonly SpriteAnimSpec[]): string[] {
  const problems: string[] = [];
  const facings = spriteSheetSpec(name).facings;
  const keys: string[] = [];
  for (const a of table) {
    const rowKeys = (facings ? a.facings : [null]).map((f) => [f, f ? kindledAnimKey(a.name, f) : a.name] as const);
    const required = isRequiredAnim(a);
    if (!required && rowKeys.every(([, key]) => !sheet.anims[key])) continue;
    for (const [facing, key] of rowKeys) {
      keys.push(key);
      const def = sheet.anims[key];
      if (!def) {
        problems.push(
          required
            ? `${key} is missing`
            : `${key} is missing (${a.name} is ${optionalReason(a)}, but complete once present; required: ${REQUIRED_MILESTONE})`,
        );
        continue;
      }
      const range = a.fromRecipe ? propFrameRangeProblem(a.fromRecipe, def.frames.length) : null;
      if (range) {
        problems.push(`${key} has ${def.frames.length} frames; ${range}`);
        continue;
      }
      const frames = Array.from({ length: a.frames }, (_, i) => (facing ? kindledFrameName(a.name, facing, i) : `${a.name}_${i}`));
      if (JSON.stringify(def.frames) !== JSON.stringify(frames))
        problems.push(`${key} has frames ${def.frames.join(', ')}; the table says ${frames.join(', ')}`);
      if (def.repeat !== (a.loop ? -1 : 0)) problems.push(`${key} has repeat ${def.repeat}; the table says ${a.loop ? -1 : 0}`);
      if ((def.hold ?? false) !== a.hold) problems.push(`${key} has hold ${String(def.hold ?? false)}; the table says ${String(a.hold)}`);
      if (a.fps > 0 && def.frameRate !== a.fps) problems.push(`${key} runs at ${def.frameRate} fps; the table says ${a.fps}`);
    }
  }
  const outside = Object.keys(sheet.anims).filter((k) => !keys.includes(k));
  if (outside.length) problems.push(`animations outside the table: ${outside.sort().join(', ')}`);
  return problems;
}

/** The animation each frame belongs to, from the `anims` block (`walk_S` → `walk` on a sheet with facings). */
function animOfFrames(name: string, sheet: SpriteSheet): Map<string, string> {
  const facings = spriteSheetSpec(name).facings;
  const out = new Map<string, string>();
  for (const [key, def] of Object.entries(sheet.anims)) {
    const facing = facings ? SPRITE_FACINGS.find((f) => key.endsWith(`_${f}`)) : undefined;
    const anim = facing ? key.slice(0, -facing.length - 1) : key;
    for (const frame of def.frames) out.set(frame, anim);
  }
  return out;
}

/**
 * What breaks the points rules (sprites.md §5, §6): a v1 sheet has none; on a
 * v2 sheet every point is a known name (`KINDLED_POINTS`), on a frame whose
 * animation carries it (`spritePointsFor`), a whole pixel inside the cell and
 * off its outer 1 px ring; and a `finished` sheet has every required point on
 * every frame of the animations that carry one. An empty list is a sheet that
 * passes.
 */
export function pointProblems(name: string, sheet: SpriteSheet, finished = true): string[] {
  const problems: string[] = [];
  const withPoints = Object.entries(sheet.frames).filter(([, f]) => f.points !== undefined);
  if (!isV2Sheet(sheet)) {
    if (withPoints.length) problems.push(`points on a v1 sheet: ${withPoints.map(([n]) => n).join(', ')}`);
    return problems;
  }
  const animOf = animOfFrames(name, sheet);
  const { w, h } = sheet.meta.cell;
  for (const [frame, f] of withPoints) {
    const allowed = spritePointsFor(name, animOf.get(frame) ?? '');
    for (const [point, at] of Object.entries(f.points ?? {})) {
      if (!isKindledPoint(point)) {
        problems.push(`${frame}: unknown point "${point}"`);
        continue;
      }
      if (!allowed.includes(point)) {
        problems.push(`${frame}: a ${point} point, but its animation carries ${allowed.length ? allowed.join(', ') : 'no points'}`);
        continue;
      }
      const [x, y] = at;
      if (at.length !== 2 || !Number.isInteger(x) || !Number.isInteger(y)) {
        problems.push(`${frame}: ${point} is ${JSON.stringify(at)}, not [x, y] in whole pixels`);
        continue;
      }
      if (x === undefined || y === undefined || x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1)
        problems.push(`${frame}: ${point} at (${String(x)}, ${String(y)}) is outside the ${w}×${h} cell or on its outer 1 px ring`);
    }
  }
  if (finished) {
    for (const frame of Object.keys(sheet.frames)) {
      for (const point of spritePointsFor(name, animOf.get(frame) ?? '')) {
        if (sheet.frames[frame]?.points?.[point] === undefined) problems.push(`${frame} has no ${point} point`);
      }
    }
  }
  return problems;
}

/**
 * What breaks an untinted engine sheet's colours (sprites.md "Engine sheets"):
 * it is checked like a v2 sprite, so only the 28-colour whitelist, no
 * telegraph colours (it has no telegraph frames), #FFFFFF and #FFE7A3 nowhere,
 * and no soft alpha. An empty list is a sheet that passes.
 */
export function engineColourProblems(png: Rgba): string[] {
  const offList = new Set<string>();
  const never = new Set<string>();
  const telegraph = new Set<string>();
  let soft = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const a = alphaAt(png, x, y);
      if (a === 0) continue;
      if (a !== 255) soft++;
      const hex = hexAt(png, x, y);
      if (NEVER.has(hex)) never.add(hex);
      else if (TELEGRAPH.has(hex)) telegraph.add(hex);
      else if (!WHITELIST.has(hex)) offList.add(hex);
    }
  }
  const problems: string[] = [];
  if (offList.size) problems.push(`colours outside the whitelist: ${[...offList].join(', ')}`);
  if (never.size) problems.push(`colours never allowed in a sheet: ${[...never].join(', ')}`);
  if (telegraph.size) problems.push(`telegraph colours (only Husk telegraph frames may use them): ${[...telegraph].join(', ')}`);
  if (soft) problems.push(`${soft} pixels with an alpha other than 0 or 255`);
  return problems;
}
