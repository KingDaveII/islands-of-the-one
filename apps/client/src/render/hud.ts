import type Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { TICK_HZ, type Run } from '@iot/sim';
import type { Controls } from '../game/controls.js';
import { Palette } from '../palette.js';
import { chargeStage } from './charge.js';
import { GLYPH_SIZE } from './glyphCells.js';
import { HintRow } from './hint.js';
import { label, place } from './text.js';
import { abilitySlot, healthBar, icon, panel, tierPips, type IconKind } from './ui.js';

const W = 480;
const H = 270;
/** HUD inset from the screen edge and panel padding (game px). */
const INSET = 8;
const PAD = 4;
const SLOT = 20;
const SMALL = 14;
const SLOT_GAP = 4;
/** Height of the key-hint row under the slots: a 1× controller glyph. */
const HINT_H = GLYPH_SIZE;
const READY_FLASH_MS = 200;

const ABILITY_ICONS: Record<string, IconKind> = { haul: 'haul', 'the-catch': 'catch', 'turning-blade': 'sweep' };
const ITEM_ICONS: Record<string, IconKind> = { ration: 'ration' };

export type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];
/** A panel's screen rectangle (game px), outline and drop shadow included. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** The screen rectangle of a body (the player, a hostile) the panels must not hide. */
export type BodyRect = Rect;
/** A panel drops to this while the player or a hostile is behind it. */
export const HUD_BEHIND_ALPHA = 0.4;
const FADE_MS = 90;

/** How far the HUD's corner panels reach in from each screen edge: the camera keeps the room's corners outside them (GameScene). */
export interface SafeMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Screen-space HUD at the four corners (the center of the screen stays clear
 * for the fight):
 * - top left: HP, the dodge slot and the two consumable slots,
 * - bottom left: the weapon (light combo, heavy charge, 3 ability slots),
 * - top right: room counter,
 * - bottom right: Sparkglass.
 * Key hints are controller glyphs (the sheet in packages/shared/assets) from
 * the active control preset while a pad is connected, else the keyboard keys;
 * a binding with no glyph shows its label. Party portraits only show in a party.
 */
