import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CREATION_STEPS,
  CREATION_TEXT,
  CREATION_TIMING,
  creationData,
  creationProblems,
  isDrawable,
  KINDLED_NAME_REFUSED,
  NAME_NOT_DRAWABLE,
  NAME_REFUSED,
  NARRATOR_MOMENTS,
  REMEMBRANCES,
  validateIslandName,
  validateKindledName,
} from '../src/index.js';
import { BANNED } from './banned.js';

/** LORE's scene (Lore §14.0), word for word as M2 Task 9 quotes it. */
const LORE = {
  screens: {
    remembrance:
      'Choose your Remembrance. Your Remembrance is the one image you carried out of the dark: who you were, as far as you know. It decides what you wake up wearing and which memories come back to you first. It does not make you stronger or weaker.',
    appearance: 'Your clay. Everyone who wakes out here is made of it. Only the color is yours to choose.',
    name: "Your name. You don't remember it. Nobody who wakes out here does. Choose the one you'll answer to.",
  },
  narrator: {
    opening:
      "Before you open your eyes, little light, one thing comes back to you. Only one. Everything else the Hollow has already taken. Hold on to what's left.",
    remembrance: 'Choose the one that hurts least. Or most. It was all real, either way.',
    appearance: 'Riverbank clay, little light. Every bank is a different color. Someone dug all of it, once.',
    nameEmpty:
      "Any name will do, little light. The one you had is in the dark with everything else, and the dark doesn't give things back. Not often.",
    closing: 'There. Now something out here knows what to call you.',
  },
  toneTip: 'Clay: What you were shaped from. It changes nothing but the color.',
  refused: "That name won't hold. Try another.",
  remembrances: {
    clay: {
      name: 'Clay',
      image: 'A riverbank, your hands deep in wet mud, shaping something.',
      clothing: "A potter's wrap and a clay-stiffened apron, sleeves rolled",
    },
    ash: {
      name: 'Ash',
      image: 'A tower burning against the sky, and the heat on your face.',
      clothing: 'A soot-black hooded cloak with a singed hem',
    },
    tide: {
      name: 'Tide',
      image: 'Light pouring into water and drowning there.',
      clothing: 'A salt-stiff sailcloth tunic with a rope belt',
    },
    wing: {
      name: 'Wing',
      image: 'Falling, and the wind tearing past you.',
      clothing: 'A down-lined mantle over a torn harness',
    },
  },
};

/** Every line of the scene in creation.json, with where it is. */
function lines(): [string, string][] {
  return [
    ...Object.entries(CREATION_TEXT.screens).map(([k, v]): [string, string] => [`screens.${k}`, v]),
    ...Object.entries(CREATION_TEXT.narrator).map(([k, v]): [string, string] => [`narrator.${k}`, v]),
    ['toneTip', CREATION_TEXT.toneTip],
    ['refused', CREATION_TEXT.refused],
    ...REMEMBRANCES.flatMap((id): [string, string][] => {
      const r = CREATION_TEXT.remembrances[id];
      return [
        [`${id}.name`, r.name],
        [`${id}.image`, r.image],
        [`${id}.clothing`, r.clothing],
      ];
    }),
  ];
}

describe("creation.json's scene (M2 Task 9, Lore §14.0)", () => {
  it("holds LORE's lines word for word", () => {
    expect(CREATION_TEXT).toEqual(LORE);
    expect(KINDLED_NAME_REFUSED).toBe(LORE.refused);
    expect(CREATION_STEPS).toEqual(['remembrance', 'appearance', 'name']);
    expect(NARRATOR_MOMENTS).toEqual(['opening', 'remembrance', 'appearance', 'nameEmpty', 'closing']);
  });

  it('every line is drawable and clear of the banned names', () => {
    for (const [where, line] of lines()) {
      expect(isDrawable(line), where).toBe(true);
      expect(BANNED.test(line), where).toBe(false);
    }
  });

  it('holds the opening and closing on black and turns the figure at the decided timings', () => {
    expect(CREATION_TIMING).toEqual({ openingMs: 3000, closingMs: 2000, turnMs: 600 });
  });

  it("replaces MAIN's outfit shorthand with LORE's clothing (palette.json's outfit colours stay)", () => {
    const raw = readFileSync(new URL('../data/creation.json', import.meta.url), 'utf8');
    expect(raw).not.toMatch(/"outfit"/);
    for (const id of REMEMBRANCES) expect(Object.keys(creationData.remembrances[id])).toEqual(['name', 'image', 'clothing']);
  });
});

describe('creationProblems (the check on load)', () => {
  const clone = (): Record<string, unknown> => JSON.parse(JSON.stringify(creationData)) as Record<string, unknown>;

  it('passes the shipped data', () => {
    expect(creationProblems(creationData)).toEqual([]);
  });

  it('names a missing or undrawable line, a stray field, a bad timing and a default tone that is not a tone', () => {
    const data = clone();
    const narrator = data.narrator as Record<string, unknown>;
    delete narrator.closing;
    (data.screens as Record<string, unknown>).name = 'Your name. ש';
    const clay = (data.remembrances as Record<string, Record<string, unknown>>).clay;
    if (!clay) throw new Error('no clay');
    clay.outfit = "potter's wrap";
    delete clay.image;
    data.turnMs = 0;
    data.openingMs = 2.5;
    data.defaultClayTone = 'clay-blue';
    data.refused = '';
    expect(creationProblems(data)).toEqual([
      'remembrances.clay.image is not a line',
      'remembrances.clay has unknown fields: outfit',
      'defaultClayTone is not one of clayTones',
      "screens.name has characters the fonts can't draw",
      'narrator.closing is not a line',
      'refused is not a line',
      'openingMs is not a positive whole number of ms',
      'turnMs is not a positive whole number of ms',
    ]);
    expect(creationProblems(null)).toEqual(['not an object']);
  });
});

describe("a refused name: LORE's line for a Kindled's, the Writ's for the island's", () => {
  it("refuses a Kindled name with LORE's line, an undrawable one with NAME_NOT_DRAWABLE", () => {
    for (const name of ['A', '!!', 'x'.repeat(25), 'Mi\u0007ra'])
      expect(validateKindledName(name), name).toMatchObject({ ok: false, message: KINDLED_NAME_REFUSED });
    expect(validateKindledName('مريم')).toMatchObject({ ok: false, message: NAME_NOT_DRAWABLE });
    expect(validateKindledName('Mira')).toEqual({ ok: true, name: 'Mira' });
  });

  it("keeps the Writ's line for the island's Name", () => {
    expect(NAME_REFUSED).toBe("The Writ won't take that name. Try another.");
    expect(KINDLED_NAME_REFUSED).not.toBe(NAME_REFUSED);
    for (const name of ['A', '!!']) expect(validateIslandName(name), name).toMatchObject({ ok: false, message: NAME_REFUSED });
  });
});
