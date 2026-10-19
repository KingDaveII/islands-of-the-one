import creation from '../data/creation.json' with { type: 'json' };
import { isDrawable } from './fonts.js';
import type { ClayTone } from './sprites.js';

/**
 * Kindled creation (docs/design/accounts.md): the data in data/creation.json,
 * checked when this module loads. The Remembrances and the clay tones, the
 * name rules, and LORE's scene (Lore §14.0, word for word): each step's line,
 * the Narrator's lines, the tones' tooltip and the refusal of a Kindled name,
 * with how long the opening and closing hold on black and how long the
 * Appearance figure holds each facing.
 */

/** Kindled creation data (data/creation.json). */
export const creationData = creation;
export type Remembrance = keyof typeof creation.remembrances;
export const REMEMBRANCES = Object.keys(creation.remembrances) as Remembrance[];
/** Clay tone ids in display order (the same ids as palette.json's clay.tones; a test checks). */
export const CREATION_CLAY_TONES = Object.keys(creation.clayTones) as ClayTone[];
export const DEFAULT_CLAY_TONE = creation.defaultClayTone as ClayTone;

export function isRemembrance(value: unknown): value is Remembrance {
  return typeof value === 'string' && Object.hasOwn(creation.remembrances, value);
}

export function isClayTone(value: unknown): value is ClayTone {
  return typeof value === 'string' && Object.hasOwn(creation.clayTones, value);
}

/** The three steps of creation, in order. */
export const CREATION_STEPS = ['remembrance', 'appearance', 'name'] as const;
export type CreationStep = (typeof CREATION_STEPS)[number];

/** The Narrator's moments: on black before and after, the hover/focus lines of the first two steps, the empty name. */
export const NARRATOR_MOMENTS = ['opening', 'remembrance', 'appearance', 'nameEmpty', 'closing'] as const;
export type NarratorMoment = (typeof NARRATOR_MOMENTS)[number];

/** LORE's lines for the creation scene (§14.0), from creation.json. */
export const CREATION_TEXT: {
  readonly screens: Readonly<Record<CreationStep, string>>;
  readonly narrator: Readonly<Record<NarratorMoment, string>>;
  readonly toneTip: string;
  readonly refused: string;
  readonly remembrances: Readonly<Record<Remembrance, { readonly name: string; readonly image: string; readonly clothing: string }>>;
} = {
  screens: creation.screens,
  narrator: creation.narrator,
  toneTip: creation.toneTip,
  refused: creation.refused,
  remembrances: creation.remembrances,
};

/** How long the opening and closing lines hold on black, and each facing of the turning figure (ms). */
export const CREATION_TIMING: { readonly openingMs: number; readonly closingMs: number; readonly turnMs: number } = {
  openingMs: creation.openingMs,
  closingMs: creation.closingMs,
  turnMs: creation.turnMs,
};

/**
 * The refusal of a Kindled name (LORE, 2026-10-15): "That name won't hold.
 * Try another." There is no Writ in creation yet; the island's Name keeps
 * the Writ's line (`NAME_REFUSED`). A name the fonts can't draw still gets
 * `NAME_NOT_DRAWABLE`.
 */
export const KINDLED_NAME_REFUSED: string = creation.refused;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The problems with creation data, [] when it is sound: the shape, every line drawable and non-empty, the timings. */
export function creationProblems(data: unknown): string[] {
  const problems: string[] = [];
  if (!isObject(data)) return ['not an object'];
  const line = (where: string, v: unknown): void => {
    if (typeof v !== 'string' || v.trim() === '') problems.push(`${where} is not a line`);
    else if (!isDrawable(v)) problems.push(`${where} has characters the fonts can't draw`);
  };
  const remembrances = data.remembrances;
  if (!isObject(remembrances) || Object.keys(remembrances).length === 0) problems.push('no remembrances');
  else
    for (const [id, r] of Object.entries(remembrances)) {
      if (!isObject(r)) {
        problems.push(`remembrances.${id} is not an object`);
        continue;
      }
      for (const key of ['name', 'image', 'clothing']) line(`remembrances.${id}.${key}`, r[key]);
      const extra = Object.keys(r).filter((k) => !['name', 'image', 'clothing'].includes(k));
      if (extra.length) problems.push(`remembrances.${id} has unknown fields: ${extra.join(', ')}`);
    }
  const tones = data.clayTones;
  if (!isObject(tones) || Object.keys(tones).length === 0) problems.push('no clayTones');
  else for (const [id, t] of Object.entries(tones)) line(`clayTones.${id}.name`, isObject(t) ? t.name : undefined);
  if (!isObject(tones) || typeof data.defaultClayTone !== 'string' || !Object.hasOwn(tones, data.defaultClayTone))
    problems.push('defaultClayTone is not one of clayTones');
  const screens = data.screens;
  if (!isObject(screens)) problems.push('no screens');
  else for (const step of CREATION_STEPS) line(`screens.${step}`, screens[step]);
  const narrator = data.narrator;
  if (!isObject(narrator)) problems.push('no narrator');
  else for (const moment of NARRATOR_MOMENTS) line(`narrator.${moment}`, narrator[moment]);
  line('toneTip', data.toneTip);
  line('refused', data.refused);
  for (const key of ['openingMs', 'closingMs', 'turnMs']) {
    const ms = data[key];
    if (typeof ms !== 'number' || !Number.isInteger(ms) || ms <= 0) problems.push(`${key} is not a positive whole number of ms`);
  }
  return problems;
}

const problems = creationProblems(creation);
if (problems.length) throw new Error(`data/creation.json: ${problems.join('; ')}`);
