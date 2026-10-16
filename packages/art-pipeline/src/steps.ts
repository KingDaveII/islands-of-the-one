import {
  DREAM_NIGHT,
  describeHex,
  FRECKLE,
  HOLLOW_DEEP,
  nearestCache,
  NEVER,
  OUTLINE_SET,
  SKIN,
  SKIN_SHADE,
  TELEGRAPH,
  TOKENS,
  WHITELIST,
  WHITELIST_TELEGRAPH,
} from './colour.js';
import { PipelineError } from './errors.js';
import { blank, cloneImg, hexAt, opaqueAt, opaqueRows, setPixel, type Img } from './image.js';
import type { Area, Ground } from './recipe.js';

/**
 * Steps 3 and 5–10 of docs/design/art-pipeline.md, one pure function each, in
 * build order. Step 4, the recipe's remap, is in remap.ts.
 */

/** Step 3: the recipe's pixel fixes, in the source frame's pixels; a colour or null (transparent). */
export function applyFixes(
  img: Img,
  pixels: readonly [number, number, string | null][],
  frame: string,
): Img {
  const out = cloneImg(img);
  for (const [x, y, hex] of pixels) {
    if (x >= img.w || y >= img.h) {
      throw new PipelineError(
        `${frame}: the fix at (${x}, ${y}) is outside the ${img.w}×${img.h} source frame`,
      );
    }
    setPixel(out, x, y, hex);
  }
  return out;
}

const nearest32 = nearestCache(TOKENS.map((t) => t.hex));

/** Whether a frame may carry the telegraph colours: its animation is `telegraph*`. */
export function isTelegraphFrame(frame: string): boolean {
  return frame.startsWith('telegraph');
}

/**
 * Step 5: fails on the first opaque pixel whose nearest token (of all 32, in
 * OKLab) is #FFFFFF or #FFE7A3, or a telegraph colour outside a telegraph frame.
 */
export function checkReserved(img: Img, frame: string): void {
  const telegraph = isTelegraphFrame(frame);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const hex = hexAt(img, x, y);
      const near = nearest32(hex).hex;
      if (NEVER.includes(near) || (!telegraph && TELEGRAPH.includes(near))) {
        throw new PipelineError(
          `${frame}: pixel (${x}, ${y}) is ${hex}, nearest to the reserved ${describeHex(near)}` +
            (TELEGRAPH.includes(near) ? ', which only telegraph frames may use' : ''),
        );
      }
    }
  }
}

const snapPlain = nearestCache(WHITELIST);
const snapTelegraph = nearestCache(WHITELIST_TELEGRAPH);

export interface SnapResult {
  img: Img;
  /** Opaque pixels that were not already a whitelist colour. */
  offPalette: number;
  /** The largest ΔE (OKLab × 100) a pixel moved. */
  maxDeltaE: number;
  /** Each off-palette source colour: where it went, how far, and how many pixels. */
  moved: Map<string, { to: string; dE: number; pixels: number }>;
}

/** Step 6: every opaque pixel to the nearest whitelist colour (plus the telegraph pair in telegraph frames). */
export function snap(img: Img, frame: string): SnapResult {
  const pick = isTelegraphFrame(frame) ? snapTelegraph : snapPlain;
  const out = cloneImg(img);
  let offPalette = 0;
  let maxDeltaE = 0;
  const moved = new Map<string, { to: string; dE: number; pixels: number }>();
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const hex = hexAt(img, x, y);
      const near = pick(hex);
      if (near.hex === hex) continue;
      offPalette++;
      maxDeltaE = Math.max(maxDeltaE, near.dE);
      setPixel(out, x, y, near.hex);
      const m = moved.get(hex);
      if (m) m.pixels++;
      else moved.set(hex, { to: near.hex, dE: near.dE, pixels: 1 });
    }
  }
  return { img: out, offPalette, maxDeltaE, moved };
}

export interface OutlineResult {
  img: Img;
  /** Edge pixels outside dream-night, hollow-deep and sleeper-night: gaps in the outline. */
  gaps: number;
  /** Non-player sheets: interior dream-night pixels (the player's outline colour inside a figure). */
  interiorDreamNight: number;
}

/** True for an opaque pixel 4-adjacent to transparency or the image border. */
export function isEdge(img: Img, x: number, y: number): boolean {
  return (
    opaqueAt(img, x, y) &&
    (!opaqueAt(img, x - 1, y) ||
      !opaqueAt(img, x + 1, y) ||
      !opaqueAt(img, x, y - 1) ||
      !opaqueAt(img, x, y + 1))
  );
}

