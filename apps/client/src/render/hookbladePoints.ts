import { engineSheetMeta, framePoint, type HookbladeFxSheet, type KindledPoint, type SpriteSheet } from '@iot/shared';
import { PLAYER_FEET } from './feet.js';
import { worldPx } from './scale.js';

/**
 * Where the Hookblade's effects come off the player (sprites.md §5, §8): the
 * charge spark at the frame's `tip`, the Haul chain from its `hand`. A point
 * maps to the world like the frame itself, from the anchor the sprite is drawn
 * at, so the spark and the chain move with the sprite pixel for pixel. Every
 * frame of `heavy_charge` and the `haul_*` animations carries its point (the
 * sheet test guarantees it); the one frame shown over those actions without
 * one is the hit flinch after an armored hit, for which `HookbladeAnchors`
 * keeps the last point drawn in the same action (MAIN on #61), else the body
 * centre. Everything here is world px.
 */

type Point = { x: number; y: number };

/**
 * A frame's point in the world: `anchor + (point − cell origin)`, where
 * `anchor` is the world px the sprite's origin is drawn at (a sheet px is a
 * world px). Null when the frame has no such point.
 */
export function pointInWorld(sheet: SpriteSheet, frame: string, point: KindledPoint, anchor: Point): Point | null {
  const p = framePoint(sheet, frame, point);
  if (!p) return null;
  const { origin } = sheet.meta;
  return { x: anchor.x + (p.x - origin.x), y: anchor.y + (p.y - origin.y) };
}

/** Where the player is drawn this frame: the sheet, its frame and anchor (the origin, the line under the soles, in world px), and the sim's action. */
export interface PlayerFrame {
  sheet: SpriteSheet;
  frame: string;
  anchor: Point;
  /** The player's sim action (`charge`, `ability`, ...): a point is remembered within one action. */
  action: string;
}

/**
 * A Hookblade point in world px: the frame's own, else the body centre,
 * `PLAYER_FEET` above the anchor. The renderer asks through
 * `HookbladeAnchors`, which remembers the last point of the action first.
 */
export function hookbladePoint(player: PlayerFrame, point: KindledPoint): Point {
  return pointInWorld(player.sheet, player.frame, point, player.anchor) ?? bodyCentre(player.anchor);
}

/**
 * The Hookblade's points frame by frame, with a memory: a frame that has the
 * point sets it; a frame without one (the hit flinch, shown for 100 ms over a
 * charge or a Haul after an armored hit) keeps the last point drawn in the
 * same action, as an offset from the anchor, so the spark and the chain stay
 * put on the Kindled (and move with it); an action with no earlier point
 * gives the body centre. The memory clears when the action changes.
 */
export class HookbladeAnchors {
  private action = '';
  private readonly last = new Map<KindledPoint, Point>();

  /** The point for this frame (world px). */
  at(player: PlayerFrame, point: KindledPoint): Point {
    if (player.action !== this.action) {
      this.action = player.action;
      this.last.clear();
    }
    const own = pointInWorld(player.sheet, player.frame, point, player.anchor);
    if (own) {
      this.last.set(point, { x: own.x - player.anchor.x, y: own.y - player.anchor.y });
      return own;
    }
    const kept = this.last.get(point);
    return kept ? { x: player.anchor.x + kept.x, y: player.anchor.y + kept.y } : bodyCentre(player.anchor);
  }
}

/** The body centre in world px from the anchor the sprite stands on (feet.ts: the feet are `PLAYER_FEET` sim px below it). */
export function bodyCentre(anchor: Point): Point {
  return { x: anchor.x, y: anchor.y - worldPx(PLAYER_FEET) };
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
