import { controlsData, type TouchButtonSpec, type TouchData } from '@iot/shared';
import { fitUi, type Rect } from './view.js';

/**
 * The touch layer's logic (M2 Task 10, docs/design/controls.md §6), pure so
 * it is tested in node: where every control sits on the UI grid for a
 * screen, which control a touch that lands somewhere belongs to, the
 * floating stick's math and a tap told from a drag. Sizes are CSS px in data
 * (`controls.json` `touch`: a thumb's size doesn't change with the screen),
 * converted to whole UI px here. ui/touchControls.ts draws the layer and
 * game/touchInput.ts turns its touches into the sampler's input.
 */
export const TOUCH: TouchData = controlsData.touch;

/** The touch controls: the attack, dodge and ability buttons and USE (discs), the gear and the two item slots (chamfered squares). */
export const TOUCH_CONTROL_IDS = [
  'light',
  'heavy',
  'dodge',
  'ability1',
  'ability2',
  'ability3',
  'use',
  'gear',
  'item1',
  'item2',
] as const;
export type TouchControlId = (typeof TOUCH_CONTROL_IDS)[number];

/** The ability arc's buttons, in slot order. */
export const ABILITY_CONTROLS = ['ability1', 'ability2', 'ability3'] as const;
export type AbilityControl = (typeof ABILITY_CONTROLS)[number];

/** Where the layer is: a run (the attack cluster, the item slots, the gear) or the holding (USE alone, the gear). */
export type TouchMode = 'run' | 'holding';

/** A screen as the layer sees it: the canvas in UI px and how many CSS px one UI px is. */
export interface TouchScreen {
  w: number;
  h: number;
  cssPerUi: number;
}

/** One placed control: its shape, its rectangle on the UI grid (whole px, `size` across) and its centre. */
export interface TouchControl {
  id: TouchControlId;
  shape: 'disc' | 'square';
  rect: Rect;
  cx: number;
  cy: number;
  size: number;
}

export interface TouchLayout {
  screen: TouchScreen;
  controls: TouchControl[];
  /** The stick's travel (UI px, whole). */
  stickRadius: number;
  /** How far a finger leaves an attack or ability button's centre before it aims (UI px). */
  aimDrag: number;
  /** A tap moves less than this (UI px) and lasts at most `tapMaxMs`. */
  tapMove: number;
  tapMaxMs: number;
  /** The band at the top centre the controls never cover (UI px). */
  topCentre: Rect;
}

export interface TouchLayoutOptions {
  mode: TouchMode;
  /** The ability buttons that show: the unlocked slots only (GAME DESIGN, 2026-10-21: the arc grows as abilities unlock). */
  abilities?: readonly AbilityControl[];
  /** Rectangles no control may cover: the HUD's panels (UI px). */
  avoid?: readonly Rect[];
}

/** The touch screen for a canvas of `deviceW × deviceH` device px at a device pixel ratio: the UI grid's size and its CSS px per UI px. */
export function touchScreen(deviceW: number, deviceH: number, dpr: number): TouchScreen {
  const ui = fitUi(deviceW, deviceH);
  return { w: ui.w, h: ui.h, cssPerUi: ui.zU / (dpr > 0 ? dpr : 1) };
}

/** A control's size in whole UI px: its CSS size, never under the minimum, rounded up so it is never smaller than asked. */
export function controlPx(sizeCss: number, cssPerUi: number, minCss: number = TOUCH.buttonMinCssPx): number {
  return Math.ceil(Math.max(sizeCss, minCss) / cssPerUi - 1e-9);
}

/** The controls a mode shows, with the data spec each is placed by. */
function controlsFor(mode: TouchMode, abilities: readonly AbilityControl[], data: TouchData): [TouchControlId, TouchButtonSpec][] {
  const b = data.buttons;
  if (mode === 'holding')
    return [
      ['gear', b.gear],
      ['use', b.useAlone],
    ];
  // The top right first (the gear and the item slots have the least room), then the cluster round LIGHT.
  return [
    ['gear', b.gear],
    ['item2', b.item2],
    ['item1', b.item1],
    ['light', b.light],
    // HEAVY moves up into the arc's second slot while that slot is hidden (locked), off the room's bottom-right edge (ART on #134).
    ['heavy', abilities.includes('ability2') ? b.heavy : { ...b.heavy, dx: b.ability2.dx, dy: b.ability2.dy }],
    ['dodge', b.dodge],
    ...ABILITY_CONTROLS.filter((id) => abilities.includes(id)).map((id): [TouchControlId, TouchButtonSpec] => [id, b[id]]),
    ['use', b.use],
  ];
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });

