import { firstSliverLines, keshData, KESH_GOODBYE_TOPIC, topicLines, type KeshData, type KeshDue, type KeshLine, type KeshTopic } from '@iot/shared';

/**
 * The talk box's flow (docs/design/holding.md "Kesh", M2 Task 4b), pure so
 * it is tested in node: which line shows, the menu of topics and what each
 * press does. Talk across the water plays the due toss first (the first
 * sliver's lines, or the tide's), then the menu; a topic plays its lines
 * (the Sparkglass topic's first-sliver step only while the first sliver
 * hasn't been given) and comes back to the menu; Goodbye plays its lines
 * and closes. `afterNaming` and `afterFirstFeeding` play their lines and
 * close. Confirm advances, Close ends it at any step. The lines are
 * data/kesh.json, word for word; the scene (ui/talkBox.ts) draws the step
 * and asks the server for the sliver on a toss line.
 */

/** The interact prompt's verb across the water from Kesh (beside the stations' USE). */
export const TALK_LABEL = 'TALK';
/** The speaker shown over Kesh's lines; the Narrator and a hint show none. */
export const KESH_NAME = 'Kesh';

export type TalkFlow = 'talk' | 'afterNaming' | 'afterFirstFeeding';

/** What the server says about Kesh, as the flow needs it. */
export interface TalkContext {
  firstGiven: boolean;
  due: KeshDue | null;
}

export type TalkStep =
  /** One line, `index` of `count` in the current run of lines. */
  | { kind: 'line'; line: KeshLine; index: number; count: number }
  /** The topics, one focused. */
  | { kind: 'menu'; focus: number }
  | { kind: 'closed' };

/** Where the lines go when they run out. */
type After = 'menu' | 'closed';

export class KeshTalk {
  private lines: KeshLine[] = [];
  private at = 0;
  private after: After = 'closed';
  private focus = 0;
  step: TalkStep = { kind: 'closed' };

  constructor(private readonly data: KeshData = keshData) {}

  /** The menu's titles, in order. */
  get topics(): readonly KeshTopic[] {
    return this.data.topics;
  }

  /** Whether the box is open. */
  get open(): boolean {
    return this.step.kind !== 'closed';
  }

  /** Opens the box on a flow: Talk plays the due toss, then the menu; the two moments play their lines and close. */
  start(flow: TalkFlow, ctx: TalkContext): TalkStep {
    this.focus = 0;
    switch (flow) {
      case 'afterNaming':
        return this.run(this.data.afterNaming, 'closed');
      case 'afterFirstFeeding':
        return this.run(this.data.afterFirstFeeding, 'closed');
      case 'talk':
        if (ctx.due === 'first') return this.run(firstSliverLines(this.data), 'menu');
        if (ctx.due === 'tide') return this.run(this.data.tideSliver, 'menu');
        return this.menu();
    }
  }

  /** Confirm on a line: the next line, or what follows the run (the menu, or the end). On the menu: the focused topic. */
  advance(ctx: TalkContext): TalkStep {
    switch (this.step.kind) {
      case 'closed':
        return this.step;
      case 'menu':
        return this.choose(this.step.focus, ctx);
      case 'line':
        this.at++;
        if (this.at < this.lines.length) return this.show();
        return this.after === 'menu' ? this.menu() : this.close();
    }
  }

  /** A topic from the menu, by index: its lines, then back to the menu; Goodbye's lines, then the end. */
  choose(index: number, ctx: TalkContext): TalkStep {
    const topic = this.data.topics[index];
    if (this.step.kind !== 'menu' || !topic) return this.step;
    this.focus = index;
    return this.run(topicLines(topic, ctx.firstGiven), topic.id === KESH_GOODBYE_TOPIC ? 'closed' : 'menu');
  }

  /** The menu's focus, wrapping. */
  moveFocus(delta: number): TalkStep {
    if (this.step.kind !== 'menu') return this.step;
    const n = this.data.topics.length;
    this.focus = (((this.focus + delta) % n) + n) % n;
    this.step = { kind: 'menu', focus: this.focus };
    return this.step;
  }

  setFocus(index: number): TalkStep {
    if (this.step.kind !== 'menu' || index < 0 || index >= this.data.topics.length) return this.step;
    this.focus = index;
    this.step = { kind: 'menu', focus: index };
    return this.step;
  }

  /** Circle or Esc: the box closes at any step. */
  close(): TalkStep {
    this.lines = [];
    this.at = 0;
    this.step = { kind: 'closed' };
    return this.step;
  }

  private run(lines: KeshLine[], after: After): TalkStep {
    this.lines = lines;
    this.at = 0;
    this.after = after;
    if (lines.length === 0) return after === 'menu' ? this.menu() : this.close();
    return this.show();
  }

  private show(): TalkStep {
    const line = this.lines[this.at];
    if (!line) return this.close();
    this.step = { kind: 'line', line, index: this.at, count: this.lines.length };
    return this.step;
  }

  private menu(): TalkStep {
    this.lines = [];
    this.at = 0;
    this.step = { kind: 'menu', focus: this.focus };
    return this.step;
  }
}

/** Whether a step shows one of Kesh's own lines (his `talk` row loops while it does). */
export function keshSpeaking(step: TalkStep): boolean {
  return step.kind === 'line' && step.line.who === 'kesh';
}
