import { isRequiredAnim, optionalReason, paletteData, skinMaskName } from '@iot/shared';
import {
  animKey,
  animNames,
  cellFor,
  defaultGround,
  facingsFor,
  frameName,
  hasFacings,
  MAX_SHEET,
  PROP_IDLE,
  SPRITE_CANVAS,
  SPRITE_FACINGS,
  type Facing,
} from './contract.js';
import { SKIN, SKIN_SHADE } from './colour.js';
import { PipelineError } from './errors.js';
import { blank, blit, hexAt, opaqueAt, opaqueRows, type Img } from './image.js';
import { encodePng } from './png.js';
import { animSources, recipeTable, type Recipe } from './recipe.js';
import { applyRemap, appliesTo, staleRules, staleRuleText, type RemapCounts } from './remap.js';
import { renderContact, renderTones, writeReport, type SheetReport } from './review.js';
import { SourceReader } from './source.js';
import {
  applyFixes,
  checkReserved,
  despeckle,
  outline,
  place,
  skinMask,
  skinProblemText,
  snap,
  type SkinProblem,
} from './steps.js';

/** What one built frame carries: its cell, its mask (Kindled) and the numbers the report shows. */
export interface BuiltFrame {
  name: string;
  anim: string;
  facing: Facing | null;
  n: number;
  source: string;
  /** The source was mirrored left to right (`flipX`). */
  mirrored: boolean;
  cell: Img;
  mask: Img | null;
  offPalette: number;
  maxDeltaE: number;
  /** The off-palette colours the snap moved: source hex → target, ΔE, pixels. */
  moved: Map<string, { to: string; dE: number; pixels: number }>;
  dx: number;
  dy: number;
  shift: number;
  outlineGaps: number;
  interiorDreamNight: number | null;
  despeckled: number | null;
  masked: number | null;
}

/** One animation × facing: an `anims` entry of the sheet and a row of the contact sheet. */
export interface BuiltAnim {
  key: string;
  anim: string;
  facing: Facing | null;
  frames: BuiltFrame[];
}

export interface BuildResult {
  recipe: Recipe;
  anims: BuiltAnim[];
  skinProblems: SkinProblem[];
  remapCounts: RemapCounts;
  report: SheetReport;
  /** Repo-relative path → file bytes, everything this recipe writes. */
  outputs: Map<string, Buffer>;
}

export const ASSET_DIR = 'packages/shared/assets/sprites';
export const REVIEW_DIR = 'art/review';
export const APP_ID = 'iot-art-pipeline';

/** The order the contract lists a recipe's animations in: the table's, else the recipe's own. */
function orderedAnims(recipe: Recipe): string[] {
  const names = Object.keys(recipe.anims);
  const table = animNames(recipe.sheet);
  return table ? table.filter((a) => names.includes(a)) : names;
}

function orderedFacings(recipe: Recipe, anim: string): (Facing | null)[] {
  const a = recipe.anims[anim];
  if (!a) return [];
  if (!hasFacings(recipe.kind)) return a.source ? [null] : [];
  const order = facingsFor(recipe.sheet, anim);
  return SPRITE_FACINGS.filter((f) => order.includes(f) && a.facings?.[f]);
}

