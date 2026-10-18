import Phaser from 'phaser';
import type { KeshTopic } from '@iot/shared';
import { directionGlyphs } from '../game/holdingView.js';
import { KESH_NAME, type TalkStep } from '../game/keshTalk.js';
import type { Rect as ViewRect } from '../game/view.js';
import { Palette } from '../palette.js';
import { DEPTH } from '../render/depth.js';
import { HintRow, type HintItem } from '../render/hint.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The box (UI px): at most this wide, at the bottom of the view, clear of the HUD's corner chips. */
const MAX_W = 320;
const SIDE_CLEAR = 78;
const INSET = 8;
const PAD = 6;
const ROW = 11;

export interface TalkBoxHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  /** The world view's rectangle in UI px: the box sits at its bottom. */
  frame(): Readonly<ViewRect>;
  /** Whether the menu's focus ring shows (the pad, or once the keys moved it). */
  showFocus(): boolean;
  /** The interact hint, for the row in the corner of the box. */
  hint(): HintItem[];
  /** A topic row pressed with the pointer. */
  choose(index: number): void;
  /** The pointer over a topic row. */
  hover(index: number): void;
}

/**
 * The talk box (docs/design/holding.md "Kesh", M2 Task 4b): a placeholder
 * in the existing panel style at the bottom of the screen, until ART's UI
 * kit replaces the look. One line at a time: the speaker ("Kesh", nothing
 * for the Narrator or a hint) and the line, Kesh's in the UI ink, the
 * Narrator's in the muted style under a divider (readability.md §4), a hint
 * in the hint style; or the menu of topics with one focused. A note line
 * (a refusal, "Pack full.") sits under the line when there is one. The
 * flow is `KeshTalk` (game/keshTalk.ts); the scene feeds the keys and the
 * pad in and draws Kesh's `talk` row while his line is open.
 */
export class TalkBox {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly speaker: Text;
  private readonly line: Text;
  private readonly note: Text;
  private readonly rows: { text: Text; zone: Phaser.GameObjects.Zone }[] = [];
  private readonly hintRow: HintRow;
  private step: TalkStep = { kind: 'closed' };
  private noteText = '';
  private placed = '';

