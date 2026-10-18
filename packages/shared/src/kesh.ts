import keshJson from '../data/kesh.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import { isItemId } from './items.js';
import { isWordId } from './words.js';

/**
 * Old Kesh's lines (data/kesh.json, docs/design/holding.md "Kesh", M2 Task
 * 4b): LORE's and GAME DESIGN's, word for word, validated on load like
 * items.json (a bad file throws, and test/kesh.test.ts fails). The talk
 * box plays them one line at a time; the server never reads them. A line
 * that the pixel fonts can't draw is a problem by name, never changed in
 * the text.
 */

/** Who speaks a line: Kesh (`talk` plays), the Narrator (the muted style), or a hint (no speaker, the hint style). */
export const KESH_SPEAKERS = ['kesh', 'narrator', 'hint'] as const;
export type KeshSpeaker = (typeof KESH_SPEAKERS)[number];

/**
 * What a line throws, from Kesh's hand on `KESH_TOSS_RELEASE_FRAME`: a wild
 * sliver; the clay tile of `gifts.word` (Task 5, after the Name); the seeds
 * of `gifts.seeds` (after the first plot is named).
 */
export const KESH_TOSSES = ['sliver', 'word', 'seeds'] as const;
export type KeshToss = (typeof KESH_TOSSES)[number];

/** When a line is shown at all: `first-sliver` only while Kesh's first sliver hasn't been given. */
export const KESH_LINE_CONDITIONS = ['first-sliver'] as const;
export type KeshLineCondition = (typeof KESH_LINE_CONDITIONS)[number];

export interface KeshLine {
  who: KeshSpeaker;
  text: string;
  /** The thrown thing leaves his hand on this line (the server is asked for it; the flight is cosmetic). */
  toss?: KeshToss;
  only?: KeshLineCondition;
}

export interface KeshTopic {
  id: string;
  /** The menu's word for it. */
  title: string;
  lines: KeshLine[];
}

/** Kesh's gifts (Task 5): the word tile he tosses after the Name, and the seeds after the first plot is named. */
export interface KeshGifts {
  /** A word id of words.json. */
  word: string;
  seeds: { itemId: string; quantity: number };
}

export interface KeshData {
  gifts: KeshGifts;
  /** After the Name: his line, the Narrator, the hint, then the tile's toss (`toss: "word"`). */
  afterNaming: KeshLine[];
  /** After a plot's first naming lands: the seeds' toss, the hint, the Narrator. */
  afterFirstPlot: KeshLine[];
  afterFirstFeeding: KeshLine[];
  /** The talk box's menu, in order; "Goodbye" last. */
  topics: KeshTopic[];
  tideSliver: KeshLine[];
}

/** The menu's last entry, after the topics. */
export const KESH_GOODBYE_TOPIC = 'goodbye';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FLOWS = ['afterNaming', 'afterFirstPlot', 'afterFirstFeeding', 'tideSliver'] as const;

function parseLines(value: unknown, at: string, problems: string[]): KeshLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${at} must be a non-empty list of lines`);
    return [];
  }
  const lines: KeshLine[] = [];
  value.forEach((entry: unknown, i) => {
    const here = `${at}[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${here}: not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !['who', 'text', 'toss', 'only'].includes(k));
    if (extra.length > 0) problems.push(`${here}: unknown field(s) ${extra.join(', ')}`);
    const { who, text, toss, only } = entry;
    if (typeof who !== 'string' || !(KESH_SPEAKERS as readonly string[]).includes(who))
      problems.push(`${here}: who must be one of ${KESH_SPEAKERS.join(', ')}`);
    if (typeof text !== 'string' || text.trim() === '') problems.push(`${here}: text must be a non-empty string`);
    else if (!isDrawable(text)) {
      const missing = [...new Set(Array.from(text).filter((ch) => !isDrawable(ch)))];
      problems.push(`${here}: the fonts can't draw ${missing.map((ch) => JSON.stringify(ch)).join(', ')} (don't change the text; flag it)`);
    }
    if (toss !== undefined && (typeof toss !== 'string' || !(KESH_TOSSES as readonly string[]).includes(toss)))
      problems.push(`${here}: toss must be one of ${KESH_TOSSES.join(', ')}`);
    if (only !== undefined && (typeof only !== 'string' || !(KESH_LINE_CONDITIONS as readonly string[]).includes(only)))
      problems.push(`${here}: only must be one of ${KESH_LINE_CONDITIONS.join(', ')}`);
    if (toss !== undefined && who !== 'kesh') problems.push(`${here}: only Kesh tosses`);
    const line: KeshLine = { who: who as KeshSpeaker, text: text as string };
    if (toss !== undefined) line.toss = toss as KeshToss;
    if (only !== undefined) line.only = only as KeshLineCondition;
    lines.push(line);
  });
  return lines;
}

