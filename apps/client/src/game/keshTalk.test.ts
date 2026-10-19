import { firstSliverLines, keshData, topicLines, wordTossLines } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { dueRuns, KESH_NAME, KeshTalk, keshSpeaking, TALK_LABEL, type TalkContext, type TalkStep } from './keshTalk.js';

/**
 * The talk box's flow as a state machine (docs/design/holding.md "Kesh"):
 * the menu, each topic's steps, the first-sliver step present or absent,
 * the due toss before the menu, Close at any step.
 */
const fresh: TalkContext = { firstGiven: false, due: 'first', wordDue: false, seedsDue: false };
const given: TalkContext = { firstGiven: true, due: null, wordDue: false, seedsDue: false };
const tide: TalkContext = { firstGiven: true, due: 'tide', wordDue: false, seedsDue: false };
const nothingYet: TalkContext = { firstGiven: false, due: null, wordDue: false, seedsDue: false };

const text = (s: TalkStep): string => (s.kind === 'line' ? s.line.text : s.kind);
/** Every step a run of lines plays until it leaves them, from the current step. */
function play(talk: KeshTalk, ctx: TalkContext): TalkStep[] {
  const steps: TalkStep[] = [];
  while (talk.step.kind === 'line') {
    steps.push(talk.step);
    talk.advance(ctx);
  }
  return steps;
}

