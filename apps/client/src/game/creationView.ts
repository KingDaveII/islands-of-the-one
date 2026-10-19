import {
  CREATION_CLAY_TONES,
  CREATION_STEPS,
  CREATION_TEXT,
  CREATION_TIMING,
  DEFAULT_CLAY_TONE,
  REMEMBRANCES,
  SPRITE_FACINGS,
  tiny5Font,
  wrapText,
  type ClayTone,
  type CreationStep,
  type Remembrance,
  type SpriteFacing,
} from '@iot/shared';
import { UI_W } from './view.js';

/**
 * Kindled creation (docs/design/accounts.md, M2 Task 9), the logic without
 * Phaser: the opening on black, the three steps (Remembrance, Appearance,
 * Name) with BACK and NEXT, the closing on black; the focus on each step,
 * what Left/Right, BACK and NEXT do, which Narrator line shows, and the
 * Appearance figure turning through the 8 facings (by itself, or by hand,
 * which pauses it until the player leaves the step). CreationScene draws it
 * and talks to the server.
 */

/** Where creation is: on black before, one of the steps, on black after (`closing`), then over (`done`). */
export type CreationPhase = 'opening' | CreationStep | 'closing' | 'done';

/** A focus row: a step's choices (the cards, the tones, the figure, the name field) or a button. */
export type FocusRow = 'cards' | 'tones' | 'figure' | 'field' | 'back' | 'next';

/** What the pointer is over: a Remembrance card, a tone swatch, or neither. */
export type Hover = 'card' | 'tone' | null;

/** The Appearance figure's turning: automatic from `since`, or turned by hand (paused) to `facing`. */
export interface Turn {
  manual: boolean;
  /** The facing (index in SPRITE_FACINGS) when turned by hand. */
  facing: number;
  /** When the automatic turning started (ms). */
  since: number;
}

export interface CreationState {
  phase: CreationPhase;
  /** When the phase began (ms). */
  since: number;
  focus: FocusRow;
  remembrance: Remembrance;
  tone: ClayTone;
  hover: Hover;
  /** Whether the name field is empty (the Name step's Narrator line). */
  nameEmpty: boolean;
  turn: Turn;
}

/** Drag this many UI px across the figure to turn it one facing. */
export const DRAG_TURN_PX = 24;

/** The Narrator's wrap width (UI px): the UI grid less a 16 px margin each side. */
export const NARRATOR_W = UI_W - 32;
/** The Narrator's most rows: a longer line wraps to two, never a smaller font (ART). */
export const NARRATOR_MAX_ROWS = 2;

export function initialCreation(now: number): CreationState {
  return {
    phase: 'opening',
    since: now,
    focus: 'cards',
    remembrance: REMEMBRANCES[0] ?? 'clay',
    tone: DEFAULT_CLAY_TONE,
    hover: null,
    nameEmpty: true,
    turn: { manual: false, facing: 0, since: now },
  };
}

export function isStep(phase: CreationPhase): phase is CreationStep {
  return (CREATION_STEPS as readonly string[]).includes(phase);
}

/** BACK works on every step but the first, where it is greyed. */
export function backEnabled(step: CreationStep): boolean {
  return CREATION_STEPS.indexOf(step) > 0;
}

/** The label of a step's NEXT: CONFIRM on the Name step. */
export function nextLabel(step: CreationStep): 'NEXT' | 'CONFIRM' {
  return step === 'name' ? 'CONFIRM' : 'NEXT';
}

/** A step's focus rows in Up/Down and Tab order: its choices, then BACK (unless greyed) and NEXT. */
export function focusRows(step: CreationStep): FocusRow[] {
  const choices: Record<CreationStep, FocusRow[]> = {
    remembrance: ['cards'],
    appearance: ['tones', 'figure'],
    name: ['field'],
  };
  return [...choices[step], ...(backEnabled(step) ? (['back'] as const) : []), 'next'];
}

/** Into a step: the focus on its first row, the hover cleared, the figure turning by itself from S. */
function enter(s: CreationState, step: CreationStep, now: number): CreationState {
  return {
    ...s,
    phase: step,
    since: now,
    focus: focusRows(step)[0] ?? 'next',
    hover: null,
    turn: { manual: false, facing: 0, since: now },
  };
}

/** The opening and the closing hold on black for their time; any input ends the opening early (`skipOpening`). */
export function tick(s: CreationState, now: number): CreationState {
  if (s.phase === 'opening' && now - s.since >= CREATION_TIMING.openingMs) return enter(s, 'remembrance', now);
  if (s.phase === 'closing' && now - s.since >= CREATION_TIMING.closingMs) return { ...s, phase: 'done', since: now };
  return s;
}

export function skipOpening(s: CreationState, now: number): CreationState {
  return s.phase === 'opening' ? enter(s, 'remembrance', now) : s;
}

/** NEXT on the first two steps: the next step, the choices kept. On the Name step NEXT is CONFIRM, which the scene sends. */
export function goNext(s: CreationState, now: number): CreationState {
  if (!isStep(s.phase)) return s;
  const following = CREATION_STEPS[CREATION_STEPS.indexOf(s.phase) + 1];
  return following ? enter(s, following, now) : s;
}

/** BACK: the step before, the choices kept; nothing on the first step. */
export function goBack(s: CreationState, now: number): CreationState {
  if (!isStep(s.phase) || !backEnabled(s.phase)) return s;
  const before = CREATION_STEPS[CREATION_STEPS.indexOf(s.phase) - 1];
  return before ? enter(s, before, now) : s;
}

