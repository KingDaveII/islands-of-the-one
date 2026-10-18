import { describe, expect, it } from 'vitest';
import {
  DRAWABLE_CHARS,
  firstSliverLines,
  KESH_GOODBYE_TOPIC,
  keshData,
  scaffoldLines,
  topicLines,
  validateKeshData,
  validateScaffoldData,
  wordTossLines,
  M2_SCAFFOLD,
  scaffoldData,
  type KeshLine,
} from '../src/index.js';
import keshJson from '../data/kesh.json' with { type: 'json' };
import scaffoldJson from '../data/scaffold.json' with { type: 'json' };
import { BANNED } from './banned.js';

/**
 * data/kesh.json (docs/design/holding.md "Kesh", M2 Task 4b): LORE's lines
 * word for word, every character drawable by the pixel fonts (a line a font
 * can't draw fails here by name instead of being changed), the validator's
 * refusals; data/scaffold.json's flag.
 */
const allLines = (): KeshLine[] => [
  ...keshData.afterNaming,
  ...keshData.afterFirstPlot,
  ...keshData.afterFirstFeeding,
  ...keshData.topics.flatMap((t) => t.lines),
  ...keshData.tideSliver,
];

describe('kesh.json', () => {
  it('validates, with the four topics in order and Goodbye last', () => {
    expect(validateKeshData(keshJson)).toEqual({ ok: true, data: keshData });
    expect(keshData.topics.map((t) => t.title)).toEqual(['The Old Letters', 'Sparkglass', 'Where the crack points', 'Goodbye']);
    expect(keshData.topics[keshData.topics.length - 1]?.id).toBe(KESH_GOODBYE_TOPIC);
  });

  it('every line and title uses only characters the fonts can draw, and no banned name', () => {
    for (const line of allLines()) {
      const missing = Array.from(line.text).filter((ch) => !DRAWABLE_CHARS.has(ch));
      expect(missing, line.text).toEqual([]);
      expect(BANNED.test(line.text), line.text).toBe(false);
    }
    for (const topic of keshData.topics) expect(Array.from(topic.title).every((ch) => DRAWABLE_CHARS.has(ch)), topic.title).toBe(true);
  });

  it("holds LORE's lines word for word: the first and the tide's slivers toss, the hints and the Narrator are placed", () => {
    expect(keshData.afterNaming.map((l) => l.who)).toEqual(['kesh', 'narrator', 'hint', 'kesh']);
    // Task 5: the tile's toss after the hint, the seeds' flow, and the gifts.
    expect(keshData.afterNaming[3]).toEqual({
      who: 'kesh',
      text: '(tosses a clay tile across the water) "There. Your first word. Put it on a plot and the plot\'ll know it\'s for growing."',
      toss: 'word',
    });
    expect(wordTossLines()).toEqual([keshData.afterNaming[3]]);
    expect(keshData.afterFirstPlot).toEqual([
      { who: 'kesh', text: '(throws a twist of cloth) "Now it knows it\'s for growing. Put those in. They\'ll come up while you\'re out."', toss: 'seeds' },
      { who: 'hint', text: 'Set Farming as your action and the field keeps growing while you\'re away.' },
      { who: 'kesh', text: '"Now. Cut what you can and stack it by the post. A field with nothing built round it is only dirt with a name."' },
      { who: 'narrator', text: "One word, little light, and the ground believes you. Remember how easy that was. It won't always be." },
    ]);
    expect(keshData.gifts).toEqual({ word: 'adamah', seeds: { itemId: 'grey-seeds', quantity: 4 } });
    expect(keshData.afterNaming[0]?.text).toBe(
      '(squints at the post) "Hm. That\'s what you\'re calling it?" (shrugs) "Doesn\'t matter. Whatever you call it, it\'s yours now. The Hollow doesn\'t care if it\'s pretty."',
    );
    expect(keshData.afterFirstFeeding).toEqual([
      { who: 'kesh', text: '"There. Now it\'ll hold while you\'re gone. Two days, give or take. After that it starts forgetting the edges first."' },
    ]);
    expect(keshData.tideSliver).toEqual([
      { who: 'kesh', text: '(flicks a sliver across the water) "Tide\'s turned. The haze coughed one up. Don\'t burn it all in one place."', toss: 'sliver', m2Scaffold: true },
    ]);
    const sparkglass = keshData.topics.find((t) => t.id === 'sparkglass');
    expect(sparkglass?.lines.map((l) => l.who)).toEqual(['kesh', 'kesh', 'kesh', 'kesh', 'kesh', 'kesh', 'kesh', 'hint', 'kesh', 'narrator']);
    expect(firstSliverLines()).toEqual([
      { who: 'kesh', text: '(flicks the sliver across the water) "First one\'s free. Don\'t get used to it."', toss: 'sliver', only: 'first-sliver' },
      { who: 'hint', text: 'Touch Sparkglass to your Writ to feed it.', only: 'first-sliver' },
    ]);
    // The topic plays its first-sliver step only while the first sliver hasn't been given; once it has and the tide's
    // isn't due, LORE's "One a tide." takes its place (asked again the same tide); with the tide's due, neither.
    if (!sparkglass) throw new Error('no Sparkglass topic');
    const oneATide = { who: 'kesh', text: '"One a tide. I\'m a fisherman, not a Pillar."', only: 'tide-taken', m2Scaffold: true };
    expect(topicLines(sparkglass, false)).toHaveLength(9);
    expect(topicLines(sparkglass, false).some((l) => l.only === 'tide-taken')).toBe(false);
    expect(topicLines(sparkglass, true, false)).toHaveLength(8);
    expect(topicLines(sparkglass, true, false)[6]).toEqual(oneATide);
    expect(topicLines(sparkglass, true, true)).toHaveLength(7);
    expect(topicLines(sparkglass, true, true).some((l) => l.toss !== undefined || l.only !== undefined)).toBe(false);
    expect(topicLines(sparkglass, true)).toEqual(topicLines(sparkglass, true, false));
    expect(scaffoldLines()).toEqual([...keshData.tideSliver, oneATide]);
    // Every other topic ends with the Narrator; no toss outside the Sparkglass topic and the tide.
    for (const t of keshData.topics) {
      expect(t.lines[t.lines.length - 1]?.who, t.id).toBe('narrator');
      if (t.id !== 'sparkglass') expect(t.lines.some((l) => l.toss !== undefined), t.id).toBe(false);
    }
    // The outer quotes are the data's; LORE's speech marks are in the text. Stage directions are text.
    expect(keshData.topics.find((t) => t.id === 'goodbye')?.lines[2]?.text.startsWith('(for the first time, looking straight at the player) "And if')).toBe(true);
  });

  it('lists every problem', () => {
    const base = Object.fromEntries(Object.entries(keshJson).filter(([k]) => k !== '$comment'));
    const bad = validateKeshData({
      ...base,
      extra: 1,
      afterNaming: [{ who: 'cook', text: '' }, { who: 'kesh', text: 'fine', toss: 'sliver' }, { who: 'narrator', text: 'A ✦ star', only: 'later' }],
      tideSliver: [{ who: 'kesh', text: 'no toss' }],
      topics: [
        { id: 'Bad Id', title: 'x', lines: [{ who: 'hint', text: 'h', toss: 'sliver' }] },
        { id: 'sparkglass', title: '', lines: [] },
        { id: 'sparkglass', title: 'again', lines: [{ who: 'kesh', text: 'x', more: 1 }] },
      ],
    });
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.problems).toEqual(
      expect.arrayContaining([
        'unknown field(s) extra',
        'afterNaming[0]: who must be one of kesh, narrator, hint',
        'afterNaming[0]: text must be a non-empty string',
        'afterNaming[2]: the fonts can\'t draw "✦" (don\'t change the text; flag it)',
        'afterNaming[2]: only must be one of first-sliver, tide-taken',
        'afterNaming must carry exactly one toss, the word',
        'tideSliver must carry exactly one toss, a sliver',
        'topics[0]: id must be kebab-case',
        'topics[0].lines[0]: only Kesh tosses',
        'topics[1]: title must be a non-empty string',
        'topics[1].lines must be a non-empty list of lines',
        'topics[2]: duplicate id sparkglass',
        'topics[2].lines[0]: unknown field(s) more',
        'topics: the last topic must be goodbye',
      ]),
    );
    expect(validateKeshData(null)).toEqual({ ok: false, problems: ['expected an object'] });
    // The gifts and the other flows' tosses (Task 5).
    expect(validateKeshData({ ...base, gifts: { word: 'shalom', seeds: { itemId: 'grey-seeds', quantity: 0 }, more: 1 } })).toMatchObject({
      ok: false,
      problems: ['gifts: unknown field(s) more', 'gifts.word must be a word of words.json', 'gifts.seeds must be { itemId (items.json), quantity (a positive integer) }'],
    });
    expect(validateKeshData({ ...base, gifts: 'adamah' })).toMatchObject({ ok: false, problems: ['gifts must be { word, seeds: { itemId, quantity } }'] });
    expect(validateKeshData({ ...base, afterFirstFeeding: [{ who: 'kesh', text: 'x', m2Scaffold: false }] })).toMatchObject({
      ok: false,
      problems: ['afterFirstFeeding[0]: m2Scaffold must be true when present'],
    });
    expect(validateKeshData({ ...base, afterFirstPlot: [{ who: 'kesh', text: 'x', toss: 'word' }] })).toMatchObject({
      ok: false,
      problems: ['afterFirstPlot must carry exactly one toss, the seeds'],
    });
    expect(validateKeshData({ ...base, afterFirstFeeding: [{ who: 'kesh', text: 'x', toss: 'seeds' }] })).toMatchObject({
      ok: false,
      problems: ['afterFirstFeeding carries no toss'],
    });
    expect(
      validateKeshData({ ...base, topics: [{ id: 'goodbye', title: 'Goodbye', lines: [{ who: 'kesh', text: 'x', toss: 'word' }, { who: 'narrator', text: 'y' }] }] }),
    ).toMatchObject({ ok: false, problems: ['topics (goodbye): a topic tosses slivers only'] });
    expect(validateKeshData({ ...base, topics: [] })).toMatchObject({ ok: false, problems: ['topics must be a non-empty list'] });
  });
});

describe('scaffold.json', () => {
  it('holds the M2 flag and validates', () => {
    expect(validateScaffoldData(scaffoldJson)).toEqual({ ok: true, data: scaffoldData });
    expect(scaffoldData).toEqual({ m2Scaffold: true });
    expect(M2_SCAFFOLD).toBe(true);
  });

  it('refuses a missing or non-boolean flag and unknown fields', () => {
    expect(validateScaffoldData({ m2Scaffold: 'yes' })).toEqual({ ok: false, problems: ['m2Scaffold must be a boolean'] });
    expect(validateScaffoldData({ m2Scaffold: false, m3: true })).toEqual({ ok: false, problems: ['unknown field(s) m3'] });
    expect(validateScaffoldData({ m2Scaffold: false })).toEqual({ ok: true, data: { m2Scaffold: false } });
    expect(validateScaffoldData(7)).toEqual({ ok: false, problems: ['expected an object'] });
  });
});
