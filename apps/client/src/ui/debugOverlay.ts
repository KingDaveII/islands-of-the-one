import { Button, decodeInput, hashRunState, type TickInput } from '@iot/sim';
import {
  drawLetters,
  LETTER_STATES,
  loadLetterSheet,
  rasterize,
  type LetterSheet,
  type LetterState,
} from '../render/letters.js';
import type { GameScene } from '../scenes/GameScene.js';

export function describeInput(i: TickInput): string {
  const b = i.buttons;
  const btn = [
    b & Button.Light ? 'L' : '',
    b & Button.Heavy ? 'H' : '',
    b & Button.Dodge ? 'D' : '',
    b & Button.Ability1 ? 'A1' : '',
    b & Button.Ability2 ? 'A2' : '',
    b & Button.Ability3 ? 'A3' : '',
    b & Button.Item1 ? 'I1' : '',
    b & Button.Item2 ? 'I2' : '',
  ]
    .filter(Boolean)
    .join('+');
  return `aim ${i.aim} move ${i.moveMag > 0 ? `${i.moveDir}x${i.moveMag}` : '-'} ${btn || '-'}`;
}

/** The Writ demo: emet and a sample Name, one row per letter state. */
export const WRIT_DEMO_TEXT = 'אמת גבעה';
const WRIT_DEMO_SCALE = 3;

/** Per-letter states for a demo row: the dark row darkens only the aleph, so emet reads as met. */
export function writDemoStates(state: LetterState): LetterState[] {
  const letters = Array.from(WRIT_DEMO_TEXT.replace(/\s/g, ''));
  return letters.map((_, i) => (state === 'dark' && i > 0 && i < 3 ? 'lit' : state));
}

/** F3: FPS, tick, entity count, seed, last input (and the state hash), plus the Writ letters demo. */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly stats: HTMLPreElement;
  private frame = 0;
  private hash = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'debug-overlay';
    this.el.hidden = true;
    this.stats = document.createElement('pre');
    this.el.appendChild(this.stats);
    document.body.appendChild(this.el);
    loadLetterSheet().then(
      (sheet) => {
        this.el.appendChild(writDemo(sheet));
      },
      (err: unknown) => {
        console.warn(err);
      },
    );
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }

  update(scene: GameScene | null, fps: number): void {
    if (this.el.hidden) return;
    if (!scene?.session) {
      this.stats.textContent = `FPS ${fps.toFixed(0)}\n(no run)`;
      return;
    }
    const run = scene.session.run;
    const s = run.state;
    if (this.frame++ % 30 === 0) this.hash = hashRunState(s);
    const last = run.record.inputs[run.record.inputs.length - 1] ?? 0;
    const entities = 1 + s.husks.length + s.pickups.length;
    this.stats.textContent = [
      `FPS     ${fps.toFixed(0)}`,
      `tick    ${s.tick}`,
      `entities ${entities} (husks ${s.husks.length}, pickups ${s.pickups.length})`,
      `seed    ${scene.session.seed}`,
      `input   ${describeInput(decodeInput(last))}`,
      `player  ${s.player.action} t${s.player.t} hp${s.player.hp} buf ${s.player.buffer} charge ${s.player.charge} armor ${s.player.armor}`,
      `hook    ${s.player.hook ? `${s.player.hook.hitId < 0 ? 'flying' : s.player.hook.pull} target ${s.player.hook.targetId}` : '-'}  items ${s.player.items.map((i) => (i.count ? `${i.id}x${i.count}` : '-')).join(' ')}`,
      `room    ${s.roomIndex + 1} ${s.room.phase} wave ${s.room.wave + 1}`,
      `slowmo  ${s.slowmo}  hash ${this.hash.toString(16)}`,
      `tuning changes ${run.record.tuningChanges.length}`,
    ].join('\n');
  }
}

function writDemo(sheet: LetterSheet): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'writ';
  for (const state of LETTER_STATES) {
    const label = document.createElement('span');
    label.textContent = state;
    const canvas = document.createElement('canvas');
    const { width, height } = rasterize(sheet, WRIT_DEMO_TEXT);
    canvas.width = width * WRIT_DEMO_SCALE;
    canvas.height = height * WRIT_DEMO_SCALE;
    const ctx = canvas.getContext('2d');
    if (ctx)
      drawLetters(ctx, sheet, WRIT_DEMO_TEXT, 0, 0, {
        scale: WRIT_DEMO_SCALE,
        states: writDemoStates(state),
      });
    grid.append(label, canvas);
  }
  return grid;
}
