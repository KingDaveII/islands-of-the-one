import type { RunState } from '@iot/sim';

/**
 * The interact prompt (docs/design/controls.md): shown only in Calm, over the
 * nearest thing in reach that needs an interact press. Chests, loot and
 * traces open on contact in both contexts and never prompt. Nothing in M1
 * needs interact (the Glowing Shell pickup comes in hour two), so
 * `interactables` is empty and the prompt never shows; the code and its
 * test stay so the first interactable only has to be listed here.
 */
export interface Interactable {
  /** World position, sim units. */
  x: number;
  y: number;
  /** The word next to the glyph ("TAKE", "READ"). */
  label: string;
}

/** Everything in the room that needs an interact press. Empty in M1: the first is the Glowing Shell pickup (hour two). */
export function interactables(): Interactable[] {
  return [];
}

/**
 * The interactable to prompt for: the nearest within `rangeUnits` of the
 * player, in Calm only, while the player is alive. Null otherwise.
 */
export function promptTarget(s: RunState, rangeUnits: number, targets: readonly Interactable[] = interactables()): Interactable | null {
  if (s.context !== 'calm' || s.player.action === 'dead') return null;
  let best: { target: Interactable; d: number } | null = null;
  for (const t of targets) {
    const d = Math.hypot(t.x - s.player.x, t.y - s.player.y);
    if (d <= rangeUnits && (!best || d < best.d)) best = { target: t, d };
  }
  return best ? best.target : null;
}
