import { deltaE, FRECKLE, nearestCache, NEVER, TELEGRAPH, TOKENS, WHITELIST } from './colour.js';
import { SPRITE_FACINGS, type Facing } from './contract.js';
import { PipelineError } from './errors.js';
import { cloneImg, hexAt, opaqueAt, setPixel, type Img } from './image.js';

/**
 * `remap` (docs/design/art-pipeline.md, step 4): ART's rules that send a
 * generator's off-palette colours to the right material's ramp before the
 * snap, instead of letting the nearest colour decide (a blade grey into the
 * lavender, a cloth grey into the skin). Applied to each source frame after
 * the fixes; a pixel takes the first rule that matches it.
 */

/** A rectangle `[x0, y0, x1, y1]`, corners included, in the source frame's pixels (after any downscale). */
export type Rect = readonly [number, number, number, number];

export interface RemapRule {
  /** Exact source colours, lowercase. */
  from?: readonly string[];
  /** Every opaque source colour within `within` ΔE (OKLab × 100) of `hex`. */
  near?: { hex: string; within: number };
  /** The token the matched pixels become, by name, and its hex. */
  to: string;
  hex: string;
  /** Scopes: each narrows the rule; without any it applies to every frame. */
  anims?: readonly string[];
  facings?: readonly Facing[];
  frames?: readonly string[];
  box?: readonly Rect[];
  exclude?: { face: boolean; boxes: readonly Rect[] };
}

/** A frame a rule may apply to: its output name, animation and facing. */
export interface FrameRef {
  name: string;
  anim: string;
  facing: Facing | null;
}

/** How far the face reaches round the freckles' bounding box, for `exclude: "face"`. */
export const FACE_MARGIN = 3;

type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: Json): v is number => typeof v === 'number' && Number.isInteger(v);
const isHex = (v: Json): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const isRect = (v: Json): v is Rect =>
  Array.isArray(v) &&
  v.length === 4 &&
  v.every((n) => isInt(n) && n >= 0) &&
  (v[0] as number) <= (v[2] as number) &&
  (v[1] as number) <= (v[3] as number);

const RULE_KEYS = ['from', 'near', 'within', 'to', 'anims', 'facings', 'frames', 'box', 'exclude'];
const RECT_SHAPE = '[x0, y0, x1, y1] (whole numbers from 0, x0 ≤ x1, y0 ≤ y1)';

/** Whether a frame may carry the telegraph colours: its animation is `telegraph*`. */
const isTelegraph = (frame: FrameRef): boolean => frame.anim.startsWith('telegraph');

/** Whether a rule's `anims`, `facings` and `frames` take in a frame. */
export function appliesTo(rule: RemapRule, frame: FrameRef): boolean {
  return (
    (!rule.anims || rule.anims.includes(frame.anim)) &&
    (!rule.facings || (frame.facing !== null && rule.facings.includes(frame.facing))) &&
    (!rule.frames || rule.frames.includes(frame.name))
  );
}

/**
 * Checks `remap` against the documented shape and the recipe's own frames
 * and returns the rules typed; problems go to `bad` with the field named.
 * `facings` says whether the sheet's kind has facings.
 */
