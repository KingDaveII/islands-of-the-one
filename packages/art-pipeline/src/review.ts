import { paletteData } from '@iot/shared';
import type { BuiltAnim, BuiltFrame } from './build.js';
import { FLOOR, HOLLOW_DEEP, SKIN, SKIN_SHADE, WALL } from './colour.js';
import { animTable, cellFor, isLooping, solesRow } from './contract.js';
import {
  blank,
  blit,
  cloneImg,
  fillRect,
  hexAt,
  opaqueAt,
  opaqueRows,
  pixelsChanged,
  sameImg,
  setPixel,
  type Img,
} from './image.js';
import type { Recipe } from './recipe.js';
import { skinProblemText, type SkinProblem } from './steps.js';

/**
 * The review folder ART reads (art/review/<sheet>/): the contact sheet, the
 * clay tones through the mask, and the report of everything the pipeline
 * measured but does not fix (loop seams, body bob, held frames, colour counts).
 */

const SCALE = 2;
const GAP = 4;
const MARGIN = 2;
const TICK = paletteData.tokens['spark-amber'].toLowerCase();

/** The part of the cell every review image shows: the union of all frames' ink and the soles row, plus a margin. */
function viewBox(
  recipe: Recipe,
  anims: readonly BuiltAnim[],
): { x: number; y: number; w: number; h: number } {
  const { cell } = cellFor(recipe.kind);
  const soles = solesRow(recipe.kind);
  let x0 = cell.w;
  let y0 = soles;
  let x1 = 0;
  let y1 = soles;
  for (const f of anims.flatMap((a) => a.frames)) {
    for (let y = 0; y < cell.h; y++) {
      for (let x = 0; x < cell.w; x++) {
        if (!opaqueAt(f.cell, x, y)) continue;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x0 > x1) [x0, x1] = [0, cell.w - 1];
  x0 = Math.max(0, x0 - MARGIN);
  y0 = Math.max(0, y0 - MARGIN);
  x1 = Math.min(cell.w - 1, x1 + MARGIN);
  y1 = Math.min(cell.h - 1, y1 + MARGIN);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(img: Img, box: { x: number; y: number; w: number; h: number }): Img {
  const out = blank(box.w, box.h);
  for (let y = 0; y < box.h; y++)
    out.data.set(
      img.data.subarray(
        ((box.y + y) * img.w + box.x) * 4,
        ((box.y + y) * img.w + box.x + box.w) * 4,
      ),
      y * box.w * 4,
    );
  return out;
}

/**
 * A grid of tiles: one row per animation × facing, and per row one panel per
 * background (or tone), each holding the row's frames in order at 2×. An
 * amber tick left of each tile marks the soles row.
 */
function grid(
  recipe: Recipe,
  anims: readonly BuiltAnim[],
  panels: readonly { bg: string; frame: (f: BuiltFrame) => Img }[],
): Img {
  const box = viewBox(recipe, anims);
  const tileW = box.w * SCALE;
  const tileH = box.h * SCALE;
  const maxN = Math.max(1, ...anims.map((a) => a.frames.length));
  const panelW = maxN * (tileW + GAP);
  const width = GAP + panels.length * (panelW + GAP * 2);
  const height = GAP + anims.length * (tileH + GAP);
  const out = blank(width, height);
  fillRect(out, 0, 0, width, height, HOLLOW_DEEP);
  const solesY = (solesRow(recipe.kind) - box.y) * SCALE;
  anims.forEach((a, row) => {
    const y = GAP + row * (tileH + GAP);
    panels.forEach((p, pi) => {
      const px = GAP + pi * (panelW + GAP * 2);
      a.frames.forEach((f, n) => {
        const x = px + n * (tileW + GAP) + GAP;
        fillRect(out, x, y, tileW, tileH, p.bg);
        fillRect(out, x - GAP, y + solesY, GAP, SCALE, TICK);
        blit(out, crop(p.frame(f), box), x, y, SCALE);
      });
    });
  });
  return out;
}

/** contact.png: every animation and facing as a row, frames in order, at 2× on the floor and on the wall face. */
export function renderContact(recipe: Recipe, anims: readonly BuiltAnim[]): Img {
  return grid(recipe, anims, [
    { bg: FLOOR, frame: (f) => f.cell },
    { bg: WALL, frame: (f) => f.cell },
  ]);
}

/** A frame in another clay tone: the swaps applied under its mask only. */
export function toneFrame(f: BuiltFrame, tone: string): Img {
  const t = (paletteData.clay.tones as Record<string, { skin: string; shade: string }>)[tone];
  if (!t || !f.mask || tone === paletteData.clay.drawn) return f.cell;
  const swap = new Map([
    [SKIN, t.skin.toLowerCase()],
    [SKIN_SHADE, t.shade.toLowerCase()],
  ]);
  const out = cloneImg(f.cell);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      if (!opaqueAt(f.mask, x, y)) continue;
      const to = swap.get(hexAt(f.cell, x, y));
      if (to) setPixel(out, x, y, to);
    }
  }
  return out;
}

/** tones.png (Kindled): every frame in the four clay tones through the mask, one panel per tone, on the floor. */
export function renderTones(recipe: Recipe, anims: readonly BuiltAnim[]): Img {
  return grid(
    recipe,
    anims,
    Object.keys(paletteData.clay.tones).map((tone) => ({
      bg: FLOOR,
      frame: (f: BuiltFrame) => toneFrame(f, tone),
    })),
  );
}

export const SEAM_FLAG = 1.5;
export const BOB_FLAG = 1;
export const COLOUR_FLAG = 12;

const round2 = (v: number): number => Math.round(v * 100) / 100;

function colourCount(img: Img): number {
  const set = new Set<string>();
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) if (opaqueAt(img, x, y)) set.add(hexAt(img, x, y));
  return set.size;
}

