import type Phaser from 'phaser';
import { TICK_HZ, type Run } from '@iot/sim';
import { KEY_HINTS } from '../game/controls.js';
import { Palette } from '../palette.js';
import { label, place } from './text.js';
import { abilitySlot, healthBar, icon, panel, tierPips, type IconKind } from './ui.js';

const W = 480;
const H = 270;
/** HUD inset from the screen edge and panel padding (game px). */
const INSET = 8;
const PAD = 4;
const SLOT = 20;
const SLOT_GAP = 4;
const READY_FLASH_MS = 200;

const ABILITY_ICONS: Record<string, IconKind> = { lunge: 'lunge', sweep: 'sweep' };

/**
 * Screen-space HUD at the four corners (the center of the screen stays clear
 * for the fight):
 * - top left: HP and dodge,
 * - bottom left: the weapon (light combo, heavy charge, 3 ability slots),
 * - top right: room counter,
 * - bottom right: Sparkglass.
 * Party portraits only show in a party, so never in solo.
 */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly dodgeKey: Phaser.GameObjects.Text;
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

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, run: Run, weaponName: string) {
    this.g = scene.add.graphics();
    this.hpText = label(scene, 0, 0, '100');
    this.dodgeKey = label(scene, 0, 0, KEY_HINTS.dodge, Palette.uiInkMuted);
    this.room = label(scene, 0, 0, 'ROOM 1/3');
    this.spark = label(scene, 0, 0, '0');
    this.weaponName = label(scene, 0, 0, weaponName.toUpperCase());
    const abilities = run.params.weapon.abilities;
    this.keys = [
      label(scene, 0, 0, KEY_HINTS.light, Palette.uiInkMuted),
      label(scene, 0, 0, KEY_HINTS.heavy, Palette.uiInkMuted),
      ...abilities.map((a, i) => label(scene, 0, 0, a.locked ? '' : (KEY_HINTS.abilities[i] ?? ''), Palette.uiInkMuted)),
    ];
    this.secs = abilities.map(() => label(scene, 0, 0, ''));
    layer.add([this.g, this.hpText, this.dodgeKey, this.room, this.spark, this.weaponName, ...this.keys, ...this.secs]);
  }

  /** Lights a slot's frame briefly when its cooldown comes back. */
  private ready(i: number, cooldown: number): boolean {
    if (cooldown === 0 && (this.prevCooldown[i] ?? 0) > 0) this.readyUntil[i] = this.now + READY_FLASH_MS;
    this.prevCooldown[i] = cooldown;
    return (this.readyUntil[i] ?? 0) > this.now;
  }

  draw(run: Run, dtMs: number): void {
    this.now += dtMs;
    const s = run.state;
    const P = run.params;
    const p = s.player;
    const g = this.g;
    g.clear();

    // --- Top left: HP + dodge -------------------------------------------
    if (this.lagHp < 0) this.lagHp = p.hp;
    // The recent loss drains once hitstop is over.
    if (p.hitstop === 0) this.lagHp = Math.max(p.hp, this.lagHp - (dtMs / 1000) * 40);
    this.lagHp = Math.max(this.lagHp, p.hp);
    if (this.hpText.text !== String(p.hp)) this.hpText.setText(String(p.hp));
    const tlW = PAD + 66 + 3 + Math.max(this.hpText.width, 18) + PAD;
    const tlH = PAD + 8 + 3 + 14 + PAD;
    panel(g, INSET, INSET, tlW, tlH, { plain: true });
    healthBar(g, INSET + PAD, INSET + PAD, p.hp, P.player.maxHp, this.lagHp);
    place(this.hpText, INSET + PAD + 66 + 3, INSET + PAD);
    const dodging = p.action === 'dodge';
    const dodgeCd = dodging ? 1 : P.dodge.cooldown > 0 ? p.dodgeCooldown / P.dodge.cooldown : 0;
    const dodgeReady = this.ready(3, dodging ? 1 : p.dodgeCooldown);
    abilitySlot(g, INSET + PAD, INSET + PAD + 11, { icon: 'dodge', cooldown: dodgeCd, locked: false, ready: dodgeReady, small: true, active: dodging });
    place(this.dodgeKey, INSET + PAD + 14 + 3, INSET + PAD + 11 + 3);

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
    const rowY = blY + PAD + 10;
    let x = blX + PAD;

    // Weapon slot.
    abilitySlot(g, x, rowY, { icon: 'hookblade', cooldown: 0, locked: false, ready: false });
    x += SLOT + SLOT_GAP;

    // Light: combo pips (filled = hits done in this chain).
    this.slotFrame(g, x, rowY, p.action === 'light');
    const n = P.weapon.light.length;
    const done = p.action === 'light' ? p.comboStep + 1 : p.comboTimer > 0 ? p.nextCombo : 0;
    icon(g, 'slash', x + 2, rowY + 1, 12, p.action === 'light' ? Palette.uiFocus : Palette.uiInk);
    g.fillStyle(Palette.uiOutline, 1).fillRect(x + 3, rowY + 13, 14, 4);
    for (let i = 0; i < n; i++) g.fillStyle(i < done ? Palette.spark : Palette.uiBevel, 1).fillRect(x + 4 + i * 4, rowY + 14, 3, 2);
    place(this.keys[0] ?? this.weaponName, x + SLOT / 2, rowY + SLOT + 1, 0.5);
    x += SLOT + SLOT_GAP;

    // Heavy: charge meter (3 stages; all bright at full charge).
    const charging = p.action === 'charge';
    this.slotFrame(g, x, rowY, charging || p.action === 'heavy');
    const stage = charging ? Math.min(3, Math.floor((p.charge * 3) / P.weapon.heavy.fullCharge)) : 0;
    g.fillStyle(charging ? Palette.uiFocus : Palette.uiInk, 1);
    g.fillRect(x + 6, rowY + 3, 2, 8).fillRect(x + 8, rowY + 4, 2, 6).fillRect(x + 10, rowY + 5, 2, 4).fillRect(x + 12, rowY + 6, 2, 2);
    g.fillStyle(Palette.uiOutline, 1).fillRect(x + 3, rowY + 13, 14, 4);
    for (let i = 0; i < 3; i++) {
      const on = i < stage;
      g.fillStyle(on ? (stage === 3 ? Palette.healthFill : Palette.spark) : Palette.uiBevel, 1).fillRect(x + 4 + i * 4, rowY + 14, 3, 2);
    }
    place(this.keys[1] ?? this.weaponName, x + SLOT / 2, rowY + SLOT + 1, 0.5);
    x += SLOT + 6;

    // Ability slots: own cooldown each, sweep + whole seconds; locked slots show a lock.
    abilities.forEach((a, i) => {
      const cd = p.cooldowns[i] ?? 0;
      const frac = a.cooldown > 0 ? cd / a.cooldown : 0;
      const using = p.action === 'ability' && p.abilitySlot === i;
      abilitySlot(g, x, rowY, {
        icon: ABILITY_ICONS[a.id] ?? 'lunge',
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
          place(secs, x + SLOT / 2, rowY + SLOT / 2 - 3, 0.5);
          g.fillStyle(Palette.uiOutline, 1).fillRect(secs.x - 1, secs.y - 1, secs.width + 2, 9);
        }
      }
      const key = this.keys[2 + i];
      if (key) place(key, x + SLOT / 2, rowY + SLOT + 1, 0.5);
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