export function parseRemap(
  v: Json,
  frames: readonly FrameRef[],
  facings: boolean,
  bad: (path: string, msg: string) => void,
): RemapRule[] {
  if (!Array.isArray(v)) {
    bad('remap', 'must be a list of rules');
    return [];
  }
  const anims = new Set(frames.map((f) => f.anim));
  const names = new Set(frames.map((f) => f.name));
  const rules: RemapRule[] = [];
  v.forEach((r: Json, i) => {
    const path = `remap[${i}]`;
    if (!isObj(r)) {
      bad(path, 'must be an object');
      return;
    }
    const state = { ok: true };
    const fail = (p: string, msg: string): void => {
      bad(p, msg);
      state.ok = false;
    };
    for (const k of Object.keys(r))
      if (!RULE_KEYS.includes(k)) fail(`${path}.${k}`, 'is not a remap field');

    const rule: Partial<RemapRule> = {};
    if (r.from !== undefined && r.near !== undefined)
      fail(path, 'has both "from" and "near"; a rule matches by one or the other');
    else if (r.from === undefined && r.near === undefined)
      fail(path, 'needs "from" (exact colours) or "near" with "within"');
    if (r.from !== undefined) {
      if (!Array.isArray(r.from) || r.from.length === 0)
        fail(`${path}.from`, 'must be a non-empty list of "#rrggbb" colours');
      else {
        r.from.forEach((c: Json, j) => {
          if (!isHex(c))
            fail(`${path}.from[${j}]`, `is ${JSON.stringify(c)}, not a "#rrggbb" colour`);
        });
        rule.from = (r.from as string[]).filter(isHex).map((c) => c.toLowerCase());
      }
      if (r.within !== undefined) fail(`${path}.within`, 'goes with "near", not "from"');
    }
    if (r.near !== undefined) {
      if (!isHex(r.near))
        fail(`${path}.near`, `is ${JSON.stringify(r.near)}, not a "#rrggbb" colour`);
      if (r.within === undefined)
        fail(`${path}.within`, 'is missing: "near" needs a distance (ΔE)');
      else if (typeof r.within !== 'number' || !(r.within > 0))
        fail(`${path}.within`, 'must be a number above 0 (ΔE, as the report prints it)');
      if (isHex(r.near) && typeof r.within === 'number')
        rule.near = { hex: r.near.toLowerCase(), within: r.within };
    }

    if (typeof r.to !== 'string')
      fail(`${path}.to`, 'must name a whitelist token, like "watcher-stone"');
    else {
      const token = TOKENS.find((t) => t.name === r.to);
      if (!token)
        fail(
          `${path}.to`,
          `is "${r.to}", which is not a palette token (name a whitelist token, not a hex)`,
        );
      else if (NEVER.includes(token.hex))
        fail(`${path}.to`, `is "${r.to}", a reserved colour no sheet may use`);
      else if (!WHITELIST.includes(token.hex) && !TELEGRAPH.includes(token.hex))
        fail(`${path}.to`, `is "${r.to}", which is not a whitelist token`);
      else {
        rule.to = token.name;
        rule.hex = token.hex;
      }
    }

    const list = (key: 'anims' | 'facings' | 'frames', what: string): string[] | undefined => {
      const val = r[key];
      if (val === undefined) return undefined;
      if (!Array.isArray(val) || val.length === 0 || !val.every((x) => typeof x === 'string')) {
        fail(`${path}.${key}`, `must be a non-empty list of ${what}`);
        return undefined;
      }
      return val;
    };
    const a = list('anims', 'animation names');
    a?.forEach((x, j) => {
      if (!anims.has(x))
        fail(`${path}.anims[${j}]`, `is "${x}", which is not an animation of this recipe`);
    });
    if (a) rule.anims = a;
    const f = list('facings', 'facings');
    if (f && !facings) fail(`${path}.facings`, 'is only for kinds with facings (kindled, npc)');
    f?.forEach((x, j) => {
      if (!(SPRITE_FACINGS as readonly string[]).includes(x))
        fail(
          `${path}.facings[${j}]`,
          `is "${x}", which is not a facing (${SPRITE_FACINGS.join(', ')})`,
        );
    });
    if (f) rule.facings = f as Facing[];
    const fr = list('frames', 'frame names');
    fr?.forEach((x, j) => {
      if (!names.has(x))
        fail(`${path}.frames[${j}]`, `names "${x}", which is not a frame this recipe builds`);
    });
    if (fr) rule.frames = fr;

    if (r.box !== undefined) {
      if (isRect(r.box)) rule.box = [r.box];
      else if (Array.isArray(r.box) && r.box.length > 0 && r.box.every(isRect)) rule.box = r.box;
      else fail(`${path}.box`, `must be ${RECT_SHAPE} or a non-empty list of them`);
    }
    if (r.exclude !== undefined) {
      const items: Json[] =
        r.exclude === 'face' || isRect(r.exclude)
          ? [r.exclude]
          : Array.isArray(r.exclude)
            ? r.exclude
            : [];
      if (items.length === 0 || !items.every((x) => x === 'face' || isRect(x)))
        fail(`${path}.exclude`, `must be "face", ${RECT_SHAPE}, or a non-empty list of them`);
      else rule.exclude = { face: items.includes('face'), boxes: items.filter(isRect) };
    }

    if (!state.ok || rule.to === undefined || rule.hex === undefined) return;
    const done = rule as RemapRule;
    if (TELEGRAPH.includes(done.hex)) {
      const outside = frames.filter((fr2) => appliesTo(done, fr2) && !isTelegraph(fr2));
      if (outside.length) {
        bad(
          `${path}.to`,
          `is "${done.to}", which only telegraph* frames may use, but the rule also applies to ${outside[0]?.name ?? ''}` +
            '; narrow it with "anims" or "frames"',
        );
        return;
      }
    }
    rules.push(done);
  });
  return rules;
}

/** Per remap rule (in recipe order): the pixels it took, per animation it applies to, in build order. */
export type RemapCounts = Map<string, number>[];

/** The indices of the rules that took no pixel in any frame they apply to (stale rules). */
export function staleRules(counts: RemapCounts): number[] {
  return counts.flatMap((c, i) => ([...c.values()].some((n) => n > 0) ? [] : [i]));
}

