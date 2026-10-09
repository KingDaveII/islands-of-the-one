import { defaultTuning, type TuningData } from '@iot/shared';
import { ABILITY_KINDS, WEIGHT_CLASSES } from '@iot/sim';
import { tuningStore } from '../game/tuningStore.js';

type Path = (string | number)[];
type Leaf = string | number | boolean;

/** String fields edited with a select; other strings (names, text) are not tunable. */
const ENUMS: Record<string, readonly string[]> = {
  weightClass: WEIGHT_CLASSES,
  kind: ABILITY_KINDS,
};

/** Slider range for a value: 0..3x (or 0..1 for zero), step by magnitude. `key` refines ranges by unit. */
export function sliderSpec(v: number, key = ''): { min: number; max: number; step: number } {
  // Fractions that live in 0..1 (weight-class multipliers).
  if (/^(light|medium|heavy)$/.test(key)) return { min: 0, max: 1, step: 0.05 };
  // Millisecond fields that default to 0 (e.g. armor windows, dodge startup) still need a usable range.
  if (v === 0 && key.endsWith('Ms')) return { min: 0, max: 1000, step: 10 };
  if (Number.isInteger(v)) {
    const max = v === 0 ? 10 : Math.max(Math.abs(v) * 3, Math.abs(v) + 5);
    return { min: Math.min(0, v * 3), max, step: 1 };
  }
  const mag = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 2);
  const step = Number(mag.toPrecision(1));
  return { min: 0, max: Number((Math.abs(v) * 3).toPrecision(6)), step };
}

function setAt(obj: unknown, path: Path, value: Leaf): void {
  let cur = obj as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i] as string | number] as Record<string | number, unknown>;
  cur[path[path.length - 1] as string | number] = value;
}

function leaves(value: unknown, path: Path = []): { path: Path; value: Leaf }[] {
  if (typeof value === 'number' || typeof value === 'boolean') return [{ path, value }];
  if (typeof value === 'string') return String(path[path.length - 1]) in ENUMS ? [{ path, value }] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, [...path, i]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]));
  return [];
}

/**
 * F2 tuning panel: a slider for every numeric value in tuning.json (timings,
 * cooldowns, weight-class multipliers...), a select for enums (weight class,
 * ability kind), and read-only flags (locked), applied live. "Export JSON"
 * copies the current values in the data file's shape.
 */
export class TuningPanel {
  private readonly root: HTMLDivElement;
  private pending: TuningData | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'tuning-panel';
    this.root.className = 'overlay-panel';
    this.root.hidden = true;
    // Keep panel keystrokes away from the game's keyboard listeners.
    this.root.addEventListener('keydown', (e) => {
      if (e.key !== 'F2' && e.key !== 'F3') e.stopPropagation();
    });
    document.body.appendChild(this.root);
    this.build();
    tuningStore.subscribe(() => {
      if (!this.pending) this.syncValues();
    });
  }

  toggle(): void {
    this.root.hidden = !this.root.hidden;
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  private build(): void {
    const t = tuningStore.get();
    this.root.innerHTML = '';
    const head = document.createElement('header');
    head.innerHTML = '<strong>TUNING</strong> <span>F2 · applied live · recorded in the run</span>';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export JSON';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    const status = document.createElement('span');
    status.className = 'status';
    head.append(exportBtn, resetBtn, status);
    const out = document.createElement('textarea');
    out.readOnly = true;
    out.hidden = true;
    exportBtn.addEventListener('click', () => {
      const json = `${JSON.stringify(tuningStore.get(), null, 2)}\n`;
      out.value = json;
      out.hidden = false;
      out.select();
      navigator.clipboard.writeText(json).then(
        () => {
          status.textContent = 'copied: paste into packages/shared/data/tuning.json';
        },
        () => {
          status.textContent = 'copy blocked: select the text below';
        },
      );
    });
    resetBtn.addEventListener('click', () => {
      tuningStore.reset();
      status.textContent = 'reset to data file values';
    });
    this.root.append(head, out);

    const groups = new Map<string, HTMLElement>();
    for (const { path, value } of leaves(t)) {
      const group = String(path[0]);
      let body = groups.get(group);
      if (!body) {
        const details = document.createElement('details');
        details.open = group === 'player' || group === 'dodge' || group === 'perfectDodge';
        const summary = document.createElement('summary');
        summary.textContent = group;
        body = document.createElement('div');
        details.append(summary, body);
        this.root.append(details);
        groups.set(group, body);
      }
      const original = leaves(defaultTuning).find((l) => l.path.join('.') === path.join('.'))?.value ?? value;
      const key = String(path[path.length - 1]);
      const row = document.createElement('label');
      row.className = 'row';
      const name = document.createElement('span');
      name.textContent = path.slice(1).join('.');
      const num = document.createElement('output');
      num.textContent = String(value);
      let input: HTMLInputElement | HTMLSelectElement;
      if (typeof value === 'boolean') {
        // Flags such as `locked` are game data, not feel: shown, not editable.
        row.classList.add('readonly');
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value;
        input.disabled = true;
      } else if (typeof value === 'string') {
        const select = document.createElement('select');
        for (const option of ENUMS[key] ?? []) select.add(new Option(option, option, false, option === value));
        select.addEventListener('change', () => {
          num.textContent = select.value;
          num.classList.toggle('changed', select.value !== original);
          this.apply(path, select.value);
        });
        input = select;
      } else {
        const spec = sliderSpec(typeof original === 'number' ? original : value, key);
        const range = document.createElement('input');
        range.type = 'range';
        range.min = String(spec.min);
        range.max = String(Math.max(spec.max, value));
        range.step = String(spec.step);
        range.value = String(value);
        range.addEventListener('input', () => {
          const v = Number(range.value);
          num.textContent = String(v);
          num.classList.toggle('changed', v !== original);
          this.apply(path, v);
        });
        input = range;
      }
      input.dataset.path = JSON.stringify(path);
      row.append(name, input, num);
      body.append(row);
    }
  }

  /** Coalesce slider drags into one tuning change per animation frame. */
  private apply(path: Path, value: Leaf): void {
    const next = this.pending ?? structuredClone(tuningStore.get());
    setAt(next, path, value);
    if (!this.pending) {
      this.pending = next;
      requestAnimationFrame(() => {
        const t = this.pending;
        this.pending = null;
        if (t) tuningStore.set(t);
      });
    }
  }

  private syncValues(): void {
    const t = tuningStore.get();
    const byPath = new Map(leaves(t).map((l) => [JSON.stringify(l.path), l.value]));
    for (const input of this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[type=range], select')) {
      const v = byPath.get(input.dataset.path ?? '');
      if (v === undefined) continue;
      input.value = String(v);
      const out = input.nextElementSibling;
      if (out) {
        out.textContent = String(v);
        out.classList.remove('changed');
      }
    }
  }
}
