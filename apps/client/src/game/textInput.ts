import {
  creationData,
  glyphOf,
  graphemes,
  PASSWORD_MAX,
  USERNAME_MAX,
  type BitmapFont,
} from '@iot/shared';

/**
 * Keyboard text entry for the account and creation screens (pure, so it is
 * tested without a browser). Fields read DOM key events: what a key types,
 * Backspace, and pasted text, filtered per field and capped at the rules'
 * maximum. The server validates again; this only keeps the field sane.
 */
export type FieldKind = 'username' | 'password' | 'name';

const MAX: Record<FieldKind, number> = {
  username: USERNAME_MAX,
  password: PASSWORD_MAX,
  name: creationData.name.maxGraphemes,
};

/** Characters a field takes: a-z, digits, _ and - for usernames; anything but control characters otherwise. */
function accepts(kind: FieldKind, ch: string): boolean {
  if (kind === 'username') return /^[A-Za-z0-9_-]$/.test(ch);
  return !/[\p{Cc}]/u.test(ch);
}

/** The text a key press types, or null (named keys like Enter, or a shortcut with Ctrl/Cmd). */
export function typedText(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): string | null {
  // AltGr reports Ctrl+Alt on Windows; it types characters.
  if (e.metaKey || (e.ctrlKey && !e.altKey)) return null;
  return Array.from(e.key).length === 1 ? e.key : null;
}

/** `value` with `text` typed or pasted at its end: refused characters dropped, capped at the field's maximum. */
export function typeInto(kind: FieldKind, value: string, text: string): string {
  let out = value;
  for (const cluster of graphemes(text.replace(/[\r\n\t]+/g, ' '))) {
    if (!Array.from(cluster).every((ch) => accepts(kind, ch))) continue;
    if (graphemes(out).length >= MAX[kind]) break;
    out += kind === 'username' ? cluster.toLowerCase() : cluster;
  }
  return out;
}

/** `value` without its last character (grapheme cluster). */
export function backspace(value: string): string {
  const g = graphemes(value);
  return g.slice(0, -1).join('');
}

/** A password shown as one * per character. */
export function masked(value: string): string {
  return '*'.repeat(graphemes(value).length);
}

/**
 * Text as a bitmap font can draw it: a character the font has no glyph for
 * (the pixel fonts are ASCII only, for now) shows as ?, so a name in another
 * script still shows how long it is.
 */
export function displayable(text: string, font: BitmapFont): string {
  return graphemes(text)
    .map((g) => (Array.from(g).every((ch) => glyphOf(font, ch) !== undefined) ? g : '?'))
    .join('');
}