/** Builds every frame of a recipe in memory: steps 1–10 per frame, in order. */
export function buildFrames(
  recipe: Recipe,
  root: string,
): { anims: BuiltAnim[]; skinProblems: SkinProblem[]; remapCounts: RemapCounts } {
  const reader = new SourceReader(root);
  const file = `art/sheets/${recipe.sheet}.json`;
  const remapCounts: RemapCounts = recipe.remap.map(() => new Map<string, number>());
  const spec = cellFor(recipe.kind);
  const fixes = new Map<string, [number, number, string | null][]>();
  for (const f of recipe.fixes) fixes.set(f.frame, [...(fixes.get(f.frame) ?? []), ...f.pixels]);
  const anims: BuiltAnim[] = [];
  const skinProblems: SkinProblem[] = [];
  for (const anim of orderedAnims(recipe)) {
    const a = recipe.anims[anim];
    if (!a) continue;
    const ground = a.ground ?? defaultGround(anim);
    for (const facing of orderedFacings(recipe, anim)) {
      const source = animSources(recipe.kind, a).find(([f]) => f === facing)?.[1];
      if (!source) continue;
      const key = animKey(anim, facing);
      let refRow: number | null = null;
      if (typeof ground === 'object') {
        const ref = reader.read(
          source.src,
          ground.ref,
          source.downscale,
          `${key} ground ref`,
          source.flipX,
        );
        refRow = opaqueRows(ref)?.bottom ?? null;
      }
      const frames: BuiltFrame[] = [];
      source.frames.forEach((index, n) => {
        const name = frameName(anim, facing, n);
        // 1. read (alpha, downscale, GIF split, mirror) and 2. select: the recipe's index.
        let img = reader.read(source.src, index, source.downscale, name, source.flipX);
        // 3. fixes.
        img = applyFixes(img, fixes.get(name) ?? [], name);
        // 4. remap.
        const ref = { name, anim, facing };
        const remapped = applyRemap(img, recipe.remap, ref, file);
        img = remapped.img;
        recipe.remap.forEach((rule, i) => {
          const counts = remapCounts[i];
          if (counts && appliesTo(rule, ref))
            counts.set(anim, (counts.get(anim) ?? 0) + (remapped.taken[i] ?? 0));
        });
        // 5. reserved colours, 6. snap, 7. outline by role.
        checkReserved(img, name);
        const snapped = snap(img, name);
        const outlined = outline(snapped.img, recipe.outline);
        // 8. place in the cell.
        const placed = place(outlined.img, spec, ground, refRow, name, SPRITE_CANVAS);
        // 9. despeckle, where the animation asks.
        let cell = placed.img;
        let despeckled: number | null = null;
        if (a.despeckle) {
          const d = despeckle(cell);
          cell = d.img;
          despeckled = d.changed;
        }
        // 10. the skin mask (Kindled).
        let mask: Img | null = null;
        let masked: number | null = null;
        if (recipe.kind === 'kindled') {
          const m = skinMask(
            cell,
            name,
            placed.dx,
            placed.dy,
            recipe.skin.add[name] ?? [],
            recipe.skin.remove[name] ?? [],
          );
          mask = m.mask;
          masked = m.masked;
          skinProblems.push(...m.problems);
        }
        frames.push({
          name,
          anim,
          facing,
          n,
          source: `${source.src} ${index}`,
          mirrored: source.flipX === true,
          cell,
          mask,
          offPalette: snapped.offPalette,
          maxDeltaE: snapped.maxDeltaE,
          moved: snapped.moved,
          dx: placed.dx,
          dy: placed.dy,
          shift: placed.shift,
          outlineGaps: outlined.gaps,
          interiorDreamNight: recipe.outline === 'other' ? outlined.interiorDreamNight : null,
          despeckled,
          masked,
        });
      });
      anims.push({ key, anim, facing, frames });
    }
  }
  return { anims, skinProblems, remapCounts };
}

/**
 * What a non-draft sheet is missing against its kind's animation table, as
 * messages. Rows after `REQUIRED_MILESTONE` are optional, but complete when
 * any facing of them is there.
 */