/** Offsets (dx, dy ≥ 0) within `max` of the origin, nearest first: where a control looks when its own place is taken. */
const offsetCache = new Map<number, [number, number][]>();
function offsetsWithin(max: number): [number, number][] {
  const cached = offsetCache.get(max);
  if (cached) return cached;
  const out: [number, number][] = [];
  for (let dy = 0; dy <= max; dy++) for (let dx = 0; dx <= max; dx++) if (dx * dx + dy * dy <= max * max) out.push([dx, dy]);
  out.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || a[1] - b[1]);
  offsetCache.set(max, out);
  return out;
}

/** The band at the top centre of a screen the controls keep clear (the room's, GAME DESIGN). */
export function topCentreRect(screen: Pick<TouchScreen, 'w' | 'h'>, data: TouchData = TOUCH): Rect {
  const w = Math.round(screen.w * data.topCentreClear.widthShare);
  return { x: Math.round((screen.w - w) / 2), y: 0, w, h: Math.round(screen.h * data.topCentreClear.heightShare) };
}

/**
 * Lay the controls out on a screen: each at its offset in from its corner,
 * the top right first, then the cluster from LIGHT out. A control whose place is off the screen, over
 * a HUD panel (`avoid`), over the top centre or over a control placed before
 * it (each kept `gapCssPx` apart) moves to the nearest free place, inwards
 * from its corner only (up and left for the bottom right), so the cluster
 * keeps its shape as far as it can; the item slots start from where the
 * gear went, so the top right stays one row.
 */
export function touchLayout(screen: TouchScreen, opts: TouchLayoutOptions, data: TouchData = TOUCH): TouchLayout {
  const z = screen.cssPerUi > 0 ? screen.cssPerUi : 1;
  const gap = Math.ceil(data.gapCssPx / z);
  const topCentre = topCentreRect(screen, data);
  const blocked: Rect[] = [topCentre, ...(opts.avoid ?? []).filter((r) => r.w > 0 && r.h > 0).map((r) => grow(r, gap))];
  const placed: TouchControl[] = [];
  const free = (r: Rect): boolean =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= screen.w && r.y + r.h <= screen.h && !blocked.some((b) => overlaps(b, r)) && !placed.some((c) => overlaps(grow(c.rect, gap), r));
  const reach = offsetsWithin(Math.ceil(Math.max(screen.w, screen.h) / 2));
  // How far a top corner's first control (the gear) had to move: the rest of its row start from there.
  const shift = new Map<string, { x: number; y: number }>();
  for (const [id, spec] of controlsFor(opts.mode, opts.abilities ?? [], data)) {
    const size = controlPx(spec.size, z, data.buttonMinCssPx);
    const right = spec.corner === 'br' || spec.corner === 'tr';
    const bottom = spec.corner === 'br' || spec.corner === 'bl';
    const cx = right ? screen.w - spec.dx / z : spec.dx / z;
    const cy = bottom ? screen.h - spec.dy / z : spec.dy / z;
    const lead = shift.get(spec.corner);
    const home: Rect = { x: Math.round(cx - size / 2) + (lead?.x ?? 0), y: Math.round(cy - size / 2) + (lead?.y ?? 0), w: size, h: size };
    // Inwards from the corner: left on the right side, up at the bottom.
    const sx = right ? -1 : 1;
    const sy = bottom ? -1 : 1;
    let rect = home;
    for (const [dx, dy] of reach) {
      const r = { ...home, x: home.x + sx * dx, y: home.y + sy * dy };
      if (free(r)) {
        rect = r;
        break;
      }
    }
    if (!lead && !bottom) shift.set(spec.corner, { x: rect.x - home.x, y: rect.y - home.y });
    placed.push({ id, shape: id === 'gear' || id === 'item1' || id === 'item2' ? 'square' : 'disc', rect, cx: rect.x + size / 2, cy: rect.y + size / 2, size });
  }
  return {
    screen,
    controls: placed,
    stickRadius: Math.max(1, Math.round(data.stickRadiusCssPx / z)),
    aimDrag: data.aimDragCssPx / z,
    tapMove: data.tapMaxCssPx / z,
    tapMaxMs: data.tapMaxMs,
    topCentre,
  };
}

