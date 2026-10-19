import {
  SKILLS,
  TOAST_MAX,
  TOAST_MS,
  TOAST_TEXT,
  toastGlyphName,
  writFromView,
  writView,
  type HoldingResponse,
  type HoldingTake,
  type Skill,
  type ToastKind,
  type WritView,
} from '@iot/shared';

/**
 * The toasts (docs/design/holding.md "Sleep, the away card and toasts", M2
 * Task 7; GAME DESIGN: one line, bottom left, the body font with a small
 * glyph for its kind, at most two stacked, never taking input), pure so it
 * is tested in node: the queue (each toast holds `toastMs` then goes in one
 * frame, a new one pushes the older up a line, a third drops the oldest at
 * once, the same text restarts its hold instead of stacking) and the
 * triggers (a skill's level rising between two answers of one session, the
 * Writ falling under a day or going dark once per drain, remembered per
 * Kindled, a take-all's full store, anything refused as pack-full). The
 * strip (ui/toasts.ts) draws the queue; the scenes feed the triggers.
 */

/** A toast's glyph: a cell of ART's toast glyph sheet (#109), by name. */
export interface ToastGlyph {
  name: string;
}

export interface Toast {
  kind: ToastKind;
  text: string;
  glyph: ToastGlyph;
  /** Ms left before it blinks out. */
  life: number;
}

/** The queue: oldest first, so the last toast is the newest, drawn at the bottom. */
export class ToastQueue {
  readonly toasts: Toast[] = [];

  constructor(
    private readonly holdMs: number = TOAST_MS,
    private readonly max: number = TOAST_MAX,
  ) {}

  /** A toast: the same text as one showing restarts that one's hold; otherwise it joins at the bottom and the oldest goes past `max`. */
  push(kind: ToastKind, text: string, glyph: ToastGlyph): void {
    const same = this.toasts.find((t) => t.text === text);
    if (same) {
      same.life = this.holdMs;
      same.kind = kind;
      same.glyph = glyph;
      return;
    }
    this.toasts.push({ kind, text, glyph, life: this.holdMs });
    while (this.toasts.length > this.max) this.toasts.shift();
  }

  /** Time passes: a toast whose hold is over goes in one frame (no blink, no alpha). */
  update(dtMs: number): void {
    for (const t of this.toasts) t.life -= dtMs;
    const alive = this.toasts.filter((t) => t.life > 0);
    this.toasts.splice(0, this.toasts.length, ...alive);
  }

  lines(): string[] {
    return this.toasts.map((t) => t.text);
  }

  clear(): void {
    this.toasts.length = 0;
  }
}

/** A kind's glyph (ART): a skill level the skill's own (`skill-woodcutting`), store full the store's bin, never the item's icon, the rest by kind. */
export function toastGlyph(kind: ToastKind, skill: Skill | null = null): ToastGlyph {
  return { name: toastGlyphName(kind, skill) };
}

/**
 * The skills whose level rose from the previous answer of this session to
 * the next, with the new level. None on a session's first answer: levels
 * gained while away belong to the card.
 */
export function levelUps(prev: HoldingResponse | null, next: HoldingResponse): { skill: Skill; level: number }[] {
  if (!prev) return [];
  const ups: { skill: Skill; level: number }[] = [];
  for (const skill of SKILLS) {
    const before = prev.skills[skill].level;
    const after = next.skills[skill].level;
    if (after > before) ups.push({ skill, level: after });
  }
  return ups;
}

/** The skill-level toast's text and glyph. */
export function skillLevelToast(skill: Skill, level: number): { text: string; glyph: ToastGlyph } {
  return { text: TOAST_TEXT.skillLevel(skill, level), glyph: toastGlyph('skill-level', skill) };
}

/** The store-full toast after a take-all that left some of a stack in the basket (`take.left`), or null when all moved. */
export function storeFullToast(take: HoldingTake): { text: string; glyph: ToastGlyph } | null {
  const stuck = take.left[0];
  return stuck ? { text: TOAST_TEXT.storeFull(stuck.itemId), glyph: toastGlyph('store-full') } : null;
}

/** The pack-full toast (anything refused as `pack-full`). */
export function packFullToast(): { text: string; glyph: ToastGlyph } {
  return { text: TOAST_TEXT.PACK_FULL, glyph: toastGlyph('pack-full') };
}

/** Which Writ toasts a Writ is due at the server's clock: low while under a day with charge, dark once it has none; each keyed by the drain (`emptyAt`). */
export function writToastsDue(view: WritView, serverMs: number): { low: boolean; dark: boolean; emptyAt: string } {
  const d = writView(writFromView(view), serverMs);
  return { low: d.state === 'flickering', dark: d.state === 'dark' || d.state === 'fading', emptyAt: view.emptyAt };
}

export type WritToastKind = 'writLow' | 'writDark';

/** The storage key of a Writ toast's memory: `iot.toast.writLow.<who>`, `who` naming the Kindled. */
export function writToastKey(kind: WritToastKind, who: string): string {
  return `iot.toast.${kind}.${who}`;
}

/** What the memory needs of `localStorage`. */
export interface ToastStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or null where there is none (node, a blocked store). */
export function defaultToastStorage(): ToastStorage | null {
  try {
    const g = globalThis as { localStorage?: ToastStorage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Remembers the drain (`emptyAt`) each Writ toast was last shown for, per
 * Kindled, in `localStorage`, so each shows once per drain: a feed that
 * changes `emptyAt` re-arms it. Every read and write is wrapped: without
 * storage the toast may repeat, which is fine.
 */
export class WritToastMemory {
  constructor(private readonly storage: ToastStorage | null) {}

  told(kind: WritToastKind, who: string, emptyAt: string): boolean {
    try {
      return this.storage?.getItem(writToastKey(kind, who)) === emptyAt;
    } catch {
      return false;
    }
  }

  mark(kind: WritToastKind, who: string, emptyAt: string): void {
    try {
      this.storage?.setItem(writToastKey(kind, who), emptyAt);
    } catch {
      // Without storage the toast may repeat next session; that is fine.
    }
  }
}
