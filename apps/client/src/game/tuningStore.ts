import { defaultTuning, type TuningData } from '@iot/shared';

/**
 * The live tuning values (F2 panel edits them). New runs take a full copy as
 * part of their config; edits during a run are recorded into its replay log.
 */
type Listener = (t: TuningData) => void;

let current: TuningData = structuredClone(defaultTuning);
const listeners: Listener[] = [];

export const tuningStore = {
  get(): TuningData {
    return current;
  },
  set(next: TuningData): void {
    current = next;
    for (const l of listeners) l(current);
  },
  reset(): void {
    tuningStore.set(structuredClone(defaultTuning));
  },
  subscribe(l: Listener): () => void {
    listeners.push(l);
    return () => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    };
  },
};