/**
 * Where a control's transient line goes (ART on #136; the gear's "Tap again to leave the run."): on the control's own
 * row, its right edge against the control's left edge, so it covers a readout (ROOM 1/3) and never something to tap.
 * When that place would leave the screen or cover another control, it moves to the same row centred on the screen
 * (the world view is centred), still clear of every control if it can be. `w` × `h` is the line's panel, UI px.
 */
export function notePlace(layout: TouchLayout, id: TouchControlId, w: number, h: number): Rect | null {
  const c = layout.controls.find((x) => x.id === id);
  if (!c) return null;
  const y = Math.round(c.cy - h / 2);
  const clear = (r: Rect): boolean =>
    r.x >= 0 && r.x + r.w <= layout.screen.w && r.y >= 0 && r.y + r.h <= layout.screen.h && !layout.controls.some((o) => o !== c && overlaps(o.rect, r));
  const beside = { x: c.rect.x - w, y, w, h };
  if (clear(beside)) return beside;
  return { x: Math.round((layout.screen.w - w) / 2), y, w, h };
}

/** The control a point (UI px) is on, among those showing: a disc by its radius, a square by its rectangle. */
export function controlAt(layout: TouchLayout, x: number, y: number, showing: (id: TouchControlId) => boolean = () => true): TouchControl | null {
  for (const c of layout.controls) {
    if (!showing(c.id)) continue;
    if (c.shape === 'disc') {
      const r = c.size / 2;
      if ((x - c.cx) ** 2 + (y - c.cy) ** 2 <= r * r) return c;
    } else if (x >= c.rect.x && x < c.rect.x + c.rect.w && y >= c.rect.y && y < c.rect.y + c.rect.h) return c;
  }
  return null;
}

/** What a touch that starts at a point belongs to (controls.md §6): a control, a HUD zone, the left stick or a tap. */
export type TouchZone = { kind: 'control'; id: TouchControlId } | { kind: 'hud' } | { kind: 'stick' } | { kind: 'tap' };

/**
 * The zone of a touch landing at (x, y) UI px: a showing control first; then
 * a HUD zone (`overHud`: an interactive object of the scene is under it, the
 * pack, the chip, a panel's button); then the left half anchors the stick
 * (while `stick` allows one: no stick while a panel is open) and anything
 * else is a tap.
 */
export function touchZone(
  layout: TouchLayout,
  x: number,
  y: number,
  opts: { overHud: boolean; stick: boolean; showing?: (id: TouchControlId) => boolean },
): TouchZone {
  const c = controlAt(layout, x, y, opts.showing);
  if (c) return { kind: 'control', id: c.id };
  if (opts.overHud) return { kind: 'hud' };
  if (opts.stick && x < layout.screen.w / 2) return { kind: 'stick' };
  return { kind: 'tap' };
}

/** The stick's knob for a finger (UI px): where the finger is, clamped to the travel round the anchor (the base never moves). */
export function stickKnob(anchor: { x: number; y: number }, finger: { x: number; y: number }, radius: number): { x: number; y: number } {
  const dx = finger.x - anchor.x;
  const dy = finger.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len <= radius || len === 0) return { x: finger.x, y: finger.y };
  return { x: anchor.x + (dx / len) * radius, y: anchor.y + (dy / len) * radius };
}

/** The stick's deflection for a finger: the knob's offset over the travel, length at most 1 (quantized by `quantizeMove` with the stick deadzone). */
export function stickVector(anchor: { x: number; y: number }, finger: { x: number; y: number }, radius: number): { x: number; y: number } {
  const k = stickKnob(anchor, finger, radius);
  const r = radius > 0 ? radius : 1;
  return { x: (k.x - anchor.x) / r, y: (k.y - anchor.y) / r };
}

/** Whether a touch was a tap: down and up within `tapMaxMs`, moving less than `tapMove` UI px from where it landed. */
export function isTap(layout: Pick<TouchLayout, 'tapMove' | 'tapMaxMs'>, down: { x: number; y: number; t: number }, up: { x: number; y: number; t: number }, travelled = 0): boolean {
  const moved = Math.max(travelled, Math.hypot(up.x - down.x, up.y - down.y));
  return up.t - down.t <= layout.tapMaxMs && moved < layout.tapMove;
}
