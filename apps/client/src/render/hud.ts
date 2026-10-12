import type Phaser from 'phaser';
import { TICK_HZ, type Run } from '@iot/sim';
import type { Controls } from '../game/controls.js';
import { Palette } from '../palette.js';
import { chargeStage } from './charge.js';
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
const READY_FLASH_MS = 200;

const ABILITY_ICONS: Record<string, IconKind> = { haul: 'haul', 'the-catch': 'catch', 'turning-blade': 'sweep' };
const ITEM_ICONS: Record<string, IconKind> = { ration: 'ration' };

/**
 * Screen-space HUD at the four corners (the center of the screen stays clear
 * for the fight):
 * - top left: HP, the dodge slot and the two consumable slots,
 * - bottom left: the weapon (light combo, heavy charge, 3 ability slots),
 * - top right: room counter,
 * - bottom right: Sparkglass.
 * Key hints are text labels from the active control preset (gamepad) or the
 * keyboard, until a glyph sheet exists. Party portraits only show in a party.
 */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly dodgeKey: Phaser.GameObjects.Text;
  private readonly itemKeys: Phaser.GameObjects.Text[];
  private readonly itemCounts: Phaser.GameObjects.Text[];
  private readonly room: Phaser.GameObjects.Text;
  private readonly spark: Phaser.GameObjects.Text;
  private readonly weaponName: Phaser.GameObjects.Text;
  private readonly keys: Phaser.GameObjects.Text[];
  private readonly secs: Phaser.GameObjects.Text[];
  private lagHp = -1;
  private readyUntil: number[] = [0, 0, 0, 0];
  private prevCooldown: number[] = [0, 0, 0, 0];
  private now = 0;
  readonly partyPortraits = false;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    run: Run,
    weaponName: string,
    private readonly controls: Controls,
  ) {
    this.g = scene.add.graphics();
    this.hpText = label(scene, 0, 0, '100');
    this.dodgeKey = label(scene, 0, 0, '', Palette.uiInkMuted);
    this.room = label(scene, 0, 0, 'ROOM 1/3');
    this.spark = label(scene, 0, 0, '0');
    this.weaponName = label(scene, 0, 0, weaponName.toUpperCase());
    const abilities = run.params.weapon.abilities;
    this.keys = [
      label(scene, 0, 0, '', Palette.uiInkMuted),
      label(scene, 0, 0, '', Palette.uiInkMuted),
      ...abilities.map(() => label(scene, 0, 0, '', Palette.uiInkMuted)),
    ];
    this.secs = abilities.map(() => label(scene, 0, 0, ''));
    this.itemKeys = run.state.player.items.map(() => label(scene, 0, 0, '', Palette.uiInkMuted));
    this.itemCounts = run.state.player.items.map(() => label(scene, 0, 0, ''));
    layer.add([
      this.g,
      this.hpText,
      this.dodgeKey,
      this.room,
      this.spark,
      this.weaponName,
      ...this.keys,
      ...this.secs,
      ...this.itemKeys,
      ...this.itemCounts,
    ]);
    this.syncHints(run);
  }

  /** Key hints follow the device in use (gamepad preset glyphs or keyboard keys). */
  private syncHints(run: Run): void {
    const h = this.controls.hints();
    const set = (t: Phaser.GameObjects.Text | undefined, v: string): void => {
      if (t && t.text !== v) t.setText(v);
    };
    set(this.dodgeKey, h.dodge);
    set(this.keys[0], h.light);
    set(this.keys[1], h.heavy);
    const abilityHints = [h.ability1, h.ability2, h.ability3];
    run.params.weapon.abilities.forEach((a, i) => {
      set(this.keys[2 + i], a.locked ? '' : (abilityHints[i] ?? ''));
    });
    set(this.itemKeys[0], h.item1);
    set(this.itemKeys[1], h.item2);
  }

  /** Lights a slot's frame briefly when its cooldown comes back. */
  private ready(i: number, cooldown: number): boolean {
    if (cooldown === 0 && (this.prevCooldown[i] ?? 0) > 0) this.readyUntil[i] = this.now + READY_FLASH_MS;
    this.prevCooldown[i] = cooldown;
    return (this.readyUntil[i] ?? 0) > this.now;
  }

  draw(run: Run, dtMs: number): void {
    this.now += dtMs;
    this.syncHints(run);
    const s = run.state;
    const P = run.params;
    const p = s.player;
    const g = this.g;
    g.clear();

    // --- Top left: HP + dodge + consumables ----------------------------
    if (this.lagHp < 0) this.lagHp = p.hp;
    // The recent loss drains once hitstop is over.
    if (p.hitstop === 0) this.lagHp = Math.max(p.hp, this.lagHp - (dtMs / 1000) * 40);
    this.lagHp = Math.max(this.lagHp, p.hp);
    if (this.hpText.text !== String(p.hp)) this.hpText.setText(String(p.hp));
    const tlW = PAD + 66 + 3 + Math.max(this.hpText.width, 18) + PAD;
    const tlH = PAD + 8 + 3 + SMALL + 10 + PAD;
    panel(g, INSET, INSET, tlW, tlH, { plain: true });
    healthBar(g, INSET + PAD, INSET + PAD, p.hp, P.player.maxHp, this.lagHp);
    place(this.hpText, INSET + PAD + 66 + 3, INSET + PAD);
    const rowY = INSET + PAD + 11;
    const dodging = p.action === 'dodge';
    const dodgeCd = dodging ? 1 : P.dodge.cooldown > 0 ? p.dodgeCooldown / P.dodge.cooldown : 0;
    const dodgeReady = this.ready(3, dodging ? 1 : p.dodgeCooldown);
    let x = INSET + PAD;
    abilitySlot(g, x, rowY, { icon: 'dodge', cooldown: dodgeCd, locked: false, ready: dodgeReady, small: true, active: dodging });
    place(this.dodgeKey, x + SMALL / 2, rowY + SMALL + 1, 0.5);
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
      const key = this.itemKeys[i];
      if (key) place(key, x + SMALL / 2, rowY + SMALL + 1, 0.5);
      x += SMALL + SLOT_GAP + 2;
    });

    // --- Top right: room counter ----------------------------------------
    const roomText = `ROOM ${s.roomIndex + 1}/${P.run.rooms.length}`;
    if (this.room.text !== roomText) this.room.setText(roomText);
    const trW = PAD + this.room.width + PAD;
    panel(g, W - INSET - trW, INSET, trW, PAD + 8 + PAD, { plain: true });
    place(this.room, W - INSET - trW + PAD, INSET + PAD);

    // --- Bottom right: Sparkglass ---------------------------------------
    const sparkText = String(s.sparkglass);
    if (this.spark.text !== sparkText) this.spark.setText(sparkText);
    const brW = PAD + 10 + 3 + Math.max(this.spark.width, 8) + PAD;
    const brH = PAD + 10 + PAD;
    const brX = W - INSET - brW;
    const brY = H - INSET - brH;
    panel(g, brX, brY, brW, brH, { plain: true });
    icon(g, 'spark', brX + PAD, brY + PAD, 10, Palette.spark);
    place(this.spark, brX + PAD + 13, brY + PAD + 1);

    // --- Bottom left: weapon --------------------------------------------
    const abilities = P.weapon.abilities;
    const blW = PAD + SLOT * 3 + SLOT_GAP * 2 + 6 + abilities.length * SLOT + (abilities.length - 1) * SLOT_GAP + PAD;
    const blH = PAD + 10 + SLOT + 10 + PAD;
    const blX = INSET;
    const blY = H - INSET - blH;
    panel(g, blX, blY, blW, blH, { plain: true });
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
    place(this.keys[0] ?? this.weaponName, x + SLOT / 2, wy + SLOT + 1, 0.5);
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
    place(this.keys[1] ?? this.weaponName, x + SLOT / 2, wy + SLOT + 1, 0.5);
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
      const key = this.keys[2 + i];
      if (key) place(key, x + SLOT / 2, wy + SLOT + 1, 0.5);
      x += SLOT + SLOT_GAP;
    });
  }

  /** The frame of a non-ability weapon slot (light, heavy). */
  private slotFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, lit: boolean): void {
    g.fillStyle(Palette.uiOutline, 1).fillRect(x, y, SLOT, SLOT);
    g.fillStyle(lit ? Palette.uiFocus : Palette.uiBevel, 1).fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2);
    g.fillStyle(Palette.uiPanel, 1).fillRect(x + 2, y + 2, SLOT - 4, SLOT - 4);
  }
}