/** Check kesh.json-shaped data; every problem is listed, not just the first. */
export function validateKeshData(data: unknown): { ok: true; data: KeshData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'gifts', ...FLOWS, 'topics'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  const flows = {} as Record<(typeof FLOWS)[number], KeshLine[]>;
  for (const flow of FLOWS) flows[flow] = parseLines(data[flow], flow, problems);
  const topics: KeshTopic[] = [];
  if (!Array.isArray(data.topics) || data.topics.length === 0) problems.push('topics must be a non-empty list');
  else {
    const ids = new Set<string>();
    data.topics.forEach((entry: unknown, i) => {
      const at = `topics[${i}]`;
      if (!isObject(entry)) {
        problems.push(`${at}: not an object`);
        return;
      }
      const more = Object.keys(entry).filter((k) => !['id', 'title', 'lines'].includes(k));
      if (more.length > 0) problems.push(`${at}: unknown field(s) ${more.join(', ')}`);
      const { id, title } = entry;
      if (typeof id !== 'string' || !KEBAB.test(id)) problems.push(`${at}: id must be kebab-case`);
      else if (ids.has(id)) problems.push(`${at}: duplicate id ${id}`);
      else ids.add(id);
      if (typeof title !== 'string' || title.trim() === '') problems.push(`${at}: title must be a non-empty string`);
      else if (!isDrawable(title)) problems.push(`${at}: the fonts can't draw the title`);
      const lines = parseLines(entry.lines, `${at}.lines`, problems);
      topics.push({ id: typeof id === 'string' ? id : '', title: typeof title === 'string' ? title : '', lines });
    });
    if (topics.length > 0 && topics[topics.length - 1]?.id !== KESH_GOODBYE_TOPIC)
      problems.push(`topics: the last topic must be ${KESH_GOODBYE_TOPIC}`);
  }
  // The gifts: the word a tile of words.json, the seeds an item and a count.
  let gifts: KeshGifts = { word: '', seeds: { itemId: '', quantity: 0 } };
  const g = data.gifts;
  if (!isObject(g)) problems.push('gifts must be { word, seeds: { itemId, quantity } }');
  else {
    const more = Object.keys(g).filter((k) => !['word', 'seeds'].includes(k));
    if (more.length > 0) problems.push(`gifts: unknown field(s) ${more.join(', ')}`);
    if (!isWordId(g.word)) problems.push('gifts.word must be a word of words.json');
    const seeds = g.seeds;
    if (!isObject(seeds) || !isItemId(seeds.itemId) || typeof seeds.quantity !== 'number' || !Number.isSafeInteger(seeds.quantity) || seeds.quantity <= 0)
      problems.push('gifts.seeds must be { itemId (items.json), quantity (a positive integer) }');
    else if (typeof g.word === 'string') gifts = { word: g.word, seeds: { itemId: seeds.itemId, quantity: seeds.quantity } };
  }
  // Each flow that gives something carries exactly one toss, of its kind; the feeding line none.
  const tosses = (lines: KeshLine[], kind: KeshToss): number => lines.filter((l) => l.toss === kind).length;
  const anyToss = (lines: KeshLine[]): number => lines.filter((l) => l.toss !== undefined).length;
  if (flows.tideSliver.length > 0 && (tosses(flows.tideSliver, 'sliver') !== 1 || anyToss(flows.tideSliver) !== 1))
    problems.push('tideSliver must carry exactly one toss, a sliver');
  if (flows.afterNaming.length > 0 && (tosses(flows.afterNaming, 'word') !== 1 || anyToss(flows.afterNaming) !== 1))
    problems.push('afterNaming must carry exactly one toss, the word');
  if (flows.afterFirstPlot.length > 0 && (tosses(flows.afterFirstPlot, 'seeds') !== 1 || anyToss(flows.afterFirstPlot) !== 1))
    problems.push('afterFirstPlot must carry exactly one toss, the seeds');
  if (anyToss(flows.afterFirstFeeding) > 0) problems.push('afterFirstFeeding carries no toss');
  for (const t of topics) if (t.lines.some((l) => l.toss !== undefined && l.toss !== 'sliver')) problems.push(`topics (${t.id}): a topic tosses slivers only`);
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { gifts, ...flows, topics } };
}

function loadKeshData(): KeshData {
  const result = validateKeshData(keshJson);
  if (!result.ok) throw new Error(`data/kesh.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const keshData: KeshData = loadKeshData();

/** The lines of the first-sliver step: those marked `first-sliver` in any topic (the Sparkglass topic's flick and its hint), in order. */
export function firstSliverLines(data: KeshData = keshData): KeshLine[] {
  return data.topics.flatMap((t) => t.lines.filter((l) => l.only === 'first-sliver'));
}

/** A topic's lines as they play: the `first-sliver` lines only while the first sliver hasn't been given. */
export function topicLines(topic: KeshTopic, firstGiven: boolean): KeshLine[] {
  return topic.lines.filter((l) => l.only !== 'first-sliver' || !firstGiven);
}

/** The tile's line: the `word` toss of `afterNaming`, played alone when the tile is due at Talk (a Kindled who named the island before Task 5). */
export function wordTossLines(data: KeshData = keshData): KeshLine[] {
  return data.afterNaming.filter((l) => l.toss === 'word');
}