export interface FrameReport {
  name: string;
  source: string;
  offPalette: number;
  maxDeltaE: number;
  dx: number;
  dy: number;
  shift: number;
  outlineGaps: number;
  interiorDreamNight?: number;
  despeckled?: number;
  masked?: number;
  colours: number;
}

export interface AnimReport {
  key: string;
  frames: number;
  seam?: { lastToFirst: number; meanInCycle: number; flag: boolean };
  bob?: { tops: number[]; range: number; flag: boolean };
  held: string[];
}

export interface SheetReport {
  sheet: string;
  kind: string;
  outline: string;
  draft: boolean;
  cell: { w: number; h: number };
  origin: { x: number; y: number };
  rows: string[];
  totals: {
    frames: number;
    offPalette: number;
    maxDeltaE: number;
    outlineGaps: number;
    masked?: number;
  };
  flags: { seam: string[]; bob: string[]; held: string[]; colours: string[] };
  missing: string[];
  skinProblems: string[];
  anims: AnimReport[];
  frames: FrameReport[];
  outputs: string[];
}

/** The numbers of one animation: its loop seam, body bob and held frames. */
export function animChecks(a: BuiltAnim, soles: number): AnimReport {
  const out: AnimReport = { key: a.key, frames: a.frames.length, held: [] };
  const cells = a.frames.map((f) => f.cell);
  for (let i = 0; i + 1 < cells.length; i++) {
    const [p, q] = [cells[i], cells[i + 1]];
    if (p && q && sameImg(p, q)) out.held.push(`${a.frames[i]?.name} = ${a.frames[i + 1]?.name}`);
  }
  if (isLooping(a.anim) && cells.length >= 2) {
    const steps: number[] = [];
    for (let i = 0; i + 1 < cells.length; i++) {
      const [p, q] = [cells[i], cells[i + 1]];
      if (p && q) steps.push(pixelsChanged(p, q));
    }
    const first = cells[0];
    const last = cells[cells.length - 1];
    const lastToFirst = first && last ? pixelsChanged(last, first) : 0;
    const mean = steps.reduce((s, v) => s + v, 0) / Math.max(1, steps.length);
    out.seam = { lastToFirst, meanInCycle: round2(mean), flag: lastToFirst > SEAM_FLAG * mean };
  }
  if (a.anim === 'idle' || a.anim === 'walk') {
    const tops = cells.map((c) => {
      const rows = opaqueRows(c);
      return rows ? soles - rows.top : 0;
    });
    const range = Math.max(...tops) - Math.min(...tops);
    out.bob = { tops, range, flag: range > BOB_FLAG };
  }
  return out;
}