export function completenessProblems(recipe: Recipe, anims: readonly BuiltAnim[]): string[] {
  const table = recipeTable(recipe);
  if (!table) {
    return [
      `${recipe.sheet}: the sprite contract has no animation table (frame counts and rates) for this ${recipe.kind} yet, ` +
        'so only a draft can be built',
    ];
  }
  const problems: string[] = [];
  const built = new Map(anims.map((a) => [a.key, a.frames.length]));
  for (const row of table) {
    const keys = (hasFacings(recipe.kind) ? row.facings : [null]).map((f) => animKey(row.name, f));
    const required = isRequiredAnim(row);
    if (!required && keys.every((k) => !built.has(k))) continue;
    for (const key of keys) {
      const n = built.get(key);
      if (n === undefined)
        problems.push(
          required
            ? `${recipe.sheet}: ${key} is missing (a finished sheet carries every animation and facing)`
            : `${recipe.sheet}: ${key} is missing (${row.name} is ${optionalReason(row)}, but a finished sheet that has it carries every facing)`,
        );
      else if (n !== row.frames)
        problems.push(`${recipe.sheet}: ${key} has ${n} frames; the table says ${row.frames}`);
    }
  }
  if (recipe.kind === 'prop') {
    const n = built.get(PROP_IDLE.name) ?? 0;
    if (n < PROP_IDLE.minFrames || n > PROP_IDLE.maxFrames) {
      problems.push(
        `${recipe.sheet}: a prop's idle has ${PROP_IDLE.minFrames} to ${PROP_IDLE.maxFrames} frames, not ${n}`,
      );
    }
  }
  return problems;
}

/** Packs the cells row-major in contract order into one sheet (and its mask), at most 2048×2048. */
export function pack(
  recipe: Recipe,
  anims: readonly BuiltAnim[],
): { sheet: Img; mask: Img | null; rects: Map<string, { x: number; y: number }> } {
  const { cell } = cellFor(recipe.kind);
  const frames = anims.flatMap((a) => a.frames);
  const cols = Math.max(1, Math.min(frames.length, Math.floor(MAX_SHEET / cell.w)));
  const rows = Math.ceil(frames.length / cols);
  if (rows * cell.h > MAX_SHEET) {
    throw new PipelineError(
      `${recipe.sheet}: ${frames.length} frames of ${cell.w}×${cell.h} need a ${cols * cell.w}×${rows * cell.h} sheet; the most is ${MAX_SHEET}×${MAX_SHEET}`,
    );
  }
  const sheet = blank(cols * cell.w, rows * cell.h);
  const mask = recipe.kind === 'kindled' ? blank(sheet.w, sheet.h) : null;
  const rects = new Map<string, { x: number; y: number }>();
  frames.forEach((f, i) => {
    const x = (i % cols) * cell.w;
    const y = Math.floor(i / cols) * cell.h;
    blit(sheet, f.cell, x, y);
    if (mask && f.mask) blit(mask, f.mask, x, y);
    rects.set(f.name, { x, y });
  });
  return { sheet, mask, rects };
}

/** The sheet's JSON (sprites.md §5 v2), keys in a fixed order. */
export function sheetJson(
  recipe: Recipe,
  anims: readonly BuiltAnim[],
  size: { w: number; h: number },
  rects: ReadonlyMap<string, { x: number; y: number }>,
): string {
  const { cell, origin } = cellFor(recipe.kind);
  const anchor = { x: origin.x / cell.w, y: origin.y / cell.h };
  const frames: Record<string, unknown> = {};
  for (const f of anims.flatMap((a) => a.frames)) {
    const r = rects.get(f.name) ?? { x: 0, y: 0 };
    frames[f.name] = {
      frame: { x: r.x, y: r.y, w: cell.w, h: cell.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: cell.w, h: cell.h },
      sourceSize: { w: cell.w, h: cell.h },
      anchor,
    };
  }
  const meta: Record<string, unknown> = {
    image: `${recipe.sheet}.png`,
    size,
    scale: '1',
    format: 'RGBA8888',
    app: APP_ID,
    version: '2',
    cell,
    origin,
  };
  if (hasFacings(recipe.kind)) meta.facings = [...SPRITE_FACINGS];
  meta.pixelScale = 1;
  const animsBlock: Record<string, unknown> = {};
  const table = recipeTable(recipe);
  for (const a of anims) {
    const row = table?.find((r) => r.name === a.anim);
    const entry: Record<string, unknown> = {
      frames: a.frames.map((f) => f.name),
      frameRate: row?.fps ?? 0,
      repeat: row?.loop ? -1 : 0,
    };
    if (row?.hold) entry.hold = true;
    animsBlock[a.key] = entry;
  }
  const out: Record<string, unknown> = { frames, meta, anims: animsBlock };
  if (recipe.kind === 'kindled') out.palette = clayPalette(recipe.sheet);
  return `${JSON.stringify(out, null, 2)}\n`;
}

