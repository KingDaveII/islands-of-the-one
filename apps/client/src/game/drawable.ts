import { graphemes, isDrawable } from '@iot/shared';

/**
 * Text as the pixel fonts can draw it: a character with no glyph (outside
 * printable ASCII and Latin-1, DRAWABLE_CHARS) shows as ?. New Kindled names
 * are always drawable (the validator refuses the rest); this keeps anything
 * older or unexpected from vanishing on screen.
 */
export function displayable(text: string): string {
  return graphemes(text)
    .map((g) => (isDrawable(g) ? g : '?'))
    .join('');
}