/** What a draft lacks against its kind's table (informational; a non-draft fails on it instead). */
function missingAgainstTable(recipe: Recipe, anims: readonly BuiltAnim[]): string[] {
  const table = animTable(recipe.kind);
  if (!table) return [`no animation table for ${recipe.kind} sheets in the contract`];
  const built = new Map(anims.map((a) => [a.key, a.frames.length]));
  const out: string[] = [];
  for (const row of table) {
    const absent = row.facings.filter((f) => !built.has(`${row.name}_${f}`));
    if (absent.length === row.facings.length) out.push(`${row.name} (all facings)`);
    else if (absent.length) out.push(`${row.name} ${absent.join(' ')}`);
    for (const f of row.facings) {
      const n = built.get(`${row.name}_${f}`);
      if (n !== undefined && n !== row.frames)
        out.push(`${row.name}_${f}: ${n} of ${row.frames} frames`);
    }
  }
  return out;
}

/** report.json and report.md for a built recipe. */
export function writeReport(
  recipe: Recipe,
  anims: readonly BuiltAnim[],
  skinProblems: readonly SkinProblem[],
  outputs: string[],
): { json: SheetReport; markdown: string } {
  const spec = cellFor(recipe.kind);
  const soles = solesRow(recipe.kind);
  const frames: FrameReport[] = anims.flatMap((a) =>
    a.frames.map((f) => {
      const r: FrameReport = {
        name: f.name,
        source: f.source,
        offPalette: f.offPalette,
        maxDeltaE: round2(f.maxDeltaE),
        dx: f.dx,
        dy: f.dy,
        shift: f.shift,
        outlineGaps: f.outlineGaps,
        colours: colourCount(f.cell),
      };
      if (f.interiorDreamNight !== null) r.interiorDreamNight = f.interiorDreamNight;
      if (f.despeckled !== null) r.despeckled = f.despeckled;
      if (f.masked !== null) r.masked = f.masked;
      return r;
    }),
  );
  const animReports = anims.map((a) => animChecks(a, soles));
  const totals: SheetReport['totals'] = {
    frames: frames.length,
    offPalette: frames.reduce((s, f) => s + f.offPalette, 0),
    maxDeltaE: Math.max(0, ...frames.map((f) => f.maxDeltaE)),
    outlineGaps: frames.reduce((s, f) => s + f.outlineGaps, 0),
  };
  if (recipe.kind === 'kindled') totals.masked = frames.reduce((s, f) => s + (f.masked ?? 0), 0);
  const json: SheetReport = {
    sheet: recipe.sheet,
    kind: recipe.kind,
    outline: recipe.outline,
    draft: recipe.draft,
    cell: spec.cell,
    origin: spec.origin,
    rows: anims.map((a) => a.key),
    totals,
    flags: {
      seam: animReports.filter((a) => a.seam?.flag).map((a) => a.key),
      bob: animReports.filter((a) => a.bob?.flag).map((a) => a.key),
      held: animReports.flatMap((a) => a.held),
      colours: frames.filter((f) => f.colours > COLOUR_FLAG).map((f) => f.name),
    },
    missing: missingAgainstTable(recipe, anims),
    skinProblems: skinProblems.map(skinProblemText),
    anims: animReports,
    frames,
    outputs: [...outputs].sort(),
  };
  return { json, markdown: markdown(json) };
}

