import {
  engineSheetMeta,
  framePoint,
  sheetPixelScale,
  type HookbladeFxSheet,
  type KindledPoint,
  type SpriteSheet,
} from '@iot/shared';
import { facingStep } from './facing.js';
import { worldPx } from './scale.js';

/**
 * Where the Hookblade's effects come off the player (sprites.md §5, §8): the
 * charge spark at the frame's `tip`, the Haul chain from its `hand`. A point
 * maps to the world like the frame itself, from the anchor the sprite is drawn
 * at, so the spark and the chain move with the sprite pixel for pixel. A frame
 * without the point (a v1 sheet, a fixture) keeps M1's offsets
 * (`m1HookbladeOffset`). Everything here is world px.
 */

type Point = { x: number; y: number };

/**
 * A frame's point in the world: `anchor + (point − cell origin) × pixelScale`,
 * where `anchor` is the world px the sprite's origin is drawn at. Null when
 * the frame has no such point.
 */
export function pointInWorld(sheet: SpriteSheet, frame: string, point: KindledPoint, anchor: Point): Point | null {
  const p = framePoint(sheet, frame, point);
  if (!p) return null;
  const scale = sheetPixelScale(sheet);
  const { origin } = sheet.meta;
  return { x: anchor.x + (p.x - origin.x) * scale, y: anchor.y + (p.y - origin.y) * scale };
}

/**
 * The v1 fallback: M1's offsets, in sim px from the body centre, from before
 * frames carried points. The spark sits forward of the body by the facing
 * (index into `SPRITE_FACINGS`); the chain starts 2 px above the centre in
 * every facing. Only used for a frame without the point.
 */
export function m1HookbladeOffset(point: KindledPoint, facing: number): Point {
  if (point === 'hand') return { x: 0, y: -2 };
  const dir = facingStep(facing);
  return {
    x: dir.x === 0 ? (facing >= 5 ? -5 : 5) : dir.x * 12,
    y: 1 + Math.max(0, dir.y) + dir.y * 6 - (dir.x !== 0 && dir.y === 0 ? 2 : 0),
  };
}

/** Where the player is drawn this frame: the sheet, its frame and anchor (world px), the facing and the body centre (whole sim px). */
export interface PlayerFrame {
  sheet: SpriteSheet;
  frame: string;
  anchor: Point;
  facing: number;
  body: Point;
}

/** A Hookblade point in world px: the frame's own, else M1's offset from the body centre (whole sim px, ×2). */
export function hookbladePoint(player: PlayerFrame, point: KindledPoint): Point {
  const own = pointInWorld(player.sheet, player.frame, point, player.anchor);
  if (own) return own;
  const off = m1HookbladeOffset(point, player.facing);
  return { x: worldPx(player.body.x + off.x), y: worldPx(player.body.y + off.y) };
}

/** How hookblade-fx draws (sprites.md "Engine sheets"): world px per sheet px, tinted or in its own colours. */
export function hookbladeDraw(sheet: HookbladeFxSheet): { scale: number; tinted: boolean; spacing: number; clear: number } {
  const { pixelScale, tinted } = engineSheetMeta(sheet);
  return {
    scale: pixelScale,
    tinted,
    /** World px between links. */
    spacing: sheet.chain.spacing * pixelScale,
    /** The last link stays this far (world px) short of the hook: 2 sheet px. */
    clear: 2 * pixelScale,
  };
}

/**
 * The chain's links from the hand (hx, hy) to the hook (ex, ey), world px:
 * one every `spacing`, the first half a spacing out from the hand, none in
 * the last `clear` px; each at a whole world px, all at the chain's angle.
 */
export function chainLinks(
  sheet: HookbladeFxSheet,
  hx: number,
  hy: number,
  ex: number,
  ey: number,
  max: number,
): { x: number; y: number; angle: number }[] {
  const len = Math.hypot(ex - hx, ey - hy);
  if (len < 1) return [];
  const ux = (ex - hx) / len;
  const uy = (ey - hy) / len;
  const angle = Math.atan2(uy, ux);
  const { spacing, clear } = hookbladeDraw(sheet);
  const out: { x: number; y: number; angle: number }[] = [];
  for (let d = spacing / 2; d < len - clear && out.length < max; d += spacing) {
    out.push({ x: Math.round(hx + ux * d), y: Math.round(hy + uy * d), angle });
  }
  return out;
}
