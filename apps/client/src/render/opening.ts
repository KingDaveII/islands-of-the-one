/**
 * Something that opens once and stays open (a tile door, G1.5e; the chest,
 * G1.5f), as the client sees it from a flag of the sim state on the client
 * clock: what it has seen so far (`OpenView`, `nextOpenView`) and which of
 * its closed / opening / open animations shows now (`openingStateAt`). The
 * client only renders it: `doorOpen` and `ChestState.opened` are the sim's.
 */

/** What the client has seen: open or not, and since when it has been opening (null: open when first seen). */
export interface OpenView {
  open: boolean;
  since: number | null;
}

/**
 * The view after this frame's flag: something open when the client first
 * sees it shows open (`prev` null); the flag turning true starts the opening
 * at `timeMs`; turning false closes it.
 */
export function nextOpenView(prev: OpenView | null, open: boolean, timeMs: number): OpenView {
  if (!prev) return { open, since: null };
  if (!open) return { open: false, since: null };
  if (!prev.open) return { open: true, since: timeMs };
  return prev;
}

/** Which animation shows: closed; opening, at its frame `n`; or open, held. */
export type OpeningState = { state: 'closed' } | { state: 'opening'; n: number } | { state: 'open' };

/**
 * The state at `timeMs`: closed while shut; `opening` frame by frame at
 * `fps` from when it turned open, once; then open, held (also for something
 * open when first seen, and when there are no opening frames).
 */
export function openingStateAt(view: OpenView, opening: { frames: number; fps: number }, timeMs: number): OpeningState {
  if (!view.open) return { state: 'closed' };
  if (view.since === null) return { state: 'open' };
  const n = Math.floor(((timeMs - view.since) * Math.max(1, opening.fps)) / 1000);
  return n < opening.frames ? { state: 'opening', n: Math.max(0, n) } : { state: 'open' };
}

/** The frame of a looping animation at `timeMs` on the client clock: `floor(t × fps / 1000) mod frames`; 0 with one frame or no rate. */
export function loopFrameAt(frames: number, fps: number, timeMs: number): number {
  if (frames <= 1 || fps <= 0) return 0;
  return Math.floor((timeMs * fps) / 1000) % frames;
}