/**
 * Step 7: edge pixels in an outline colour become the role's outline:
 * dream-night for the player, hollow-deep for everyone else. Interior pixels
 * stay; gaps (edge pixels in other colours) are counted, not filled.
 */
export function outline(img: Img, role: 'player' | 'other'): OutlineResult {
  const colour = role === 'player' ? DREAM_NIGHT : HOLLOW_DEEP;
  const out = cloneImg(img);
  let gaps = 0;
  let interiorDreamNight = 0;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const hex = hexAt(img, x, y);
      if (isEdge(img, x, y)) {
        if (OUTLINE_SET.includes(hex)) setPixel(out, x, y, colour);
        else gaps++;
      } else if (role === 'other' && hex === DREAM_NIGHT) {
        interiorDreamNight++;
      }
    }
  }
  return { img: out, gaps, interiorDreamNight };
}

export interface CellSpec {
  cell: { w: number; h: number };
  origin: { x: number; y: number };
}

export interface Placement {
  img: Img;
  /** Where the source frame's (0, 0) lands in the cell. */
  dx: number;
  dy: number;
  /** Rows moved against trusting the canvas (positive = down): the drift the grounding corrected. */
  shift: number;
}

/** The source row a frame's canvas puts the soles on: row 53 of a 64-row canvas, centred in a bigger frame. */
export function canvasSolesRow(h: number, canvasH: number, canvasSoles: number): number {
  return canvasSoles + Math.floor((h - canvasH) / 2);
}

/**
 * Step 8: the frame into its cell. Horizontally by the frame's canvas centre
 * (never the bounding box); vertically by `ground`: the frame's own lowest
 * opaque row (`frame`), the lowest opaque row of source frame `ref` (`refRow`),
 * or the canvas's row 53 (`canvas`). Fails, never crops, if anything opaque
 * would land outside the cell or on its outer 1 px ring.
 */
export function place(
  img: Img,
  spec: CellSpec,
  ground: Ground,
  refRow: number | null,
  frame: string,
  canvas: { h: number; soleRow: number },
): Placement {
  const solesCell = spec.origin.y - 1;
  const canvasRow = canvasSolesRow(img.h, canvas.h, canvas.soleRow);
  let sourceSoles: number;
  if (ground === 'canvas') sourceSoles = canvasRow;
  else if (ground === 'frame') {
    const rows = opaqueRows(img);
    if (!rows) throw new PipelineError(`${frame}: the frame is empty`);
    sourceSoles = rows.bottom;
  } else {
    if (refRow === null)
      throw new PipelineError(`${frame}: ground ref frame ${ground.ref} is empty`);
    sourceSoles = refRow;
  }
  const dx = spec.origin.x - Math.floor(img.w / 2);
  const dy = solesCell - sourceSoles;
  const out = blank(spec.cell.w, spec.cell.h);
  const outside: string[] = [];
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const cx = x + dx;
      const cy = y + dy;
      if (cx <= 0 || cy <= 0 || cx >= spec.cell.w - 1 || cy >= spec.cell.h - 1) {
        if (outside.length < 4) outside.push(`(${x}, ${y})`);
        continue;
      }
      const si = (y * img.w + x) * 4;
      out.data.set(img.data.subarray(si, si + 4), (cy * out.w + cx) * 4);
    }
  }
  if (outside.length) {
    throw new PipelineError(
      `${frame}: placed at (${dx}, ${dy}) in the ${spec.cell.w}×${spec.cell.h} cell, source pixels ${outside.join(', ')}` +
        ' would fall outside it or on its outer 1 px ring; nothing is cropped',
    );
  }
  return { img: out, dx, dy, shift: canvasRow - sourceSoles };
}

/** Step 9: a single pixel whose 8 neighbours are all one other opaque colour takes that colour. */
export function despeckle(img: Img): { img: Img; changed: number } {
  const out = cloneImg(img);
  let changed = 0;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const self = hexAt(img, x, y);
      let other: string | null = null;
      let uniform = true;
      for (let dy = -1; dy <= 1 && uniform; dy++) {
        for (let dx = -1; dx <= 1 && uniform; dx++) {
          if (!dx && !dy) continue;
          if (!opaqueAt(img, x + dx, y + dy)) uniform = false;
          else {
            const n = hexAt(img, x + dx, y + dy);
            if (other === null) other = n;
            else if (n !== other) uniform = false;
          }
        }
      }
      if (uniform && other !== null && other !== self) {
        setPixel(out, x, y, other);
        changed++;
      }
    }
  }
  return { img: out, changed };
}