  constructor(
    private readonly host: TalkBoxHost,
    private readonly topics: readonly KeshTopic[],
  ) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.speaker = label(scene, 0, 0, KESH_NAME, Palette.uiInk).setVisible(false);
    this.line = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.note = body(scene, 0, 0, '', Palette.uiError).setVisible(false);
    this.hintRow = new HintRow(scene);
    for (const [i, topic] of topics.entries()) {
      const text = label(scene, 0, 0, topic.title, Palette.uiInk).setVisible(false);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0);
      zone.on('pointerover', () => {
        host.hover(i);
      });
      zone.on('pointerdown', () => {
        host.choose(i);
      });
      this.rows.push({ text, zone });
    }
    const objects = [this.g, this.speaker, this.line, this.note, this.hintRow.container, ...this.rows.flatMap((r) => [r.text, r.zone])];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
  }

  /** The step to show; the note (a refusal) clears with every new step. */
  show(step: TalkStep): void {
    if (step !== this.step) {
      this.step = step;
      this.noteText = '';
    }
    this.layout();
  }

  /** A line under the current one: the server's refusal of the toss ("Pack full."). */
  setNote(text: string): void {
    this.noteText = text;
    this.placed = '';
    this.layout();
  }

  /** Lays the box out at the bottom of the view; redraws only when something changed. */
  layout(): void {
    const frame = this.host.frame();
    const step = this.step;
    const w = Math.min(MAX_W, frame.w - 2 * SIDE_CLEAR);
    const inner = w - 2 * PAD;
    const key = JSON.stringify([frame, step, this.noteText, this.host.showFocus(), this.host.hint()]);
    if (key === this.placed) return;
    this.placed = key;
    const g = this.g;
    g.clear();
    this.speaker.setVisible(false);
    this.line.setVisible(false);
    this.note.setVisible(false);
    for (const r of this.rows) {
      r.text.setVisible(false);
      if (r.zone.input?.enabled) r.zone.disableInteractive();
    }
    if (step.kind === 'closed') {
      this.hintRow.setVisible(false);
      return;
    }
    const x = Math.round(frame.x + frame.w / 2 - w / 2);
    let h = PAD;
    const draws: (() => void)[] = [];
    if (step.kind === 'line') {
      const { line } = step;
      const color = line.who === 'kesh' ? Palette.uiInk : line.who === 'narrator' ? Palette.uiInkMuted : Palette.talkHint;
      if (line.who === 'kesh') {
        const sy = h;
        draws.push(() => place(this.speaker.setVisible(true), x + PAD, this.top + sy));
        h += 10;
      } else if (line.who === 'narrator') {
        const dy = h + 2;
        draws.push(() => {
          divider(g, x + PAD, this.top + dy, inner);
        });
        h += 6;
      }
      this.line.setMaxWidth(inner).setText(line.text).setTint(color);
      // Kesh's stage directions in brackets read muted, so what he says stands out from what he does (ART on #95).
      this.line.setCharacterTint(0, -1, false);
      if (line.who === 'kesh')
        for (const i of directionGlyphs(line.text, this.line.getTextBounds(false).wrappedText))
          this.line.setCharacterTint(i, 1, false, Palette.uiInkMuted);
      const ly = h;
      draws.push(() => place(this.line.setVisible(true), x + PAD, this.top + ly));
      h += Math.round(this.line.height) + 3;
      if (this.noteText !== '') {
        this.note.setMaxWidth(inner).setText(this.noteText);
        const ny = h;
        draws.push(() => place(this.note.setVisible(true), x + PAD, this.top + ny));
        h += Math.round(this.note.height) + 3;
      }
    } else {
      for (const [i, r] of this.rows.entries()) {
        const ry = h;
        const focused = i === step.focus;
        draws.push(() => {
          r.text.setTint(focused && this.host.showFocus() ? Palette.uiFocus : Palette.uiInk);
          place(r.text.setVisible(true), x + PAD + 8, this.top + ry);
          if (focused) g.fillStyle(Palette.uiFocus, 1).fillRect(x + PAD + 1, this.top + ry + 2, 3, 3);
          r.zone.setPosition(x, this.top + ry - 1).setSize(w, ROW);
          // A disabled zone keeps its input object: re-enable it by its flag, not its presence.
          if (!r.zone.input?.enabled) r.zone.setInteractive({ useHandCursor: true });
          const area: unknown = r.zone.input?.hitArea;
          if (area instanceof Phaser.Geom.Rectangle) area.setSize(w, ROW);
        });
        h += ROW;
      }
      h += 2;
    }
    h += PAD;
    this.top = frame.y + frame.h - INSET - h;
    panel(g, x, this.top, w, h);
    for (const d of draws) d();
    // The interact hint in the corner: confirm advances (or chooses).
    const items = this.host.hint();
    this.hintRow.setItems(items).place(x + w - PAD, this.top + h - PAD + 1, 1, 1).setVisible(items.length > 0 && step.kind === 'line');
  }

  private top = 0;

  /** The box's rectangle (UI px) this frame, for the playtests. */
  rect(): ViewRect {
    const frame = this.host.frame();
    const w = Math.min(MAX_W, frame.w - 2 * SIDE_CLEAR);
    return { x: Math.round(frame.x + frame.w / 2 - w / 2), y: this.top, w, h: frame.y + frame.h - INSET - this.top };
  }

  snapshot(): { kind: TalkStep['kind']; who: string | null; speaker: string | null; text: string; note: string; focus: number | null; topics: string[]; index: number | null; count: number | null } {
    const s = this.step;
    return {
      kind: s.kind,
      who: s.kind === 'line' ? s.line.who : null,
      speaker: this.speaker.visible ? this.speaker.text : null,
      text: s.kind === 'line' ? s.line.text : '',
      note: this.noteText,
      focus: s.kind === 'menu' ? s.focus : null,
      topics: s.kind === 'menu' ? this.topics.map((t) => t.title) : [],
      index: s.kind === 'line' ? s.index : null,
      count: s.kind === 'line' ? s.count : null,
    };
  }

  destroy(): void {
    for (const o of [this.g, this.speaker, this.line, this.note]) o.destroy();
    for (const r of this.rows) {
      r.text.destroy();
      r.zone.destroy();
    }
    this.hintRow.destroy();
  }
}