describe('the talk box', () => {
  it('names the prompt and the speaker', () => {
    expect(TALK_LABEL).toBe('TALK');
    expect(KESH_NAME).toBe('Kesh');
  });

  it('Talk with nothing due opens on the menu: the five topics in order (The rack before Goodbye, M2 Task 8), Goodbye last', () => {
    const talk = new KeshTalk();
    expect(talk.open).toBe(false);
    expect(talk.start('talk', given)).toEqual({ kind: 'menu', focus: 0 });
    expect(talk.open).toBe(true);
    expect(talk.topics.map((t) => t.title)).toEqual(['The Old Letters', 'Sparkglass', 'Where the crack points', 'The rack', 'Goodbye']);
    expect(talk.moveFocus(1)).toEqual({ kind: 'menu', focus: 1 });
    expect(talk.moveFocus(-2)).toEqual({ kind: 'menu', focus: 4 });
    expect(talk.moveFocus(1)).toEqual({ kind: 'menu', focus: 0 });
    expect(talk.setFocus(2)).toEqual({ kind: 'menu', focus: 2 });
    expect(talk.setFocus(9)).toEqual({ kind: 'menu', focus: 2 });
  });

  it("each topic plays its lines, one per step, then comes back to the menu with the topic focused; Goodbye ends it", () => {
    const talk = new KeshTalk();
    talk.start('talk', given);
    for (const [i, topic] of keshData.topics.entries()) {
      if (topic.id === 'goodbye') continue;
      talk.setFocus(i);
      expect(talk.advance(given).kind).toBe('line');
      const steps = play(talk, given);
      expect(steps.map(text)).toEqual(topicLines(topic, true, false).map((l) => l.text));
      expect(steps.map((s) => (s.kind === 'line' ? [s.index, s.count] : null))).toEqual(steps.map((_, k) => [k, steps.length]));
      expect(talk.step).toEqual({ kind: 'menu', focus: i });
    }
    // The rack (M2 Task 8): Kesh's three lines, always, then the menu again.
    talk.setFocus(3);
    expect(talk.advance(given).kind).toBe('line');
    const rack = play(talk, given);
    expect(rack.map(text)).toEqual(keshData.topics[3]?.lines.map((l) => l.text));
    expect(rack).toHaveLength(3);
    expect(talk.step).toEqual({ kind: 'menu', focus: 3 });
    // Goodbye: its five lines, then closed. A topic is chosen from the menu only.
    expect(talk.choose(4, given).kind).toBe('line');
    expect(talk.choose(0, given).kind).toBe('line');
    const bye = play(talk, given);
    expect(bye.map(text)).toEqual(keshData.topics[4]?.lines.map((l) => l.text));
    expect(talk.step).toEqual({ kind: 'closed' });
    expect(talk.open).toBe(false);
    expect(talk.advance(given)).toEqual({ kind: 'closed' });
    // The Narrator's line is not Kesh speaking; his are.
    talk.start('talk', given);
    talk.choose(0, given);
    expect(keshSpeaking(talk.step)).toBe(true);
    while (talk.step.kind === 'line' && talk.step.line.who === 'kesh') talk.advance(given);
    expect(talk.step).toMatchObject({ kind: 'line', line: { who: 'narrator' } });
    expect(keshSpeaking(talk.step)).toBe(false);
    expect(keshSpeaking({ kind: 'menu', focus: 0 })).toBe(false);
  });

  it('the Sparkglass topic carries the first-sliver step (the flick with its toss, then the hint) only while the first sliver is not given', () => {
    const talk = new KeshTalk();
    talk.start('talk', nothingYet);
    talk.choose(1, nothingYet);
    const steps = play(talk, nothingYet);
    expect(steps).toHaveLength(9);
    expect(steps[6]).toMatchObject({ kind: 'line', line: { who: 'kesh', toss: 'sliver', text: '(flicks the sliver across the water) "First one\'s free. Don\'t get used to it."' } });
    expect(steps[7]).toMatchObject({ kind: 'line', line: { who: 'hint', text: 'Touch Sparkglass to your Writ to feed it.' } });
    expect(steps[8]).toMatchObject({ kind: 'line', line: { who: 'narrator' } });
    talk.choose(1, given);
    const after = play(talk, given);
    // Once the first is given and the tide's isn't due: LORE's "One a tide." in the step's place (Task 5).
    expect(after).toHaveLength(8);
    expect(after.some((s) => s.kind === 'line' && s.line.toss !== undefined)).toBe(false);
    expect(after[6]).toMatchObject({ kind: 'line', line: { who: 'kesh', text: '"One a tide. I\'m a fisherman, not a Pillar."', only: 'tide-taken' } });
    // With the tide's due, neither step.
    talk.choose(1, tide);
    expect(play(talk, tide)).toHaveLength(7);
  });

  it("Talk with Kesh's gifts due plays them first, in order: the tile's line, the seeds' flow, then the sliver, then the menu (Task 5)", () => {
    const all: TalkContext = { firstGiven: false, due: 'first', wordDue: true, seedsDue: true };
    expect(dueRuns(all)).toEqual([wordTossLines(), keshData.afterFirstPlot, firstSliverLines()]);
    expect(dueRuns(given)).toEqual([]);
    expect(dueRuns({ ...given, seedsDue: true })).toEqual([keshData.afterFirstPlot]);
    expect(dueRuns({ ...tide, wordDue: true })).toEqual([wordTossLines(), keshData.tideSliver]);
    const talk = new KeshTalk();
    expect(talk.start('talk', all)).toMatchObject({ kind: 'line', index: 0, count: 1, line: { toss: 'word' } });
    const lines = play(talk, all).map((s) => (s.kind === 'line' ? s.line : null));
    expect(lines).toEqual([...wordTossLines(), ...keshData.afterFirstPlot, ...firstSliverLines()]);
    expect(talk.step).toEqual({ kind: 'menu', focus: 0 });
    // Only the tile: its one line, then the menu.
    const word = new KeshTalk();
    expect(word.start('talk', { ...given, wordDue: true })).toMatchObject({ kind: 'line', count: 1, line: { toss: 'word' } });
    expect(word.advance(given)).toEqual({ kind: 'menu', focus: 0 });
    // Close mid-queue drops the rest.
    const some = new KeshTalk();
    some.start('talk', all);
    some.close();
    expect(some.start('talk', given)).toEqual({ kind: 'menu', focus: 0 });
  });

  it('Talk with a sliver due plays the due toss first, then the menu: the first sliver, or the tide\'s', () => {
    const first = new KeshTalk();
    expect(first.start('talk', fresh)).toMatchObject({ kind: 'line', index: 0, count: 2, line: { toss: 'sliver' } });
    expect(play(first, fresh).map((s) => (s.kind === 'line' ? s.line : null))).toEqual(firstSliverLines());
    expect(first.step).toEqual({ kind: 'menu', focus: 0 });
    const tides = new KeshTalk();
    expect(tides.start('talk', tide)).toEqual({ kind: 'line', index: 0, count: 1, line: keshData.tideSliver[0] });
    expect(tides.advance(tide)).toEqual({ kind: 'menu', focus: 0 });
    // Once the server has given it the context changes: the topic's step is "One a tide." (8 lines).
    tides.choose(1, given);
    expect(play(tides, given)).toHaveLength(8);
  });

  it('after naming, after the first plot and after the first feeding play their lines and close', () => {
    const talk = new KeshTalk();
    expect(talk.start('afterNaming', fresh)).toMatchObject({ kind: 'line', index: 0, count: 4, line: { who: 'kesh' } });
    const naming = play(talk, fresh);
    expect(naming.map((s) => (s.kind === 'line' ? s.line.who : ''))).toEqual(['kesh', 'narrator', 'hint', 'kesh']);
    expect(naming[3]).toMatchObject({ kind: 'line', line: { toss: 'word' } });
    expect(talk.step).toEqual({ kind: 'closed' });
    expect(talk.start('afterFirstPlot', given)).toMatchObject({ kind: 'line', index: 0, count: 4, line: { toss: 'seeds' } });
    expect(play(talk, given).map((s) => (s.kind === 'line' ? s.line.who : ''))).toEqual(['kesh', 'hint', 'kesh', 'narrator']);
    expect(talk.step).toEqual({ kind: 'closed' });
    expect(talk.start('afterFirstFeeding', given)).toEqual({ kind: 'line', index: 0, count: 1, line: keshData.afterFirstFeeding[0] });
    expect(talk.advance(given)).toEqual({ kind: 'closed' });
  });

  it('closes at any step', () => {
    const talk = new KeshTalk();
    talk.start('talk', fresh);
    expect(talk.close()).toEqual({ kind: 'closed' });
    talk.start('talk', given);
    expect(talk.close()).toEqual({ kind: 'closed' });
    talk.start('talk', given);
    talk.choose(2, given);
    talk.advance(given);
    expect(talk.step.kind).toBe('line');
    expect(talk.close()).toEqual({ kind: 'closed' });
    expect(talk.moveFocus(1)).toEqual({ kind: 'closed' });
    expect(talk.choose(0, given)).toEqual({ kind: 'closed' });
  });
});
