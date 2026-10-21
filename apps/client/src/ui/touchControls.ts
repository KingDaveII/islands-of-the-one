import type Phaser from 'phaser';
import { TOUCH_GLYPH_LARGE_CELLS } from '@iot/shared';
import { deviceStore } from '../game/activeDevice.js';
import { TouchInput, type TouchRelease } from '../game/touchInput.js';
import { controlAt, notePlace, TOUCH, touchLayout, touchScreen, type AbilityControl, type TouchControl, type TouchControlId, type TouchLayout, type TouchMode } from '../game/touchLayout.js';
import type { Rect } from '../game/view.js';
import { Palette } from '../palette.js';
import { DEPTH } from '../render/depth.js';
import { checker, circlePixels, discPixels, pixelAngle, type Px } from '../render/pixelShapes.js';
import { plot } from '../render/pixels.js';
import { ITEM_ICON_TEXTURE, TOUCH_GLYPH_LARGE_TEXTURE, TOUCH_GLYPH_TEXTURE } from '../render/sheets.js';
import { body, label, place, type Text } from '../render/text.js';
import { ditherRect, icon, panel } from '../render/ui.js';

/**
 * The touch layer (M2 Task 10, docs/design/controls.md §6): the floating left
 * stick and the buttons, on the UI camera, shown only while touch is the
 * active device. Its logic is pure (game/touchLayout.ts, game/touchInput.ts);
 * this draws ART's look and feeds it the scene's pointer events.
 *
 * ART's look (2026-10-20): the buttons are the plain HUD panel, a hollow-deep
 * face as the 50 % checker dither (every other pixel shows the world), a 1 px
 * hollow-below bevel top and left, a 1 px dream-night outline and a hard 1 px
 * drop shadow; LIGHT, HEAVY, DODGE, the abilities and USE discs, the gear and
 * the item slots chamfered squares; each glyph from the touch-glyph sheet
 * centred at 1 UI px per px. Pressed, a button sinks into the clay: no
 * shadow, the content 1 px down and right, the bevel bottom and right; never
 * a colour flash. A cooldown is a solid dream-night sweep over the time left,
 * clockwise from 12 o'clock, whole seconds on top, the frame lit briefly when
 * it is back; a locked slot shows the hollow-dusk lock. The stick: a 2 px
 * ring (dream-night outside, hollow-below inside) the size of its travel with
 * the dither inside, and a solid panel knob with the bevel, there only while
 * held. No alpha anywhere.
 */

/** How long a button's frame stays lit after its cooldown comes back, as the run HUD's slots. */
const READY_FLASH_MS = 200;

/** What a button shows this frame (the scene says): its cooldown left (0..1) and whole seconds, locked, an item and its count. */
export interface TouchButtonState {
  cooldown?: number;
  seconds?: number;
  locked?: boolean;
  /** The item slots: the item's id (its item-icons cell) and how many are left. */
  item?: { id: string; count: number } | null;
}

export interface TouchControlsOptions {
  mode: TouchMode;
  layer: Phaser.GameObjects.Layer;
  /** The UI camera's zoom (device px per UI px). */
  uiZoom: () => number;
  /** The HUD's panels this frame (UI px): no control covers them. */
  avoid: () => readonly Rect[];
  /** The ability buttons that show: the run weapon's unlocked slots (GAME DESIGN: locked ones never show on touch). */
  abilities?: readonly AbilityControl[];
  /** Whether a control shows now (USE only while a prompt is up). */
  showing?: (id: TouchControlId) => boolean;
  /** Whether a touch on the world may anchor the stick now (not while a panel is open). */
  stickAllowed?: () => boolean;
  /** Whether the layer takes this touch at all (`onControl`: it landed on a showing control); false leaves it to the scene (the away card, the talk box, build mode). */
  claim?: (pointer: Phaser.Input.Pointer, onControl: boolean) => boolean;
  /** A tap on the world (UI px): down and up, short and still, on nothing else. */
  onTap?: (x: number, y: number) => void;
  /** The gear or USE let go on itself (USE also presses interact for the sampler). */
  onControl?: (id: TouchControlId) => void;
  /** A finger landed on the stick or a button: the scene drops what a tap started (the tap walk). */
  onTouch?: (zone: 'stick' | 'control') => void;
  state?: (id: TouchControlId) => TouchButtonState;
}

