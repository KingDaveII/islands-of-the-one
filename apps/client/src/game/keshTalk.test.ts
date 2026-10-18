import { firstSliverLines, keshData } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { KESH_NAME, KeshTalk, keshSpeaking, TALK_LABEL, type TalkContext, type TalkStep } from './keshTalk.js';

/**
 * The talk box's flow as a state machine (docs/design/holding.md "Kesh"):
 * the menu, each topic's steps, the first-sliver step present or absent,
 * the due toss before the menu, Close at any step.
 */
const fresh: TalkContext = { firstGiven: false, due: 'first' };
const given: TalkContext = { firstGiven: true, due: null };
const tide: TalkContext = { firstGiven: true, due: 'tide' };

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

  it('Talk with nothing due opens on the menu: the four topics in order, Goodbye last', () => {
    const talk = new KeshTalk();
    expect(talk.open).toBe(false);
    expect(talk.start('talk', given)).toEqual({ kind: 'menu', focus: 0 });
    expect(talk.open).toBe(true);
    expect(talk.topics.map((t) => t.title)).toEqual(['The Old Letters', 'Sparkglass', 'Where the crack points', 'Goodbye']);
    expect(talk.moveFocus(1)).toEqual({ kind: 'menu', focus: 1 });
    expect(talk.moveFocus(-2)).toEqual({ kind: 'menu', focus: 3 });
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
      expect(steps.map(text)).toEqual(topic.lines.filter((l) => l.only === undefined).map((l) => l.text));
      expect(steps.map((s) => (s.kind === 'line' ? [s.index, s.count] : null))).toEqual(steps.map((_, k) => [k, steps.length]));
      expect(talk.step).toEqual({ kind: 'menu', focus: i });
    }
    // Goodbye: its five lines, then closed. A topic is chosen from the menu only.
    expect(talk.choose(3, given).kind).toBe('line');
    expect(talk.choose(0, given).kind).toBe('line');
    const bye = play(talk, given);
    expect(bye.map(text)).toEqual(keshData.topics[3]?.lines.map((l) => l.text));
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
    talk.start('talk', { firstGiven: false, due: null });
    talk.choose(1, { firstGiven: false, due: null });
    const steps = play(talk, { firstGiven: false, due: null });
    expect(steps).toHaveLength(9);
    expect(steps[6]).toMatchObject({ kind: 'line', line: { who: 'kesh', toss: 'sliver', text: '(flicks the sliver across the water) "First one\'s free. Don\'t get used to it."' } });
    expect(steps[7]).toMatchObject({ kind: 'line', line: { who: 'hint', text: 'Touch Sparkglass to your Writ to feed it.' } });
    expect(steps[8]).toMatchObject({ kind: 'line', line: { who: 'narrator' } });
    talk.choose(1, given);
    const after = play(talk, given);
    expect(after).toHaveLength(7);
    expect(after.some((s) => s.kind === 'line' && s.line.toss !== undefined)).toBe(false);
  });

  it('Talk with a sliver due plays the due toss first, then the menu: the first sliver, or the tide\'s', () => {
    const first = new KeshTalk();
    expect(first.start('talk', fresh)).toMatchObject({ kind: 'line', index: 0, count: 2, line: { toss: 'sliver' } });
    expect(play(first, fresh).map((s) => (s.kind === 'line' ? s.line : null))).toEqual(firstSliverLines());
    expect(first.step).toEqual({ kind: 'menu', focus: 0 });
    const tides = new KeshTalk();
    expect(tides.start('talk', tide)).toEqual({ kind: 'line', index: 0, count: 1, line: keshData.tideSliver[0] });
    expect(tides.advance(tide)).toEqual({ kind: 'menu', focus: 0 });
    // Once the server has given it the context changes: the topic's step is gone.
    tides.choose(1, given);
    expect(play(tides, given)).toHaveLength(7);
  });

  it('after naming and after the first feeding play their lines and close', () => {
    const talk = new KeshTalk();
    expect(talk.start('afterNaming', fresh)).toMatchObject({ kind: 'line', index: 0, count: 3, line: { who: 'kesh' } });
    expect(play(talk, fresh).map((s) => (s.kind === 'line' ? s.line.who : ''))).toEqual(['kesh', 'narrator', 'hint']);
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
