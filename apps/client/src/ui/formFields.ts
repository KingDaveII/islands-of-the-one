import { css, Palette } from '../palette.js';

/**
 * Typed text (usernames, passwords, Kindled names) goes through real HTML
 * inputs in a real <form> laid over the canvas: the one exception to "all
 * text is BitmapText". That gives phones their on-screen keyboard, password
 * managers a form to save and fill, IME composition for every language, and
 * paste. The canvas still draws each field's panel and focus rim (render/
 * field.ts); the input sits inside it, transparent, in the pixel face (Tiny5)
 * at 8 game px, i.e. 8 × zoom CSS px: whole device pixels, like the canvas.
 */

/** A field's box in game px: the panel's outer box. */
export interface FieldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The text's inset inside the panel, in game px (left/right, and the 8 px line box's top). */
export const FIELD_TEXT_INSET = { x: 6, y: 4 };
/** The text line box, in game px. */
const LINE_H = 8;

export interface CssBox {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
}

/**
 * Where an input goes on the page: its text line inside the field's panel,
 * from the canvas's page box and the zoom (CSS px per game px).
 */
export function inputBox(canvas: { left: number; top: number }, zoom: number, f: FieldBox): CssBox {
  return {
    left: canvas.left + (f.x + FIELD_TEXT_INSET.x) * zoom,
    top: canvas.top + (f.y + FIELD_TEXT_INSET.y) * zoom,
    width: (f.w - 2 * FIELD_TEXT_INSET.x) * zoom,
    height: LINE_H * zoom,
    fontSize: LINE_H * zoom,
  };
}

export interface FieldSpec {
  name: string;
  box: FieldBox;
  type: 'text' | 'password';
  autocomplete: string;
  maxLength: number;
  label: string;
}

export interface DomForm {
  readonly form: HTMLFormElement;
  input(name: string): HTMLInputElement;
  /** Re-place the inputs over the canvas (call every frame: it only touches the DOM when something moved). */
  layout(canvas: HTMLCanvasElement, zoom: number): void;
  /** Submit as a browser would (password managers watch the submit event). */
  submit(): void;
  destroy(): void;
}

/**
 * A form of text inputs over the canvas. `onSubmit` runs on the form's
 * submit event (Enter in a field, or `submit()`); the page never navigates.
 * `onFocus` reports which input took focus (a click or a tap on it).
 */
export function createForm(
  specs: FieldSpec[],
  onSubmit: () => void,
  onFocus: (name: string) => void,
): DomForm {
  const form = document.createElement('form');
  form.className = 'game-form';
  form.noValidate = true;
  form.autocomplete = 'on';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSubmit();
  });

  const inputs = new Map<string, HTMLInputElement>();
  for (const spec of specs) {
    const input = document.createElement('input');
    input.className = 'game-input';
    input.type = spec.type;
    input.name = spec.name;
    input.id = `game-input-${spec.name}`;
    input.autocomplete = spec.autocomplete as AutoFill;
    input.maxLength = spec.maxLength;
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', spec.label);
    input.style.color = css(Palette.uiInk);
    input.style.caretColor = css(Palette.uiFocus);
    input.addEventListener('focus', () => {
      onFocus(spec.name);
    });
    form.append(input);
    inputs.set(spec.name, input);
  }
  // A real submit button (kept off screen, not display: none) so the form submits like any other.
  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'game-form-submit';
  button.tabIndex = -1;
  button.textContent = 'submit';
  form.append(button);
  document.body.append(form);

  let placed = '';
  return {
    form,
    input(name) {
      const input = inputs.get(name);
      if (!input) throw new Error(`no input ${name}`);
      return input;
    },
    layout(canvas, zoom) {
      const rect = canvas.getBoundingClientRect();
      const key = `${rect.left},${rect.top},${zoom}`;
      if (key === placed) return;
      placed = key;
      for (const spec of specs) {
        const box = inputBox(rect, zoom, spec.box);
        const s = (inputs.get(spec.name) as HTMLInputElement).style;
        s.left = `${box.left}px`;
        s.top = `${box.top}px`;
        s.width = `${box.width}px`;
        s.height = `${box.height}px`;
        s.fontSize = `${box.fontSize}px`;
        s.lineHeight = `${box.height}px`;
      }
    },
    submit() {
      form.requestSubmit();
    },
    destroy() {
      form.remove();
    },
  };
}