/** A region of skin-coloured pixels that the rule could not call skin: ART resolves it in the recipe. */
export interface SkinProblem {
  frame: string;
  /** Bounding box in the source frame's pixels (what `skin.add` and `fixes` take), corners included. */
  box: [[number, number], [number, number]];
  pixels: number;
}

/** The pixels an area list covers, in source pixels. */
export function areaPixels(areas: readonly Area[]): [number, number][] {
  const out: [number, number][] = [];
  for (const a of areas) {
    if (typeof a[0] === 'number') out.push(a as [number, number]);
    else {
      const [[x0, y0], [x1, y1]] = a as [[number, number], [number, number]];
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
      }
    }
  }
  return out;
}

/**
 * Step 10: the skin mask of one placed frame. Regions are 4-connected runs of
 * unwritten-sail and unwritten-tar; `remove` takes pixels out first and `add`
 * marks regions as skin. A region is skin if `add` marks it, or it holds an
 * unwritten-sail pixel, or it touches a freckle. Every other region is a
 * problem, returned for the build to fail on (or to report, in a draft).
 * `dx`, `dy` turn source pixels into cell pixels.
 */
export function skinMask(
  img: Img,
  frame: string,
  dx: number,
  dy: number,
  add: readonly Area[],
  remove: readonly Area[],
): { mask: Img; masked: number; problems: SkinProblem[] } {
  const w = img.w;
  const isSkinColour = (x: number, y: number): boolean => {
    if (!opaqueAt(img, x, y)) return false;
    const hex = hexAt(img, x, y);
    return hex === SKIN || hex === SKIN_SHADE;
  };
  const removed = new Uint8Array(w * img.h);
  for (const [x, y] of areaPixels(remove)) {
    const cx = x + dx;
    const cy = y + dy;
    if (cx >= 0 && cy >= 0 && cx < w && cy < img.h) removed[cy * w + cx] = 1;
  }
  const added = new Uint8Array(w * img.h);
  for (const [x, y] of areaPixels(add)) {
    const cx = x + dx;
    const cy = y + dy;
    if (!isSkinColour(cx, cy)) {
      throw new PipelineError(
        `${frame}: skin.add marks (${x}, ${y}), which is not unwritten-sail or unwritten-tar after the snap; only skin colours can be masked`,
      );
    }
    added[cy * w + cx] = 1;
  }
  const mask = blank(w, img.h);
  const seen = new Uint8Array(w * img.h);
  const problems: SkinProblem[] = [];
  let masked = 0;
  for (let y0 = 0; y0 < img.h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const i0 = y0 * w + x0;
      if (seen[i0] || removed[i0] || !isSkinColour(x0, y0)) continue;
      const region: number[] = [];
      const stack = [i0];
      seen[i0] = 1;
      let skin = false;
      while (stack.length) {
        const i = stack.pop() ?? 0;
        region.push(i);
        const x = i % w;
        const y = (i - x) / w;
        if (added[i] || hexAt(img, x, y) === SKIN) skin = true;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= img.h) continue;
          const n = ny * w + nx;
          if (opaqueAt(img, nx, ny) && hexAt(img, nx, ny) === FRECKLE) skin = true;
          if (seen[n] || removed[n] || !isSkinColour(nx, ny)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (skin) {
        for (const i of region) {
          mask.data.set([255, 255, 255, 255], i * 4);
          masked++;
        }
      } else {
        const xs = region.map((i) => i % w);
        const ys = region.map((i) => Math.floor(i / w));
        problems.push({
          frame,
          box: [
            [Math.min(...xs) - dx, Math.min(...ys) - dy],
            [Math.max(...xs) - dx, Math.max(...ys) - dy],
          ],
          pixels: region.length,
        });
      }
    }
  }
  return { mask, masked, problems };
}

/** The message for an unresolved skin region (a failure, or a report line in a draft). */
export function skinProblemText(p: SkinProblem): string {
  const [[x0, y0], [x1, y1]] = p.box;
  return (
    `${p.frame}: a region of ${p.pixels} px in the skin colours at [[${x0}, ${y0}], [${x1}, ${y1}]] (source pixels) ` +
    'has no unwritten-sail pixel and touches no freckle; add it with skin.add if it is skin, or recolour it with fixes if not'
  );
}
