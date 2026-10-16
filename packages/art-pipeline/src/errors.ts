/**
 * A build failure: one or more problems, each a full sentence naming the
 * recipe, the frame and the pixel where there is one. Every message is listed
 * in docs/design/art-pipeline.md with what to do about it.
 */
export class PipelineError extends Error {
  readonly problems: readonly string[];

  constructor(problems: string | readonly string[]) {
    const list = typeof problems === 'string' ? [problems] : problems;
    super(list.join('\n'));
    this.name = 'PipelineError';
    this.problems = list;
  }
}
