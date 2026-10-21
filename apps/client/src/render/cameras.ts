import Phaser from 'phaser';
import { deviceSize, fitUi, menuOrigin, type UiFit } from '../game/view.js';

/**
 * The canvas and the cameras on the two pixel grids (game/view.ts). The
 * canvas backing store is the window in device px and its CSS size the
 * window, so nothing is CSS-zoomed; each camera zooms by a whole number of
 * device px per pixel, around its top left (origin 0).
 */

/**
 * The safe area of the window, CSS px: the window less #game's padding, which
 * is the screen's safe-area insets (the notch, the status bar, the home
 * indicator; index.html), 0 off phones.
 */
export function safeWindow(): { w: number; h: number } {
  const el = document.getElementById('game');
  if (!el) return { w: window.innerWidth, h: window.innerHeight };
  const cs = getComputedStyle(el);
  const px = (v: string): number => Number.parseFloat(v) || 0;
  return {
    w: window.innerWidth - px(cs.paddingLeft) - px(cs.paddingRight),
    h: window.innerHeight - px(cs.paddingTop) - px(cs.paddingBottom),
  };
}

/** The window's safe area in device px and the device pixel ratio, now. */
export function deviceNow(): { w: number; h: number; dpr: number } {
  const safe = safeWindow();
  return deviceSize(safe.w, safe.h, window.devicePixelRatio);
}

/**
 * Size the canvas to the window: backing store in device px, CSS size the
 * window (a Phaser zoom of 1 / devicePixelRatio). Call at start and on every
 * `resize`, which also fires when the browser zoom changes the ratio; the
 * scenes re-fit their cameras on the scale manager's resize event.
 */
export function fitCanvasToWindow(game: Phaser.Game): void {
  const d = deviceNow();
  if (game.scale.width !== d.w || game.scale.height !== d.h) game.scale.resize(d.w, d.h);
  if (game.scale.zoom !== 1 / d.dpr) game.scale.setZoom(1 / d.dpr);
}

/** Where a menu's 480 × 270 layout is: the UI grid, and the layout's top left in UI px. */
export interface MenuLayout {
  ui: UiFit;
  origin: { x: number; y: number };
}

/**
 * Put a menu scene's main camera on the UI grid with its 480 × 270 layout
 * centred in the UI area (the margin is the camera's background, the
 * Hollow), and keep it there through resizes. Returns the current layout,
 * for the DOM inputs that have to line up with it (formFields.ts).
 */
export function menuCamera(scene: Phaser.Scene): () => MenuLayout {
  const cam = scene.cameras.main;
  let layout: MenuLayout = { ui: fitUi(scene.scale.width, scene.scale.height), origin: { x: 0, y: 0 } };
  const fit = (): void => {
    const ui = fitUi(scene.scale.width, scene.scale.height);
    const origin = menuOrigin(ui);
    layout = { ui, origin };
    cam.setViewport(0, 0, scene.scale.width, scene.scale.height);
    cam.setOrigin(0, 0).setZoom(ui.zU).setScroll(-origin.x, -origin.y);
  };
  fit();
  scene.scale.on(Phaser.Scale.Events.RESIZE, fit);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, fit);
  });
  return () => layout;
}

/**
 * How the DOM inputs map UI px to CSS px (formFields.ts): CSS px per UI px
 * (`zU` device px over the canvas's device px per CSS px, so zU / dpr) and
 * the layout's offset in UI px.
 */
export function uiToCss(canvas: HTMLCanvasElement, layout: MenuLayout): { zoom: number; x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cssPerDevice = canvas.width > 0 ? rect.width / canvas.width : 1;
  return { zoom: layout.ui.zU * cssPerDevice, x: layout.origin.x, y: layout.origin.y };
}
