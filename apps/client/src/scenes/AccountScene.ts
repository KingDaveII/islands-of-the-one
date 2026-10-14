import Phaser from 'phaser';
import { PASSWORD_RULES, USERNAME_RULES, validatePassword, validateUsername } from '@iot/shared';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { backspace, typedText, typeInto, type FieldKind } from '../game/textInput.js';
import { Palette } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { FIELD_H, TextField } from '../render/field.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { body, label, place, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';
import { VIEW_H, VIEW_W } from './GameScene.js';
import { sceneFor } from './GateScene.js';

type Mode = 'login' | 'register';
type Row = 'mode' | 'username' | 'password' | 'submit';
const ROWS: Row[] = ['mode', 'username', 'password', 'submit'];

const PANEL = { x: 110, y: 46, w: 260, h: 184 };
const INNER_X = PANEL.x + 14;
const INNER_W = PANEL.w - 28;
const TAB_Y = PANEL.y + 12;
const USER_Y = PANEL.y + 34;
const PASS_Y = USER_Y + 30;
const RULES_Y = PASS_Y + FIELD_H + 6;
const ERROR_Y = RULES_Y + 24;
const SUBMIT_Y = PANEL.y + PANEL.h - 24;

/**
 * Log in or create an account (docs/design/accounts.md): a username and a
 * password field (masked), Enter submits, the server's refusal shows in body
 * text. Keyboard: type into the focused field, Tab or the arrows move
 * between rows, left/right on the top row switch between logging in and
 * creating an account. Pad: the D-pad moves and switches, Cross confirms
 * (typing needs the keyboard). Placeholder layout until UI-05.
 */
export class AccountScene extends Phaser.Scene {
  private mode: Mode = 'login';
  private row: Row = 'username';
  private busy = false;
  private fields!: Record<'username' | 'password', TextField>;
  private tabs!: Record<Mode, Text>;
  private tabLine!: Phaser.GameObjects.Graphics;
  private rules!: Text;
  private error!: Text;
  private submit!: Button;
  private submits: Record<Mode, Button> | null = null;
  private marker!: Text;
  private hint!: HintRow;
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';

