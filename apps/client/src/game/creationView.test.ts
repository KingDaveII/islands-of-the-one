import { CREATION_TEXT, CREATION_TIMING, SPRITE_FACINGS, tiny5Font, measureText } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { sheathedSheetFor } from '../render/characters.js';
import {
  activate,
  backEnabled,
  chooseRemembrance,
  chooseTone,
  close,
  DRAG_TURN_PX,
  dragTurns,
  figureFacing,
  focusRow,
  focusRows,
  goBack,
  goNext,
  initialCreation,
  moveFocus,
  NARRATOR_MAX_ROWS,
  NARRATOR_W,
  narratorLine,
  narratorRows,
  nextLabel,
  press,
  skipOpening,
  tick,
  turnByHand,
  type CreationState,
} from './creationView.js';
import { UI_W } from './view.js';

const { openingMs, closingMs, turnMs } = CREATION_TIMING;
const N = CREATION_TEXT.narrator;

/** On the Remembrance step at t = 0. */
const atRemembrance = (): CreationState => skipOpening(initialCreation(0), 0);
const atAppearance = (now = 0): CreationState => goNext(atRemembrance(), now);
const atName = (): CreationState => goNext(atAppearance(), 0);

describe('creation: the steps', () => {
  it('opens on black for openingMs (or until any input), then Remembrance, Appearance, Name', () => {
    let s = initialCreation(0);
    expect(s.phase).toBe('opening');
    expect(tick(s, openingMs - 1).phase).toBe('opening');
    s = tick(s, openingMs);
    expect(s.phase).toBe('remembrance');
    expect(skipOpening(initialCreation(0), 10).phase).toBe('remembrance');
    s = goNext(s, 0);
    expect(s.phase).toBe('appearance');
    s = goNext(s, 0);
    expect(s.phase).toBe('name');
    // NEXT on the Name step is CONFIRM, which the scene sends: the step stays until the server makes the Kindled.
    expect(goNext(s, 0)).toBe(s);
    expect([nextLabel('remembrance'), nextLabel('appearance'), nextLabel('name')]).toEqual(['NEXT', 'NEXT', 'CONFIRM']);
  });

  it('closes on black for closingMs after a confirmed name, then is done', () => {
    const s = close(atName(), 100);
    expect(s.phase).toBe('closing');
    expect(tick(s, 100 + closingMs - 1).phase).toBe('closing');
    expect(tick(s, 100 + closingMs).phase).toBe('done');
    // No input skips the closing: it isn't the opening.
    expect(skipOpening(s, 200)).toBe(s);
  });

  it('greys BACK on the first step: it does nothing there and takes no focus', () => {
    expect([backEnabled('remembrance'), backEnabled('appearance'), backEnabled('name')]).toEqual([false, true, true]);
    const s = atRemembrance();
    expect(goBack(s, 0)).toBe(s);
    expect(focusRows('remembrance')).toEqual(['cards', 'next']);
    expect(focusRows('appearance')).toEqual(['tones', 'figure', 'back', 'next']);
    expect(focusRows('name')).toEqual(['field', 'back', 'next']);
    expect(goBack(atAppearance(), 0).phase).toBe('remembrance');
    expect(goBack(atName(), 0).phase).toBe('appearance');
  });

  it('keeps the choices across BACK and NEXT', () => {
    let s = press(atRemembrance(), 1, 0);
    expect(s.remembrance).toBe('ash');
    s = goNext(s, 0);
    s = press(s, 2, 0);
    expect(s.tone).toBe('clay-red');
    s = goNext(s, 0);
    s = goBack(goBack(s, 0), 0);
    expect(s.phase).toBe('remembrance');
    expect([s.remembrance, s.tone]).toEqual(['ash', 'clay-red']);
    s = goNext(goNext(s, 0), 0);
    expect([s.phase, s.remembrance, s.tone]).toEqual(['name', 'ash', 'clay-red']);
  });

  it('moves the focus with Up/Down and Tab, wrapping; Left/Right choose, or move between the buttons', () => {
    let s = atAppearance();
    expect(s.focus).toBe('tones');
    s = moveFocus(s, 1);
    expect(s.focus).toBe('figure');
    expect(moveFocus(moveFocus(s, 1), 1).focus).toBe('next');
    expect(moveFocus(atAppearance(), -1).focus).toBe('next');
    s = focusRow(s, 'back');
    expect(press(s, 1, 0).focus).toBe('next');
    expect(press(press(s, 1, 0), 1, 0).focus).toBe('back');
    // On the first step there is only NEXT.
    expect(press(focusRow(atRemembrance(), 'next'), 1, 0).focus).toBe('next');
    // Left/Right wrap through the cards and the tones.
    expect(press(atRemembrance(), -1, 0).remembrance).toBe('wing');
    expect(press(atAppearance(), -1, 0).tone).toBe('clay-river-dark');
    // The name field keeps its own caret.
    const name = atName();
    expect(press(name, 1, 0)).toBe(name);
    // A row the step lacks takes no focus.
    expect(focusRow(atRemembrance(), 'back').focus).toBe('cards');
  });

  it('activates BACK when it has the focus, NEXT otherwise (Enter, Cross)', () => {
    expect(activate(atRemembrance())).toBe('next');
    expect(activate(focusRow(atName(), 'back'))).toBe('back');
    expect(activate(focusRow(atName(), 'field'))).toBe('next');
  });

  it('chooses a card or a swatch on a click or a tap, focusing its row', () => {
    const s = chooseRemembrance(focusRow(atRemembrance(), 'next'), 'wing');
    expect([s.remembrance, s.focus]).toEqual(['wing', 'cards']);
    const t = chooseTone(focusRow(atAppearance(), 'next'), 'clay-pale');
    expect([t.tone, t.focus]).toEqual(['clay-pale', 'tones']);
  });
});

