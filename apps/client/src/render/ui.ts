import type Phaser from 'phaser';
import { Palette } from '../palette.js';
import { squareSweep } from './pixels.js';

/**
 * Design-system UI pieces drawn in game pixels: Panel, AbilitySlot,
 * HealthBar, tier pips, and the small pixel icons they hold.
 */
type G = Phaser.GameObjects.Graphics;

/**
 * Panel: dark fired clay (ui-panel face) with a 1 px ui-outline outline and
 * chamfered corners, a raised top-left ui-bevel, a hard 1 px drop shadow, and
 * (unless `plain`) a thin glowing rim cracked open at each corner. (x, y, w, h)
 * is the outer box including the outline; the shadow adds 1 px below.
 */
export function panel(g: G, x: number, y: number, w: number, h: number, opts: { plain?: boolean; rim?: number } = {}): void {
  // Outline + drop shadow, corners chamfered by 1 px.
  g.fillStyle(Palette.uiOutline, 1);
  g.fillRect(x + 1, y, w - 2, h + 1);
  g.fillRect(x, y + 1, w, h - 1);
  // Face with the bevel along the top and left.
  g.fillStyle(Palette.uiPanel, 1).fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(Palette.uiBevel, 1).fillRect(x + 1, y + 1, w - 2, 1).fillRect(x + 1, y + 1, 1, h - 2);
  if (opts.plain) return;
  // Rim: 1 px, inset, broken at the corners.
  const rx = x + 3;
  const ry = y + 3;
  const rw = w - 5;
  const rh = h - 5;
  g.fillStyle(opts.rim ?? Palette.uiRim, 1);
  g.fillRect(rx + 2, ry, rw - 4, 1);
  g.fillRect(rx + 2, ry + rh - 1, rw - 4, 1);
  g.fillRect(rx, ry + 2, 1, rh - 4);
  g.fillRect(rx + rw - 1, ry + 2, 1, rh - 4);
}

/** Rim divider between stats and lore: a line with a 2 px gap. */
export function divider(g: G, x: number, y: number, w: number): void {
  g.fillStyle(Palette.uiBevel, 1).fillRect(x, y, 4, 1).fillRect(x + 6, y, w - 6, 1);
}

/** Tier pips: rarity shows as a count as well as a color. */
export function tierPips(g: G, x: number, y: number, tier: number, max = 5): void {
  const color = Palette.rarity[Math.max(0, Math.min(Palette.rarity.length - 1, tier - 1))] ?? Palette.uiInk;
  for (let i = 0; i < max; i++) {
    g.fillStyle(Palette.uiOutline, 1).fillRect(x + i * 4 - 1, y - 1, 4, 4);
    g.fillStyle(i < tier ? color : Palette.uiBevel, 1).fillRect(x + i * 4, y, 2, 2);
  }
}

export type IconKind = 'haul' | 'catch' | 'sweep' | 'dodge' | 'lock' | 'hookblade' | 'spark' | 'slash' | 'thrust' | 'ration';

/** Small pixel icons, drawn into a box of `size` px at (x, y). */
export function icon(g: G, kind: IconKind, x: number, y: number, size: number, color: number): void {
  const c = (dx: number, dy: number, w = 1, h = 1): void => {
    g.fillRect(x + dx, y + dy, w, h);
  };
  g.fillStyle(color, 1);
  const m = Math.floor(size / 2);
  switch (kind) {
    case 'haul':
      // A chain of links ending in a hook.
      c(m - 7, m, 2, 1);
      c(m - 4, m, 2, 1);
      c(m - 1, m, 2, 1);
      c(m + 2, m - 2, 1, 5);
      c(m + 3, m - 3, 3, 1);
      c(m + 3, m + 2, 3, 1);
      c(m + 5, m - 2, 1, 2);
      break;
    case 'catch':
      // An open hand: a cup shape.
      c(m - 4, m - 3, 1, 5);
      c(m + 3, m - 3, 1, 5);
      c(m - 3, m + 2, 6, 1);
      c(m - 1, m - 5, 2, 1);
      break;
    case 'thrust':
      // A straight thrust: a line with a hooked tip.
      c(m - 6, m, 10, 2);
      c(m + 4, m - 2, 1, 2);
      c(m + 2, m - 2, 2, 1);
      c(m - 7, m - 1, 1, 4);
      break;
    case 'ration':
      // A wrapped bundle.
      c(m - 4, m - 2, 8, 6);
      g.fillStyle(Palette.uiPanel, 1);
      c(m - 1, m - 2, 1, 6);
      c(m - 4, m + 1, 8, 1);
      g.fillStyle(color, 1);
      c(m - 2, m - 4, 4, 2);
      break;
    case 'slash':
      // A quick diagonal cut.
      for (let i = 0; i < 7; i++) c(m - 4 + i, m + 2 - i, 1, 1);
      for (let i = 0; i < 5; i++) c(m - 3 + i, m + 3 - i, 1, 1);
      break;
    case 'sweep':
      // A broken circle.
      c(m - 3, m - 5, 6, 1);
      c(m + 4, m - 3, 1, 6);
      c(m - 3, m + 4, 6, 1);
      c(m - 5, m - 3, 1, 4);
      break;
    case 'dodge':
      // Two chevrons.
      for (let i = 0; i < 3; i++) {
        c(m - 4 + i, m - 2 + i, 1, 1);
        c(m - 4 + i, m + 2 - i, 1, 1);
        c(m + i, m - 2 + i, 1, 1);
        c(m + i, m + 2 - i, 1, 1);
      }
      break;
    case 'lock':
      // Shackle and body.
      c(m - 2, m - 4, 4, 1);
      c(m - 3, m - 3, 1, 3);
      c(m + 2, m - 3, 1, 3);
      c(m - 4, m, 8, 5);
      g.fillStyle(Palette.uiPanel, 1);
      c(m - 1, m + 1, 2, 2);
      break;
    case 'hookblade':
      // A blade with a hooked tip and a grip.
      for (let i = 0; i < 9; i++) c(m - 5 + i, m + 4 - i, 1, 1);
      c(m + 3, m - 5, 3, 1);
      c(m + 5, m - 4, 1, 2);
      g.fillStyle(Palette.playerShirt, 1);
      c(m - 6, m + 4, 2, 2);
      break;
    case 'spark':
      c(m - 1, m - 4, 3, 9);
      c(m - 2, m - 2, 5, 5);
      c(m - 3, m - 1, 7, 3);
      g.fillStyle(Palette.sparkDeep, 1);
      c(m, m + 1, 1, 2);
      c(m + 1, m, 1, 1);
      break;
  }
}