  constructor() {
    super('account');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.mode = 'login';
    this.row = 'username';
    this.busy = false;
    this.pad = padEdgeState();
    place(label(this, 0, 0, 'ISLANDS OF THE ONE', Palette.uiInk, 24), VIEW_W / 2, 10, 0.5);

    const g = this.add.graphics();
    panel(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h);

    this.tabs = {
      login: label(this, INNER_X, TAB_Y, 'LOG IN'),
      register: label(this, INNER_X + 70, TAB_Y, 'CREATE ACCOUNT'),
    };
    this.tabLine = this.add.graphics();
    for (const mode of ['login', 'register'] as const) {
      const t = this.tabs[mode];
      this.add
        .zone(t.x - 2, t.y - 2, t.width + 4, 12)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.setMode(mode);
        });
    }

    label(this, INNER_X, USER_Y - 10, 'USERNAME', Palette.uiInkMuted);
    label(this, INNER_X, PASS_Y - 10, 'PASSWORD', Palette.uiInkMuted);
    this.fields = {
      username: new TextField(this, INNER_X, USER_Y, INNER_W),
      password: new TextField(this, INNER_X, PASS_Y, INNER_W, { masked: true }),
    };
    for (const row of ['username', 'password'] as const) {
      this.fields[row].zone.on('pointerdown', () => {
        this.row = row;
      });
    }
    this.rules = body(
      this,
      INNER_X,
      RULES_Y,
      `Username: ${USERNAME_RULES} Password: ${PASSWORD_RULES}`,
      Palette.uiInkMuted,
      INNER_W,
    );
    this.error = body(this, INNER_X, ERROR_Y, '', Palette.uiError, INNER_W);

    // One button per mode, the other hidden (their widths differ).
    const make = (text: string): Button =>
      button(this, 0, SUBMIT_Y, text, true, () => {
        this.send();
      });
    this.submits = { login: make('LOG IN'), register: make('CREATE ACCOUNT') };
    for (const b of Object.values(this.submits))
      b.container.setX(Math.round(PANEL.x + PANEL.w - 14 - b.width));
    this.submit = this.submits.login;
    this.marker = label(this, 0, 0, '>', Palette.uiFocus);

    this.hint = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted });
    this.family = padFamilyNow();
    this.setMode('login');

    const onKey = (e: KeyboardEvent): void => {
      this.onKey(e);
    };
    const onPaste = (e: ClipboardEvent): void => {
      const field = this.focusedField();
      const text = e.clipboardData?.getData('text') ?? '';
      if (!field || !text) return;
      e.preventDefault();
      field.value = typeInto(this.row as FieldKind, field.value, text);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    });
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.error.setText('');
    this.rules.setVisible(mode === 'register');
    for (const m of ['login', 'register'] as const) {
      this.tabs[m].setTint(m === mode ? Palette.uiInk : Palette.uiInkMuted);
      this.submits?.[m].container.setVisible(m === mode);
    }
    if (this.submits) this.submit = this.submits[mode];
    const t = this.tabs[mode];
    this.tabLine.clear();
    this.tabLine.fillStyle(Palette.uiFocus, 1).fillRect(t.x, t.y + 10, Math.round(t.width), 1);
  }

  private focusedField(): TextField | null {
    return this.row === 'username' || this.row === 'password' ? this.fields[this.row] : null;
  }

  private step(delta: number): void {
    const i = ROWS.indexOf(this.row);
    this.row = ROWS[(i + delta + ROWS.length) % ROWS.length] ?? 'username';
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.row === 'mode') this.setMode(this.mode === 'login' ? 'register' : 'login');
      else this.send();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this.step(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.step(e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (this.row === 'mode' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      this.setMode(this.mode === 'login' ? 'register' : 'login');
      return;
    }
    const field = this.focusedField();
    if (!field) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      field.value = backspace(field.value);
      return;
    }
    const text = typedText(e);
    if (text === null) return;
    // Keep typed characters away from browser shortcuts (Firefox quick find on ' and /).
    e.preventDefault();
    field.value = typeInto(this.row as FieldKind, field.value, text);
  }

  private send(): void {
    if (this.busy) return;
    const username = this.fields.username.value;
    const password = this.fields.password.value;
    if (this.mode === 'register') {
      // The same rules the server applies, checked first so the answer is instant.
      const u = validateUsername(username);
      if (!u.ok) {
        this.error.setText(u.message);
        this.row = 'username';
        return;
      }
      const p = validatePassword(password);
      if (!p.ok) {
        this.error.setText(`Password: ${p.message}`);
        this.row = 'password';
        return;
      }
    }
    this.busy = true;
    this.error.setText('...');
    const body = { username, password };
    const pending = this.mode === 'login' ? api.login(body) : api.register(body);
    void pending.then((res) => {
      this.busy = false;
      if (!res.ok) {
        this.error.setText(res.message);
        return;
      }
      accountStore.current = res.value;
      this.scene.start(sceneFor(res.value));
    });
  }

  private hintItems(): HintItem[] {
    if (deviceStore.get() === 'gamepad') {
      const menu = (index: number): HintItem[] => glyphs([menuGlyph(index)], this.family);
      return [
        ...menu(MENU_BUTTONS.up),
        ...menu(MENU_BUTTONS.down),
        word('move  ·'),
        ...menu(MENU_BUTTONS.left),
        ...menu(MENU_BUTTONS.right),
        word('log in / create  ·'),
        ...menu(MENU_BUTTONS.confirm[0]),
        word('confirm  ·  type with the keyboard'),
      ];
    }
    return [
      ...glyphs(['Enter'], 'keyboard'),
      word('submit  ·'),
      ...glyphs(['Tab'], 'keyboard'),
      word('next field  ·'),
      ...glyphs(['Left', 'Right'], 'keyboard'),
      word('on the top row: log in / create'),
    ];
  }

  override update(): void {
    const family = padFamilyNow();
    if (family !== this.family) this.family = family;
    this.hint.setItems(this.hintItems()).place(VIEW_W / 2, VIEW_H - 18, 0.5);
    menuCursor(this);

    this.fields.username.focused = this.row === 'username';
    this.fields.password.focused = this.row === 'password';
    this.fields.username.update();
    this.fields.password.update();
    this.submit.setFocused(this.row === 'submit');
    const markerY = {
      mode: TAB_Y,
      username: USER_Y + 4,
      password: PASS_Y + 4,
      submit: SUBMIT_Y + 4,
    }[this.row];
    this.marker.setPosition(PANEL.x + 5, markerY);

    const edges = padEdges(this.pad);
    if (edges.includes(MENU_BUTTONS.up)) this.step(-1);
    else if (edges.includes(MENU_BUTTONS.down)) this.step(1);
    else if (
      this.row === 'mode' &&
      (edges.includes(MENU_BUTTONS.left) || edges.includes(MENU_BUTTONS.right))
    )
      this.setMode(this.mode === 'login' ? 'register' : 'login');
    else if (MENU_BUTTONS.confirm.some((b) => edges.includes(b))) {
      if (this.row === 'mode') this.setMode(this.mode === 'login' ? 'register' : 'login');
      else this.send();
    }
  }
}