/** The touch-glyph cell each control draws (the abilities by their id; the item slots draw the item). */
function glyphFor(id: TouchControlId): string | null {
  switch (id) {
    case 'light':
    case 'heavy':
    case 'dodge':
    case 'gear':
    case 'use':
      return id;
    case 'ability1':
      return 'haul';
    default:
      return null;
  }
}

/** The disc pixel sets by radius, made once. */
const discCache = new Map<number, Px[]>();
const discOf = (r: number): Px[] => {
  let d = discCache.get(r);
  if (!d) {
    d = discPixels(r);
    discCache.set(r, d);
  }
  return d;
};
const ringCache = new Map<number, Px[]>();
const ringOf = (r: number): Px[] => {
  let d = ringCache.get(r);
  if (!d) {
    d = circlePixels(r);
    ringCache.set(r, d);
  }
  return d;
};
/** The top-left half of a ring (the bevel unpressed), or the bottom-right half (pressed). */
const halfOf = (ring: readonly Px[], topLeft: boolean): Px[] =>
  ring.filter((p) => {
    const a = pixelAngle(p);
    const tl = a > (3 * Math.PI) / 4 && a < (7 * Math.PI) / 4;
    return tl === topLeft;
  });
/** A pixel's share of a turn clockwise from 12 o'clock (0..1). */
const fromNoon = (p: Px): number => ((pixelAngle(p) + Math.PI / 2) % (Math.PI * 2)) / (Math.PI * 2);