export interface SlotState {
  icon: IconKind;
  /** Fraction of the cooldown remaining, 0 = ready. */
  cooldown: number;
  locked: boolean;
  /** The frame lights up for this frame (just came back / in use). */
  ready: boolean;
  /** Small 14×14 (dodge, consumables) or 20×20. */
  small?: boolean;
  active?: boolean;
  /** An empty consumable slot: sunken, icon dimmed. */
  empty?: boolean;
}

/**
 * AbilitySlot (20×20, or 14×14 small): ui-outline outline, a 1 px frame
 * (lit when ready), the icon, a cooldown sweep darkening the remaining time
 * clockwise from 12 o'clock. Locked: dark sunken frame and a lock in
 * hollow-dusk, no key hint. Seconds and key hints are Text placed by the HUD.
 */
export function abilitySlot(g: G, x: number, y: number, s: SlotState): void {
  const size = s.small ? 14 : 20;
  g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, size, size);
  const frame = s.locked ? Palette.uiOutline : s.ready ? Palette.uiFocus : Palette.uiBevel;
  g.fillStyle(frame, 1).fillRect(x + 1, y + 1, size - 2, size - 2);
  const inner = size - 4;
  const ix = x + 2;
  const iy = y + 2;
  g.fillStyle(s.locked ? Palette.hollow : Palette.uiPanel, 1).fillRect(ix, iy, inner, inner);
  if (s.locked) {
    icon(g, 'lock', ix, iy, inner, Palette.uiInkMuted);
    return;
  }
  icon(g, s.icon, ix, iy, inner, s.empty ? Palette.uiBevel : s.cooldown > 0 ? Palette.uiBevel : s.active ? Palette.uiFocus : Palette.uiInk);
  if (s.cooldown > 0) {
    const half = inner / 2;
    const pts = squareSweep(ix + half, iy + half, half, 1 - s.cooldown, 1);
    g.fillStyle(Palette.uiPanel, 0.8).fillPoints(pts, true, true);
  }
}

/**
 * HealthBar: 64 px of the player's own light on a dark track (5 px), ticks
 * every 10 HP, the recent loss in health-loss draining after hitstop, and the
 * whole fill in health-loss below 25%.
 */
export function healthBar(g: G, x: number, y: number, hp: number, max: number, lag: number, width = 64): void {
  const trackH = 5;
  g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, width + 2, trackH + 3);
  const tx = x + 1;
  const ty = y + 1;
  g.fillStyle(Palette.uiPanel, 1).fillRect(tx, ty, width, trackH);
  g.fillStyle(Palette.hollow, 1).fillRect(tx, ty, width, 1);
  const w = Math.round((width * Math.max(0, hp)) / max);
  const lw = Math.round((width * Math.max(0, lag)) / max);
  if (lw > w) g.fillStyle(Palette.healthLoss, 1).fillRect(tx + w, ty, lw - w, trackH);
  const low = hp < max * 0.25;
  g.fillStyle(low ? Palette.healthLoss : Palette.healthFill, 1).fillRect(tx, ty, w, trackH);
  g.fillStyle(low ? Palette.healthLow : Palette.healthShade, 1).fillRect(tx, ty + trackH - 1, w, 1);
  g.fillStyle(Palette.uiOutline, 1);
  for (let v = 10; v < max; v += 10) g.fillRect(tx + Math.round((width * v) / max) - 1, ty, 1, trackH);
}