function markdown(r: SheetReport): string {
  const lines: string[] = [];
  const kindled = r.kind === 'kindled';
  lines.push(`# ${r.sheet}${r.draft ? ' (draft)' : ''}`, '');
  lines.push(
    `Built by \`pnpm art:build ${r.sheet}\` from \`art/sheets/${r.sheet}.json\`; do not edit by hand (\`pnpm art:check\` rebuilds it).`,
    `Kind ${r.kind}, outline ${r.outline}, cell ${r.cell.w}×${r.cell.h}, origin (${r.origin.x}, ${r.origin.y}).` +
      (r.draft ? ' A draft writes this review only, never `packages/shared/assets`.' : ''),
    '',
  );
  lines.push('## Summary', '');
  lines.push(`- Frames: ${r.totals.frames}.`);
  lines.push(
    `- Off-palette pixels snapped: ${r.totals.offPalette} (largest ΔE ${r.totals.maxDeltaE}).`,
  );
  lines.push(`- Outline gaps (edge pixels not in an outline colour): ${r.totals.outlineGaps}.`);
  if (kindled) lines.push(`- Masked skin pixels: ${r.totals.masked ?? 0}.`);
  const list = (xs: string[]): string => (xs.length ? xs.join(', ') : 'none');
  lines.push(
    `- Loop seam flags (last → first above ${SEAM_FLAG}× the mean change): ${list(r.flags.seam)}.`,
  );
  lines.push(`- Body bob flags (top row moves more than ${BOB_FLAG} px): ${list(r.flags.bob)}.`);
  lines.push(`- Held frames (identical neighbours): ${list(r.flags.held)}.`);
  lines.push(`- Frames with more than ${COLOUR_FLAG} colours: ${list(r.flags.colours)}.`);
  if (kindled) {
    lines.push(
      `- Skin regions to resolve: ${r.skinProblems.length}${r.skinProblems.length && r.draft ? ' (reported because this is a draft; a finished sheet fails on them)' : ''}.`,
    );
  }
  lines.push(`- Missing against the contract's table: ${list(r.missing)}.`, '');
  lines.push('## Review images', '');
  lines.push(
    `\`contact.png\` has one row per animation and facing, frames in order at 2×, on the floor (left) and the wall face (right); the amber tick marks the soles row.` +
      (kindled
        ? ' `tones.png` has the same rows in the four clay tones, through the mask: ' +
          Object.keys(paletteData.clay.tones).join(', ') +
          '.'
        : ''),
    '',
    `Rows, top to bottom: ${r.rows.join(', ')}.`,
    '',
  );
  lines.push('## Animations', '');
  lines.push(
    '| Anim | Frames | Seam (last→first / mean) | Bob (tops above the soles) | Held |',
    '|---|---|---|---|---|',
  );
  for (const a of r.anims) {
    const seam = a.seam
      ? `${a.seam.lastToFirst} / ${a.seam.meanInCycle}${a.seam.flag ? ' **flag**' : ''}`
      : '';
    const bob = a.bob
      ? `${a.bob.tops.join(' ')} (range ${a.bob.range})${a.bob.flag ? ' **flag**' : ''}`
      : '';
    lines.push(`| ${a.key} | ${a.frames} | ${seam} | ${bob} | ${a.held.join('; ')} |`);
  }
  lines.push('', '## Frames', '');
  lines.push(
    `Shift: rows the grounding moved the frame against its canvas's row 53 (positive = down). dx, dy: where the source's (0, 0) sits in the cell.`,
    '',
  );
  const extra = [
    r.frames.some((f) => f.interiorDreamNight !== undefined) ? 'Interior dream-night' : null,
    r.frames.some((f) => f.despeckled !== undefined) ? 'Despeckled' : null,
    kindled ? 'Masked' : null,
  ].filter((x): x is string => x !== null);
  lines.push(
    `| Frame | Source | Off-palette | Max ΔE | Shift | dx, dy | Outline gaps | Colours |${extra.map((e) => ` ${e} |`).join('')}`,
    `|---|---|---|---|---|---|---|---|${extra.map(() => '---|').join('')}`,
  );
  for (const f of r.frames) {
    const cells = [
      f.name,
      `\`${f.source}\``,
      f.offPalette,
      f.maxDeltaE,
      f.shift,
      `${f.dx}, ${f.dy}`,
      f.outlineGaps,
      f.colours > COLOUR_FLAG ? `${f.colours} **flag**` : f.colours,
    ];
    if (extra.includes('Interior dream-night')) cells.push(f.interiorDreamNight ?? '');
    if (extra.includes('Despeckled')) cells.push(f.despeckled ?? '');
    if (kindled) cells.push(f.masked ?? '');
    lines.push(`| ${cells.join(' | ')} |`);
  }
  if (r.skinProblems.length) {
    lines.push('', '## Skin regions to resolve', '');
    for (const p of r.skinProblems) lines.push(`- ${p}`);
  }
  lines.push('');
  return lines.join('\n');
}