/** The message for a stale rule: a failure in a finished build, a report line in a draft. */
export function staleRuleText(sheet: string, i: number, rule: RemapRule | undefined): string {
  return (
    `${sheet}: remap[${i}] (${rule ? ruleMaps(rule) : ''}) matches no pixel in any frame it applies to; ` +
    'remove it, or fix its colours or scope'
  );
}

/** What a rule does, for the report: its match and its token. */
export function ruleMaps(rule: RemapRule): string {
  const match = rule.near
    ? `near ${rule.near.hex} within ${rule.near.within}`
    : `from ${(rule.from ?? []).join(' ')}`;
  return `${match} → ${rule.to}`;
}

const rectText = (r: Rect): string => `[${r.join(', ')}]`;

/** Where a rule applies, for the report ("everywhere" without a scope). */
export function ruleScope(rule: RemapRule): string {
  const parts: string[] = [];
  if (rule.anims) parts.push(`anims ${rule.anims.join(' ')}`);
  if (rule.facings) parts.push(`facings ${rule.facings.join(' ')}`);
  if (rule.frames) parts.push(`frames ${rule.frames.join(' ')}`);
  if (rule.box) parts.push(`box ${rule.box.map(rectText).join(' ')}`);
  if (rule.exclude) {
    const ex = [...(rule.exclude.face ? ['face'] : []), ...rule.exclude.boxes.map(rectText)];
    parts.push(`exclude ${ex.join(' ')}`);
  }
  return parts.length ? parts.join('; ') : 'everywhere';
}

const snapPlain = nearestCache(WHITELIST);

/**
 * The face of a source frame for `exclude: "face"`: the bounding box of the
 * pixels that snap to the freckle colour, grown by `FACE_MARGIN`. Null for a
 * frame with no freckle (a back view has no face).
 */
export function faceBox(img: Img): Rect | null {
  let x0 = img.w;
  let y0 = img.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y) || snapPlain(hexAt(img, x, y)).hex !== FRECKLE) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  return [x0 - FACE_MARGIN, y0 - FACE_MARGIN, x1 + FACE_MARGIN, y1 + FACE_MARGIN];
}

const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/**
 * Step 4: the recipe's remap rules on one source frame (after the fixes,
 * before the reserved-colour check and the snap). Each opaque pixel takes the
 * first rule that applies to the frame, takes in the pixel (`box`, `exclude`)
 * and matches its colour. Returns the frame and, per rule index, the pixels it
 * took. Fails when a rule's rectangle reaches outside the frame; `file` is the
 * recipe's path, for that message.
 */
export function applyRemap(
  img: Img,
  rules: readonly RemapRule[],
  frame: FrameRef,
  file: string,
): { img: Img; taken: number[] } {
  const taken = rules.map(() => 0);
  const active = rules.map((r, i) => ({ r, i })).filter(({ r }) => appliesTo(r, frame));
  if (!active.length) return { img, taken };
  const problems: string[] = [];
  for (const { r, i } of active) {
    const rects: [string, Rect][] = [
      ...(r.box ?? []).map((b): [string, Rect] => ['box', b]),
      ...(r.exclude?.boxes ?? []).map((b): [string, Rect] => ['exclude', b]),
    ];
    for (const [field, b] of rects) {
      if (b[2] >= img.w || b[3] >= img.h) {
        problems.push(
          `${file}: remap[${i}].${field} ${rectText(b)} reaches outside the ${img.w}×${img.h} source frame of ${frame.name}`,
        );
      }
    }
  }
  if (problems.length) throw new PipelineError(problems);
  const face = active.some(({ r }) => r.exclude?.face) ? faceBox(img) : null;
  const matches = active.map(({ r }) => {
    const memo = new Map<string, boolean>();
    return (hex: string): boolean => {
      let hit = memo.get(hex);
      if (hit === undefined) {
        hit = r.near ? deltaE(hex, r.near.hex) <= r.near.within : (r.from ?? []).includes(hex);
        memo.set(hex, hit);
      }
      return hit;
    };
  });
  const out = cloneImg(img);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (!opaqueAt(img, x, y)) continue;
      const hex = hexAt(img, x, y);
      const k = active.findIndex(({ r }, j) => {
        if (r.box && !r.box.some((b) => inRect(b, x, y))) return false;
        if (r.exclude) {
          if (r.exclude.face && face && inRect(face, x, y)) return false;
          if (r.exclude.boxes.some((b) => inRect(b, x, y))) return false;
        }
        return matches[j]?.(hex) ?? false;
      });
      const hit = active[k];
      if (!hit) continue;
      setPixel(out, x, y, hit.r.hex);
      taken[hit.i] = (taken[hit.i] ?? 0) + 1;
    }
  }
  return { img: out, taken };
}