/** A confirmed name: the closing line on black. */
export function close(s: CreationState, now: number): CreationState {
  return { ...s, phase: 'closing', since: now, hover: null };
}

/** What Enter (Cross) does: BACK when BACK has the focus, else NEXT. */
export function activate(s: CreationState): 'back' | 'next' {
  return s.focus === 'back' ? 'back' : 'next';
}

/** Up/Down, Tab and Shift+Tab: the next or previous focus row, wrapping. */
export function moveFocus(s: CreationState, delta: number): CreationState {
  if (!isStep(s.phase)) return s;
  const rows = focusRows(s.phase);
  const i = Math.max(0, rows.indexOf(s.focus));
  return { ...s, focus: rows[(i + delta + rows.length * 4) % rows.length] ?? s.focus };
}

/** Focus a row of the current step (a click or a tap on it); a row the step lacks is ignored. */
export function focusRow(s: CreationState, row: FocusRow): CreationState {
  return isStep(s.phase) && focusRows(s.phase).includes(row) ? { ...s, focus: row } : s;
}

const wrapAt = <T>(list: readonly T[], current: T, delta: number): T => {
  const i = Math.max(0, list.indexOf(current));
  return list[(i + delta + list.length * 4) % list.length] ?? current;
};

/**
 * Left/Right (the D-pad): the Remembrance on the cards, the tone on the tones,
 * one facing on the figure (pausing the turning), between BACK and NEXT on the
 * buttons; nothing on the name field (the input moves its caret).
 */
export function press(s: CreationState, delta: number, now: number): CreationState {
  switch (s.focus) {
    case 'cards':
      return { ...s, remembrance: wrapAt(REMEMBRANCES, s.remembrance, delta) };
    case 'tones':
      return { ...s, tone: wrapAt(CREATION_CLAY_TONES, s.tone, delta) };
    case 'figure':
      return turnByHand(s, delta, now);
    case 'back':
    case 'next': {
      const buttons = focusRows(isStep(s.phase) ? s.phase : 'remembrance').filter((r) => r === 'back' || r === 'next');
      return { ...s, focus: wrapAt(buttons, s.focus, delta) };
    }
    case 'field':
      return s;
  }
}

/** A click or tap on a card: that Remembrance, the cards focused. */
export function chooseRemembrance(s: CreationState, remembrance: Remembrance): CreationState {
  return { ...focusRow(s, 'cards'), remembrance };
}

/** A click or tap on a swatch: that tone, the tones focused. */
export function chooseTone(s: CreationState, tone: ClayTone): CreationState {
  return { ...focusRow(s, 'tones'), tone };
}

/** The facing (index in SPRITE_FACINGS) the figure shows at `now`. */
function facingIndex(s: CreationState, now: number): number {
  if (s.phase !== 'appearance') return 0;
  if (s.turn.manual) return s.turn.facing;
  return Math.floor(Math.max(0, now - s.turn.since) / CREATION_TIMING.turnMs) % SPRITE_FACINGS.length;
}

/**
 * The figure's facing: on the Appearance step, turning S, SE, E, NE, N, NW,
 * W, SW, each held `turnMs`, unless turned by hand; standing south elsewhere.
 */
export function figureFacing(s: CreationState, now: number): SpriteFacing {
  return SPRITE_FACINGS[facingIndex(s, now)] ?? 'S';
}

/** Turn the Appearance figure by hand: `delta` facings on from where it stands (Right: S → SE → E), the turning paused until the player leaves the step. */
export function turnByHand(s: CreationState, delta: number, now: number): CreationState {
  if (s.phase !== 'appearance' || delta === 0) return s;
  const n = SPRITE_FACINGS.length;
  const facing = (((facingIndex(s, now) + delta) % n) + n) % n;
  return { ...s, turn: { ...s.turn, manual: true, facing } };
}

/**
 * A drag across the figure: one facing per `DRAG_TURN_PX` UI px since the
 * anchor (rightwards turns like Right), and the anchor moved on by the turns
 * taken, so a slow drag turns as it goes.
 */
export function dragTurns(anchorX: number, x: number): { turns: number; anchorX: number } {
  const turns = Math.trunc((x - anchorX) / DRAG_TURN_PX) || 0;
  return { turns, anchorX: anchorX + turns * DRAG_TURN_PX };
}

/**
 * The Narrator's line for the moment: the opening and closing lines on black;
 * on Remembrance while a card is hovered or the cards have the focus; on
 * Appearance while a swatch is hovered or the tones have the focus; on Name
 * while the field is empty; nothing otherwise.
 */
export function narratorLine(s: CreationState): string | null {
  const n = CREATION_TEXT.narrator;
  switch (s.phase) {
    case 'opening':
      return n.opening;
    case 'closing':
    case 'done':
      return n.closing;
    case 'remembrance':
      return s.hover === 'card' || s.focus === 'cards' ? n.remembrance : null;
    case 'appearance':
      return s.hover === 'tone' || s.focus === 'tones' ? n.appearance : null;
    case 'name':
      return s.nameEmpty ? n.nameEmpty : null;
  }
}

/** A Narrator line wrapped at `NARRATOR_W` in the body font, as the BitmapText wraps it: its rows. */
export function narratorRows(line: string): string[] {
  return wrapText(tiny5Font, line, NARRATOR_W).split('\n');
}