export class Hud {
  /** One Graphics per corner, so each panel can fade on its own. */
  private readonly g: Record<Corner, Phaser.GameObjects.Graphics>;
  /** Everything drawn in each corner (its graphics, texts and hint rows), for the fade. */
  private readonly parts: Record<Corner, { setAlpha(a: number): unknown }[]>;
  /** The panel rectangle each corner drew last frame. */
  private readonly rects: Record<Corner, Rect> = {
    tl: { x: 0, y: 0, w: 0, h: 0 },
    tr: { x: 0, y: 0, w: 0, h: 0 },
    bl: { x: 0, y: 0, w: 0, h: 0 },
    br: { x: 0, y: 0, w: 0, h: 0 },
  };
  private readonly alpha: Record<Corner, number> = { tl: 1, tr: 1, bl: 1, br: 1 };
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly dodgeKey: HintRow;
  private readonly itemKeys: HintRow[];
  private readonly itemCounts: Phaser.GameObjects.Text[];
  private readonly room: Phaser.GameObjects.Text;
  private readonly spark: Phaser.GameObjects.Text;
  private readonly weaponName: Phaser.GameObjects.Text;
  private readonly keys: HintRow[];
  private readonly secs: Phaser.GameObjects.Text[];
  private lagHp = -1;
  private readyUntil: number[] = [0, 0, 0, 0];
  private prevCooldown: number[] = [0, 0, 0, 0];
  private now = 0;
  /** The hint source the rows were last built for (device, preset, family, locked slots). */
  private hintKey = '';
  readonly partyPortraits = false;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    run: Run,
    weaponName: string,
    private readonly controls: Controls,
  ) {
    this.g = { tl: scene.add.graphics(), tr: scene.add.graphics(), bl: scene.add.graphics(), br: scene.add.graphics() };
    this.hpText = label(scene, 0, 0, '100');
    this.dodgeKey = new HintRow(scene);
    this.room = label(scene, 0, 0, 'ROOM 1/3');
    this.spark = label(scene, 0, 0, '0');
    this.weaponName = label(scene, 0, 0, weaponName.toUpperCase());
    const abilities = run.params.weapon.abilities;
    this.keys = [new HintRow(scene), new HintRow(scene), ...abilities.map(() => new HintRow(scene))];
    this.secs = abilities.map(() => label(scene, 0, 0, ''));
    this.itemKeys = run.state.player.items.map(() => new HintRow(scene));
    this.itemCounts = run.state.player.items.map(() => label(scene, 0, 0, ''));
    this.parts = {
      tl: [this.g.tl, this.hpText, this.dodgeKey.container, ...this.itemKeys.map((k) => k.container), ...this.itemCounts],
      tr: [this.g.tr, this.room],
      bl: [this.g.bl, this.weaponName, ...this.keys.map((k) => k.container), ...this.secs],
      br: [this.g.br, this.spark],
    };
    layer.add([
      ...CORNERS.map((c) => this.g[c]),
      this.hpText,
      this.dodgeKey.container,
      this.room,
      this.spark,
      this.weaponName,
      ...this.keys.map((k) => k.container),
      ...this.secs,
      ...this.itemKeys.map((k) => k.container),
      ...this.itemCounts,
    ]);
    this.syncHints(run);
  }

  /**
   * How far the corner panels reach in from each screen edge (their extents,
   * drop shadow included), from the latest draw. The camera may scroll past
   * the room's edges by this much, so a player in a room corner is always in
   * the clear area (docs/design/readability.md §3).
   */
  safeMargins(): SafeMargins {
    const r = this.rects;
    return {
      left: Math.max(r.tl.x + r.tl.w, r.bl.x + r.bl.w),
      right: W - Math.min(r.tr.x, r.br.x),
      top: Math.max(r.tl.y + r.tl.h, r.tr.y + r.tr.h),
      bottom: H - Math.min(r.bl.y, r.br.y),
    };
  }

  /** The panel rectangles drawn last frame, by corner. */
  panelRects(): Readonly<Record<Corner, Rect>> {
    return this.rects;
  }

  private panelAt(corner: Corner, x: number, y: number, w: number, h: number): void {
    // The panel's drop shadow adds a pixel below.
    this.rects[corner] = { x, y, w, h: h + 1 };
    panel(this.g[corner], x, y, w, h, { plain: true });
  }

  /** Fade each corner toward 40 % while a body is behind its panel, back to full when clear. */
  private fade(bodies: readonly BodyRect[], dtMs: number): void {
    const k = Math.min(1, dtMs / FADE_MS);
    for (const c of CORNERS) {
      const behind = bodies.some((b) => overlaps(b, this.rects[c]));
      const target = behind ? HUD_BEHIND_ALPHA : 1;
      const next = this.alpha[c] + (target - this.alpha[c]) * k;
      if (Math.abs(next - this.alpha[c]) < 0.002 && next === target) continue;
      this.alpha[c] = Math.abs(target - next) < 0.01 ? target : next;
      for (const part of this.parts[c]) part.setAlpha(this.alpha[c]);
    }
  }

  /** Key hints follow the device in use (gamepad preset glyphs or keyboard keys) and the input context; rebuilt only when those change. */
  private syncHints(run: Run): void {
    const source = this.controls.hintSource();
    const key =
      (source === 'keyboard' ? 'keyboard' : `${source.family}:${source.preset.id}`) +
      `:${this.controls.context}` +
      run.params.weapon.abilities.map((a) => (a.locked ? '-' : '+')).join('');
    if (key === this.hintKey) return;
    this.hintKey = key;
    const set = (row: HintRow | undefined, action: ControlAction): void => {
      row?.setHint(this.controls.hint(action));
    };
    set(this.dodgeKey, 'dodge');
    set(this.keys[0], 'light');
    set(this.keys[1], 'heavy');
    const abilityActions: ControlAction[] = ['ability1', 'ability2', 'ability3'];
    run.params.weapon.abilities.forEach((a, i) => {
      const row = this.keys[2 + i];
      const action = abilityActions[i];
      if (!row) return;
      if (a.locked || !action) row.setItems([]);
      else set(row, action);
    });
    set(this.itemKeys[0], 'item1');
    set(this.itemKeys[1], 'item2');
  }

  /** Lights a slot's frame briefly when its cooldown comes back. */
  private ready(i: number, cooldown: number): boolean {
    if (cooldown === 0 && (this.prevCooldown[i] ?? 0) > 0) this.readyUntil[i] = this.now + READY_FLASH_MS;
    this.prevCooldown[i] = cooldown;
    return (this.readyUntil[i] ?? 0) > this.now;
  }

  /** Draw the HUD. `bodies` are the screen rectangles of the player and the hostiles: a panel one is behind fades. */
  draw(run: Run, dtMs: number, bodies: readonly BodyRect[] = []): void {
    this.now += dtMs;
    this.syncHints(run);
    const s = run.state;
    const P = run.params;
    const p = s.player;
    for (const c of CORNERS) this.g[c].clear();
    let g = this.g.tl;

    // --- Top left: HP + dodge + consumables ----------------------------
    if (this.lagHp < 0) this.lagHp = p.hp;
    // The recent loss drains once hitstop is over.
    if (p.hitstop === 0) this.lagHp = Math.max(p.hp, this.lagHp - (dtMs / 1000) * 40);
    this.lagHp = Math.max(this.lagHp, p.hp);
    if (this.hpText.text !== String(p.hp)) this.hpText.setText(String(p.hp));
    const tlW = PAD + 66 + 3 + Math.max(this.hpText.width, 18) + PAD;
    const tlH = PAD + 8 + 3 + SMALL + 1 + HINT_H + PAD;
    this.panelAt('tl', INSET, INSET, tlW, tlH);
    healthBar(g, INSET + PAD, INSET + PAD, p.hp, P.player.maxHp, this.lagHp);
    place(this.hpText, INSET + PAD + 66 + 3, INSET + PAD);
    const rowY = INSET + PAD + 11;
    const dodging = p.action === 'dodge';
    const dodgeCd = dodging ? 1 : P.dodge.cooldown > 0 ? p.dodgeCooldown / P.dodge.cooldown : 0;
    const dodgeReady = this.ready(3, dodging ? 1 : p.dodgeCooldown);
    let x = INSET + PAD;
    abilitySlot(g, x, rowY, { icon: 'dodge', cooldown: dodgeCd, locked: false, ready: dodgeReady, small: true, active: dodging });
    this.dodgeKey.place(x + SMALL / 2, rowY + SMALL + 1, 0.5);
    x += SMALL + 3 + Math.round(this.dodgeKey.width / 2) + 6;
    // Consumable slots: icon, count and key hint; empty slots are sunken.
    p.items.forEach((item, i) => {
      const empty = item.count === 0;
      const healing = p.healLeft > 0 && item.id === 'ration';
      abilitySlot(g, x, rowY, {
        icon: ITEM_ICONS[item.id] ?? 'ration',
        cooldown: 0,
        locked: false,
        ready: healing,
        small: true,
        empty,
      });
      const count = this.itemCounts[i];
      if (count) {
        const t = empty ? '' : String(item.count);
        if (count.text !== t) count.setText(t);
        if (t) {
          place(count, x + SMALL - 1, rowY + SMALL - 7, 1);
          g.fillStyle(Palette.uiOutline, 1).fillRect(count.x - 1, count.y - 1, count.width + 2, 9);
          count.setText(t);
        }
      }
      this.itemKeys[i]?.place(x + SMALL / 2, rowY + SMALL + 1, 0.5);
      x += SMALL + SLOT_GAP + 2;
    });

    // --- Top right: room counter ----------------------------------------
    const roomText = `ROOM ${s.roomIndex + 1}/${P.run.rooms.length}`;
    if (this.room.text !== roomText) this.room.setText(roomText);
    g = this.g.tr;
    const trW = PAD + this.room.width + PAD;
    this.panelAt('tr', W - INSET - trW, INSET, trW, PAD + 8 + PAD);
    place(this.room, W - INSET - trW + PAD, INSET + PAD);

    // --- Bottom right: Sparkglass ---------------------------------------
    const sparkText = String(s.sparkglass);
    if (this.spark.text !== sparkText) this.spark.setText(sparkText);
    const brW = PAD + 10 + 3 + Math.max(this.spark.width, 8) + PAD;
    const brH = PAD + 10 + PAD;
    const brX = W - INSET - brW;
    const brY = H - INSET - brH;
    g = this.g.br;
    this.panelAt('br', brX, brY, brW, brH);
    icon(g, 'spark', brX + PAD, brY + PAD, 10, Palette.spark);
    place(this.spark, brX + PAD + 13, brY + PAD + 1);

    // --- Bottom left: weapon --------------------------------------------
    const abilities = P.weapon.abilities;
    const blW = PAD + SLOT * 3 + SLOT_GAP * 2 + 6 + abilities.length * SLOT + (abilities.length - 1) * SLOT_GAP + PAD;
    const blH = PAD + 10 + SLOT + 1 + HINT_H + PAD;
    const blX = INSET;
    const blY = H - INSET - blH;
    g = this.g.bl;
    this.panelAt('bl', blX, blY, blW, blH);
    place(this.weaponName, blX + PAD, blY + PAD);
    tierPips(g, blX + blW - PAD - 18, blY + PAD + 2, 1);
    const wy = blY + PAD + 10;
    x = blX + PAD;

    // Weapon slot.
    abilitySlot(g, x, wy, { icon: 'hookblade', cooldown: 0, locked: false, ready: false });
    x += SLOT + SLOT_GAP;

    // Light: combo pips (filled = hits done in this chain).
    this.slotFrame(g, x, wy, p.action === 'light');
    const n = P.weapon.light.length;
    const done = p.action === 'light' ? p.comboStep + 1 : p.comboTimer > 0 ? p.nextCombo : p.haulCombo > 0 ? n - 1 : 0;
    icon(g, 'slash', x + 2, wy + 1, 12, p.action === 'light' ? Palette.uiFocus : Palette.uiInk);
    g.fillStyle(Palette.uiOutline, 1).fillRect(x + 3, wy + 13, 14, 4);
    for (let i = 0; i < n; i++) g.fillStyle(i < done ? Palette.spark : Palette.uiBevel, 1).fillRect(x + 4 + i * 4, wy + 14, 3, 2);
    this.keys[0]?.place(x + SLOT / 2, wy + SLOT + 1, 0.5);
    x += SLOT + SLOT_GAP;

    // Heavy (the Hook-thrust): charge meter, 3 stages across the charge window; all bright at full charge.
    const charging = p.action === 'charge';
    this.slotFrame(g, x, wy, charging || p.action === 'heavy');
    const stage = charging ? chargeStage(p.charge, P.weapon.heavy) : 0;
    icon(g, 'thrust', x + 2, wy + 1, 12, charging ? Palette.uiFocus : Palette.uiInk);
    g.fillStyle(Palette.uiOutline, 1).fillRect(x + 3, wy + 13, 14, 4);
    for (let i = 0; i < 3; i++) {
      const on = i < stage;
      g.fillStyle(on ? (stage === 3 ? Palette.healthFill : Palette.spark) : Palette.uiBevel, 1).fillRect(x + 4 + i * 4, wy + 14, 3, 2);
    }
    this.keys[1]?.place(x + SLOT / 2, wy + SLOT + 1, 0.5);
    x += SLOT + 6;

    // Ability slots: own cooldown each, sweep + whole seconds; locked slots show a lock.
    abilities.forEach((a, i) => {
      const cd = p.cooldowns[i] ?? 0;
      const frac = a.cooldown > 0 ? cd / a.cooldown : 0;
      const using = p.action === 'ability' && p.abilitySlot === i;
      abilitySlot(g, x, wy, {
        icon: ABILITY_ICONS[a.id] ?? 'haul',
        cooldown: frac,
        locked: a.locked,
        ready: !a.locked && this.ready(i, cd),
        active: using,
      });
      const secs = this.secs[i];
      if (secs) {
        const t = !a.locked && cd > 0 ? String(Math.ceil(cd / TICK_HZ)) : '';
        if (secs.text !== t) secs.setText(t);
        if (t) {
          place(secs, x + SLOT / 2, wy + SLOT / 2 - 3, 0.5);
          g.fillStyle(Palette.uiOutline, 1).fillRect(secs.x - 1, secs.y - 1, secs.width + 2, 9);
        }
      }
      this.keys[2 + i]?.place(x + SLOT / 2, wy + SLOT + 1, 0.5);
      x += SLOT + SLOT_GAP;
    });

    this.fade(bodies, dtMs);
  }

  /** The frame of a non-ability weapon slot (light, heavy). */
  private slotFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean): void {
    g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, SLOT, SLOT);
    g.fillStyle(lit ? Palette.uiFocus : Palette.uiBevel, 1).fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
    g.fillStyle(Palette.uiPanel, 1).fillRect(x + 2, y + 2, SLOT - 4, SLOT - 4);
  }
}