describe('creation: the Narrator', () => {
  it('says the line the moment calls for: hover or focus on the first two steps, the empty field, nothing otherwise', () => {
    expect(narratorLine(initialCreation(0))).toBe(N.opening);
    // Remembrance: the cards focused, or a card hovered.
    const r = atRemembrance();
    expect(narratorLine(r)).toBe(N.remembrance);
    const rNext = focusRow(r, 'next');
    expect(narratorLine(rNext)).toBeNull();
    expect(narratorLine({ ...rNext, hover: 'card' })).toBe(N.remembrance);
    // Appearance: the tones focused, or a swatch hovered; not the figure.
    const a = atAppearance();
    expect(narratorLine(a)).toBe(N.appearance);
    const figure = focusRow(a, 'figure');
    expect(narratorLine(figure)).toBeNull();
    expect(narratorLine({ ...figure, hover: 'tone' })).toBe(N.appearance);
    // A hover from the last step doesn't carry over.
    expect(goNext({ ...rNext, hover: 'card' }, 0).hover).toBeNull();
    // Name: while the field is empty.
    const n = atName();
    expect(narratorLine(n)).toBe(N.nameEmpty);
    expect(narratorLine({ ...n, nameEmpty: false })).toBeNull();
    expect(narratorLine(close(n, 0))).toBe(N.closing);
  });

  it('fits every Narrator line in two centred rows at the UI width, never a smaller font', () => {
    expect(NARRATOR_W).toBe(UI_W - 32);
    expect(NARRATOR_MAX_ROWS).toBe(2);
    for (const [moment, line] of Object.entries(N)) {
      const rows = narratorRows(line);
      expect(rows.length, moment).toBeLessThanOrEqual(NARRATOR_MAX_ROWS);
      for (const row of rows) expect(measureText(tiny5Font, row), `${moment}: ${row}`).toBeLessThanOrEqual(NARRATOR_W);
      expect(rows.join(' '), moment).toBe(line);
    }
    // The opening is the long one: it takes both rows.
    expect(narratorRows(N.opening)).toHaveLength(2);
  });
});

describe('creation: the turning figure', () => {
  it('turns S, SE, E, NE, N, NW, W, SW on Appearance, each held turnMs, from S on entering the step', () => {
    expect(SPRITE_FACINGS).toEqual(['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']);
    const s = atAppearance(1000);
    const at = (ms: number): string => figureFacing(s, 1000 + ms);
    expect([0, turnMs - 1, turnMs, 2 * turnMs, 3 * turnMs, 4 * turnMs, 5 * turnMs, 6 * turnMs, 7 * turnMs].map(at)).toEqual([
      'S', 'S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW',
    ]);
    expect(at(8 * turnMs)).toBe('S');
    expect(turnMs).toBe(600);
  });

  it('stands south on the other steps', () => {
    expect(figureFacing(atRemembrance(), 5 * turnMs)).toBe('S');
    expect(figureFacing(atName(), 5 * turnMs)).toBe('S');
    expect(turnByHand(atName(), 1, 0)).toEqual(atName());
  });

  it('turns by hand one facing per Left/Right on the figure row, pausing the turning until the step is left', () => {
    let s = focusRow(atAppearance(0), 'figure');
    // Two facings into the turn (E), Right turns on to NE and holds there.
    s = press(s, 1, 2 * turnMs + 10);
    expect(s.turn.manual).toBe(true);
    expect(figureFacing(s, 2 * turnMs + 10)).toBe('NE');
    expect(figureFacing(s, 50 * turnMs)).toBe('NE');
    // From S, Left twice is W (S → SW → W).
    let w = focusRow(atAppearance(0), 'figure');
    w = press(press(w, -1, 0), -1, 0);
    expect(figureFacing(w, 99 * turnMs)).toBe('W');
    // The tones row still chooses tones.
    expect(press(atAppearance(0), 1, 0).turn.manual).toBe(false);
    // Leaving the step and coming back: turning by itself again, from S.
    const back = goNext(goBack(w, 7000), 8000);
    expect(back.turn.manual).toBe(false);
    expect(figureFacing(back, 8000)).toBe('S');
    expect(figureFacing(back, 8000 + turnMs)).toBe('SE');
    // So does going on to the Name step and back.
    expect(goBack(goNext(w, 0), 0).turn.manual).toBe(false);
  });

  it('turns one facing per 24 UI px of a drag, keeping the remainder', () => {
    expect(DRAG_TURN_PX).toBe(24);
    expect(dragTurns(100, 123)).toEqual({ turns: 0, anchorX: 100 });
    expect(dragTurns(100, 124)).toEqual({ turns: 1, anchorX: 124 });
    expect(dragTurns(100, 160)).toEqual({ turns: 2, anchorX: 148 });
    expect(dragTurns(100, 52)).toEqual({ turns: -2, anchorX: 52 });
    expect(dragTurns(100, 77)).toEqual({ turns: 0, anchorX: 100 });
  });
});

describe("creation: the figure's sheet", () => {
  it("wears the Remembrance's sheathed sheet when it is loaded, else Ash's", () => {
    const none = (): boolean => false;
    for (const r of ['clay', 'ash', 'tide', 'wing'] as const) expect(sheathedSheetFor(r, none), r).toBe('kindled-ash-sheathed');
    const clayOnly = (name: string): boolean => name === 'kindled-clay-sheathed';
    expect(sheathedSheetFor('clay', clayOnly)).toBe('kindled-clay-sheathed');
    expect(sheathedSheetFor('tide', clayOnly)).toBe('kindled-ash-sheathed');
    expect(sheathedSheetFor('wing', () => true)).toBe('kindled-wing-sheathed');
  });
});
