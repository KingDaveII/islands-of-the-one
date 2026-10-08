import { Button, decodeInput, hashRunState, type TickInput } from '@iot/sim';
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
  ]
    .filter(Boolean)
    .join('+');
  return `aim ${i.aim} move ${i.moveMag > 0 ? `${i.moveDir}x${i.moveMag}` : '-'} ${btn || '-'}`;
}

/** F3: FPS, tick, entity count, seed, last input (and the state hash). */
export class DebugOverlay {
  private readonly el: HTMLPreElement;
  private frame = 0;
  private hash = 0;

  constructor() {
    this.el = document.createElement('pre');
    this.el.id = 'debug-overlay';
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }

  update(scene: GameScene | null, fps: number): void {
    if (this.el.hidden) return;
    if (!scene?.session) {
      this.el.textContent = `FPS ${fps.toFixed(0)}\n(no run)`;
      return;
    }
    const run = scene.session.run;
    const s = run.state;
    if (this.frame++ % 30 === 0) this.hash = hashRunState(s);
    const last = run.record.inputs[run.record.inputs.length - 1] ?? 0;
    const entities = 1 + s.husks.length + s.pickups.length;
    this.el.textContent = [
      `FPS     ${fps.toFixed(0)}`,
      `tick    ${s.tick}`,
      `entities ${entities} (husks ${s.husks.length}, pickups ${s.pickups.length})`,
      `seed    ${scene.session.seed}`,
      `input   ${describeInput(decodeInput(last))}`,
      `player  ${s.player.action} t${s.player.t} hp${s.player.hp} buf ${s.player.buffer}`,
      `room    ${s.roomIndex + 1} ${s.room.phase} wave ${s.room.wave + 1}`,
      `slowmo  ${s.slowmo}  hash ${this.hash.toString(16)}`,
      `tuning changes ${run.record.tuningChanges.length}`,
    ].join('\n');
  }
}