export class TouchControls {
  readonly input: TouchInput;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly glyphs = new Map<TouchControlId, Phaser.GameObjects.Image>();
  private readonly texts = new Map<TouchControlId, Text>();
  /** A short line beside a control (the gear's "Tap again to leave the run."), or null. */
  private note: { id: TouchControlId; text: string } | null = null;
  private noteText: Text | null = null;
  private readonly noteG: Phaser.GameObjects.Graphics;
  private layoutKey = '';
  private visible = false;
  private now = 0;
  private readonly readyUntil = new Map<TouchControlId, number>();
  private readonly prevCooldown = new Map<TouchControlId, number>();
  private readonly offDevice: () => void;
  private readonly handlers: [string, (...args: never[]) => void][] = [];
  private readonly sceneHandlers: [string, () => void][] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly opts: TouchControlsOptions,
  ) {
    this.input = new TouchInput(this.computeLayout());
    this.g = scene.add.graphics().setDepth(DEPTH.touch);
    this.noteG = scene.add.graphics().setDepth(DEPTH.touch);
    opts.layer.add([this.g, this.noteG]);
    this.visible = deviceStore.get() === 'touch';
    this.offDevice = deviceStore.subscribe((d) => {
      if (d !== 'touch') this.input.cancelAll();
    });
    const down = (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
      if (!p.wasTouch) return;
      const at = this.toUi(p);
      if (opts.claim && !opts.claim(p, this.hits(p))) return;
      // The browser's own event times (a busy frame never turns a tap into a hold).
      const zone = this.input.down(p.id, at.x, at.y, p.downTime, {
        overHud: over.length > 0,
        stick: opts.stickAllowed?.() ?? true,
        showing: (id) => this.showing(id),
      });
      if (zone.kind === 'stick' || zone.kind === 'control') opts.onTouch?.(zone.kind);
    };
    const move = (p: Phaser.Input.Pointer): void => {
      if (!p.wasTouch || !p.isDown) return;
      const at = this.toUi(p);
      this.input.move(p.id, at.x, at.y);
    };
    const up = (p: Phaser.Input.Pointer): void => {
      if (!p.wasTouch) return;
      const at = this.toUi(p);
      this.released(this.input.up(p.id, at.x, at.y, p.upTime));
    };
    // A paused scene (the inventory over the holding, the portrait line) never hears its fingers lift: let them all go.
    const letGo = (): void => {
      this.input.cancelAll();
    };
    scene.events.on('pause', letGo);
    scene.events.on('resume', letGo);
    this.sceneHandlers.push(['pause', letGo], ['resume', letGo]);
    this.on('pointerdown', down);
    this.on('pointermove', move);
    this.on('pointerup', up);
    this.on('pointerupoutside', up);
  }

  private on(event: string, fn: (...args: never[]) => void): void {
    this.scene.input.on(event, fn);
    this.handlers.push([event, fn]);
  }

  private released(r: TouchRelease): void {
    if (r.kind === 'tap') this.opts.onTap?.(r.x, r.y);
    else if (r.kind === 'control') this.opts.onControl?.(r.id);
  }

  /** A pointer on the UI grid (UI px): the canvas px over the UI zoom. */
  private toUi(p: Phaser.Input.Pointer): { x: number; y: number } {
    const z = this.opts.uiZoom();
    return { x: p.x / z, y: p.y / z };
  }

  /** Whether a pointer is on a showing control (the scene's own handlers leave such a touch alone). */
  hits(p: Phaser.Input.Pointer): boolean {
    if (!this.visible) return false;
    const at = this.toUi(p);
    return controlAt(this.input.layout, at.x, at.y, (id) => this.showing(id)) !== null;
  }

  private showing(id: TouchControlId): boolean {
    return this.visible && (this.opts.showing?.(id) ?? true);
  }

  private computeLayout(): TouchLayout {
    const s = touchScreen(this.scene.scale.width, this.scene.scale.height, window.devicePixelRatio);
    return touchLayout(s, { mode: this.opts.mode, abilities: this.opts.abilities ?? [], avoid: this.opts.avoid() });
  }

  /** The layout as drawn (playtests and screenshots read it). */
  get layout(): TouchLayout {
    return this.input.layout;
  }

  /** Whether the layer shows (touch is the active device). */
  get shown(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.offDevice();
    for (const [event, fn] of this.handlers) this.scene.input.off(event, fn);
    this.handlers.length = 0;
    for (const [event, fn] of this.sceneHandlers) this.scene.events.off(event, fn);
    this.sceneHandlers.length = 0;
    this.input.cancelAll();
    this.g.destroy();
    this.noteG.destroy();
    this.noteText?.destroy();
    for (const i of this.glyphs.values()) i.destroy();
    for (const t of this.texts.values()) t.destroy();
  }

  /** Every frame: lay out again if the screen or the HUD moved, then draw (nothing unless touch is the device). */
  update(dtMs: number): void {
    this.now += dtMs;
    this.visible = deviceStore.get() === 'touch';
    const avoid = this.opts.avoid();
    const key = `${this.scene.scale.width}x${this.scene.scale.height}@${window.devicePixelRatio}|${avoid.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')}`;
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.input.layout = this.computeLayout();
    }
    const g = this.g;
    g.clear();
    for (const i of this.glyphs.values()) i.setVisible(false);
    for (const t of this.texts.values()) t.setVisible(false);
    this.noteG.clear();
    this.noteText?.setVisible(false);
    if (!this.visible) return;
    for (const c of this.input.layout.controls) if (this.showing(c.id)) this.drawControl(c);
    this.drawStick();
    this.drawNote();
  }

  /** Shows a short line beside a control until it is cleared (null): the gear's tap-again line in a run. */
  setNote(id: TouchControlId, text: string | null): void {
    this.note = text === null ? null : { id, text };
  }

  /** The note on a plain panel, on its control's row against it (`notePlace`, ART on #136); it leaves in one frame. */
  private drawNote(): void {
    const n = this.note;
    const c = n && this.input.layout.controls.find((x) => x.id === n.id);
    if (!n || !c) return;
    if (!this.noteText) {
      this.noteText = body(this.scene, 0, 0, n.text, Palette.uiInk).setDepth(DEPTH.touch);
      this.opts.layer.add(this.noteText);
    }
    const t = this.noteText;
    if (t.text !== n.text) t.setText(n.text);
    const at = notePlace(this.input.layout, c.id, Math.round(t.width) + 8, 14);
    if (!at) return;
    panel(this.noteG, at.x, at.y, at.w, at.h, { plain: true });
    place(t.setVisible(true), at.x + 4, at.y + 3);
  }

  private glyph(id: TouchControlId, texture: string, frame: string): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(texture) || !this.scene.textures.get(texture).has(frame)) return null;
    let img = this.glyphs.get(id);
    if (!img) {
      img = this.scene.add.image(0, 0, texture, frame).setOrigin(0, 0).setDepth(DEPTH.touch);
      this.opts.layer.add(img);
      this.glyphs.set(id, img);
    }
    if (img.texture.key !== texture || img.frame.name !== frame) img.setTexture(texture, frame);
    return img.setVisible(true);
  }

  private text(id: TouchControlId, value: string): Text {
    let t = this.texts.get(id);
    if (!t) {
      t = label(this.scene, 0, 0, value).setDepth(DEPTH.touch);
      this.opts.layer.add(t);
      this.texts.set(id, t);
    }
    if (t.text !== value) t.setText(value);
    return t.setVisible(true);
  }

  /** Lights a button's frame briefly when its cooldown comes back. */
  private ready(id: TouchControlId, cooldown: number): boolean {
    if (cooldown === 0 && (this.prevCooldown.get(id) ?? 0) > 0) this.readyUntil.set(id, this.now + READY_FLASH_MS);
    this.prevCooldown.set(id, cooldown);
    return (this.readyUntil.get(id) ?? 0) > this.now;
  }

  private drawControl(c: TouchControl): void {
    const g = this.g;
    const state = this.opts.state?.(c.id) ?? {};
    const pressed = this.input.held(c.id);
    const off = pressed ? 1 : 0;
    const cooldown = Math.max(0, Math.min(1, state.cooldown ?? 0));
    const lit = this.ready(c.id, cooldown);
    const frame = lit ? Palette.uiFocus : Palette.uiOutline;
    let cx: number;
    let cy: number;
    if (c.shape === 'disc') {
      const r = Math.ceil(c.size / 2) - 1;
      cx = c.rect.x + r;
      cy = c.rect.y + r;
      const ring = ringOf(r);
      if (!pressed) plot(g, ring, cx, cy + 1, Palette.uiOutline);
      cx += off;
      cy += off;
      // The face: every other pixel, on the screen's own grid.
      const face = checker(discOf(r - 2), (cx + cy) & 1);
      plot(g, face, cx, cy, Palette.uiPanel);
      // The bevel all the way round, just inside the outline (ART on #134: it reads on the Hollow margin and the pale
      // floor alike): its lit half top-left, the rest hollow-below; pressed, the light moves to the bottom right.
      plot(g, halfOf(ringOf(r - 1), !pressed), cx, cy, Palette.uiBevelLight);
      plot(g, halfOf(ringOf(r - 1), pressed), cx, cy, Palette.uiBevel);
      plot(g, ring, cx, cy, frame);
      if (cooldown > 0 && !state.locked)
        plot(
          g,
          discOf(r - 1).filter((p) => fromNoon(p) >= 1 - cooldown),
          cx,
          cy,
          Palette.uiOutline,
        );
    } else {
      const { x, y, w, h } = c.rect;
      const fill = (ox: number, oy: number, fw: number, fh: number, color: number): void => {
        g.fillStyle(color, 1).fillRect(ox, oy, fw, fh);
      };
      if (!pressed) {
        fill(x + 1, y + 1, w - 2, h, Palette.uiOutline);
        fill(x, y + 2, w, h - 2, Palette.uiOutline);
      }
      const bx = x + off;
      const by = y + off;
      // The outline, its corners chamfered by 1 px, the dithered face inside, the bevel.
      fill(bx + 1, by, w - 2, 1, frame);
      fill(bx + 1, by + h - 1, w - 2, 1, frame);
      fill(bx, by + 1, 1, h - 2, frame);
      fill(bx + w - 1, by + 1, 1, h - 2, frame);
      ditherRect(g, bx + 2, by + 2, w - 4, h - 4, Palette.uiPanel);
      // The bevel all the way round, just inside the outline (ART on #134): lit top and left, hollow-below bottom and
      // right; pressed, the light moves to the bottom and right.
      const light = pressed ? Palette.uiBevel : Palette.uiBevelLight;
      const shade = pressed ? Palette.uiBevelLight : Palette.uiBevel;
      fill(bx + 1, by + h - 2, w - 2, 1, shade);
      fill(bx + w - 2, by + 1, 1, h - 2, shade);
      fill(bx + 1, by + 1, w - 2, 1, light);
      fill(bx + 1, by + 1, 1, h - 2, light);
      cx = bx + Math.floor(w / 2);
      cy = by + Math.floor(h / 2);
    }
    // The content, centred: the lock, the item's icon and count, or the glyph; whole seconds over a cooldown.
    const G = 16;
    if (state.locked) {
      icon(g, 'lock', cx - 6, cy - 6, 12, Palette.uiInkMuted);
      return;
    }
    if (c.id === 'item1' || c.id === 'item2') {
      const item = state.item;
      if (!item) return;
      const img = this.glyph(c.id, ITEM_ICON_TEXTURE, item.id);
      if (img) img.setPosition(cx - G / 2, cy - G / 2);
      else icon(g, 'ration', cx - G / 2, cy - G / 2, G, item.count > 0 ? Palette.uiInk : Palette.uiBevel);
      if (item.count > 0) {
        const t = this.text(c.id, String(item.count));
        place(t, c.rect.x + off + c.size - 4, c.rect.y + off + c.size - 11, 1);
        g.fillStyle(Palette.uiOutline, 1).fillRect(t.x - 1, t.y - 1, Math.round(t.width) + 2, 9);
      }
      return;
    }
    const cell = glyphFor(c.id);
    // LIGHT and HEAVY on a big button draw ART's 24 px cell (#135); everything else the 16 px one.
    const large = cell !== null && (TOUCH_GLYPH_LARGE_CELLS as readonly string[]).includes(cell) && c.size >= TOUCH.glyphLargeMinUiPx;
    const gs = large ? 24 : G;
    if (cell) this.glyph(c.id, large ? TOUCH_GLYPH_LARGE_TEXTURE : TOUCH_GLYPH_TEXTURE, cell)?.setPosition(cx - gs / 2, cy - gs / 2);
    if (cooldown > 0 && (state.seconds ?? 0) > 0) {
      const t = this.text(c.id, String(state.seconds));
      place(t, cx, cy - 3, 0.5);
      g.fillStyle(Palette.uiOutline, 1).fillRect(t.x - 1, t.y - 1, Math.round(t.width) + 2, 9);
    }
  }

  private drawStick(): void {
    const s = this.input.stick();
    if (!s) return;
    const g = this.g;
    const R = this.input.layout.stickRadius;
    const ax = Math.round(s.anchor.x);
    const ay = Math.round(s.anchor.y);
    plot(g, checker(discOf(Math.max(0, R - 2)), (ax + ay) & 1), ax, ay, Palette.uiPanel);
    plot(g, ringOf(R), ax, ay, Palette.uiOutline);
    plot(g, ringOf(R - 1), ax, ay, Palette.uiBevel);
    const k = Math.max(6, Math.round(R * 0.4));
    const kx = Math.round(s.knob.x);
    const ky = Math.round(s.knob.y);
    // The knob reads raised, a thumb cap (ART on #134): hollow-below, lighter than the base, lit top-left in hollow-dusk.
    plot(g, discOf(k - 1), kx, ky, Palette.uiBevel);
    plot(g, halfOf(ringOf(k - 1), true), kx, ky, Palette.uiBevelLight);
    plot(g, ringOf(k), kx, ky, Palette.uiOutline);
  }
}