/** palette.drawn, the mask's name and the swaps from palette.json's clay tones (skin, shade). */
export function clayPalette(sheet: string): {
  drawn: string;
  mask: string;
  swaps: Record<string, Record<string, string>>;
} {
  const swaps: Record<string, Record<string, string>> = {};
  for (const [tone, t] of Object.entries(paletteData.clay.tones)) {
    if (tone === paletteData.clay.drawn) continue;
    swaps[tone] = { [SKIN]: t.skin.toLowerCase(), [SKIN_SHADE]: t.shade.toLowerCase() };
  }
  return { drawn: paletteData.clay.drawn, mask: skinMaskName(sheet), swaps };
}

/** Swap keys with no masked pixel anywhere: the sheet test needs each covered. */
function uncoveredSwapKeys(sheet: Img, mask: Img): string[] {
  const covered = new Set<string>();
  for (let y = 0; y < sheet.h; y++) {
    for (let x = 0; x < sheet.w; x++) if (opaqueAt(mask, x, y)) covered.add(hexAt(sheet, x, y));
  }
  return [SKIN, SKIN_SHADE].filter((k) => !covered.has(k));
}

/**
 * Builds a recipe completely in memory: the frames, the checks a non-draft
 * sheet must pass, the sheet PNG, JSON and mask (non-draft only) and the
 * review folder (contact.png, tones.png for the Kindled, report.md/.json).
 */
export function buildRecipe(recipe: Recipe, root: string): BuildResult {
  const { anims, skinProblems, remapCounts } = buildFrames(recipe, root);
  const outputs = new Map<string, Buffer>();
  if (!recipe.draft) {
    const problems = completenessProblems(recipe, anims);
    problems.push(
      ...staleRules(remapCounts).map((i) => staleRuleText(recipe.sheet, i, recipe.remap[i])),
    );
    problems.push(...skinProblems.map(skinProblemText));
    if (problems.length) throw new PipelineError(problems);
  }
  const packed = pack(recipe, anims);
  if (!recipe.draft) {
    if (packed.mask) {
      const missing = uncoveredSwapKeys(packed.sheet, packed.mask);
      if (missing.length) {
        throw new PipelineError(
          `${recipe.sheet}: no masked pixel is ${missing.join(' or ')}; every swap key needs some skin in it`,
        );
      }
    }
    const base = `${ASSET_DIR}/${recipe.sheet}`;
    outputs.set(`${base}.png`, encodePng(packed.sheet));
    outputs.set(
      `${base}.json`,
      Buffer.from(sheetJson(recipe, anims, { w: packed.sheet.w, h: packed.sheet.h }, packed.rects)),
    );
    if (packed.mask)
      outputs.set(`${ASSET_DIR}/${skinMaskName(recipe.sheet)}`, encodePng(packed.mask));
  }
  const review = `${REVIEW_DIR}/${recipe.sheet}`;
  outputs.set(`${review}/contact.png`, encodePng(renderContact(recipe, anims)));
  if (recipe.kind === 'kindled')
    outputs.set(`${review}/tones.png`, encodePng(renderTones(recipe, anims)));
  const report = writeReport(recipe, anims, skinProblems, remapCounts, [
    ...outputs.keys(),
    `${review}/report.md`,
    `${review}/report.json`,
  ]);
  outputs.set(`${review}/report.md`, Buffer.from(report.markdown));
  outputs.set(`${review}/report.json`, Buffer.from(`${JSON.stringify(report.json, null, 2)}\n`));
  return { recipe, anims, skinProblems, remapCounts, report: report.json, outputs };
}
