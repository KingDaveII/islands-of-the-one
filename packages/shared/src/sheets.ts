import controllerGlyphs from '../assets/controller-glyphs.json' with { type: 'json' };
import hookbladeFx from '../assets/hookblade-fx.json' with { type: 'json' };

/**
 * Cell sheets: a 1× PNG plus a JSON contract listing named rectangles
 * (`cells`), the engine sheets delivered by ART DIRECTION alongside the Old
 * Letters (docs/design/sprites.md). Both are white on transparent and tinted
 * at draw time. `packages/shared/test/sheets.test.ts` checks every sheet
 * against its PNG.
 */
export interface SheetCell {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CellSheet {
  /** PNG file name, relative to packages/shared/assets. */
  image: string;
  cells: SheetCell[];
}

/** Controller glyphs (12 px): keyboard caps, mouse buttons, DualSense and Xbox buttons, sticks. */
export const controllerGlyphsSheet = controllerGlyphs;
export type ControllerGlyphsSheet = typeof controllerGlyphs;

/** Hookblade FX: chain links, the Haul hook and the charge spark, with their anims. */
export const hookbladeFxSheet = hookbladeFx;
export type HookbladeFxSheet = typeof hookbladeFx;

/** The cell called `name`, or undefined. */
export function sheetCellNamed(sheet: CellSheet, name: string): SheetCell | undefined {
  return sheet.cells.find((c) => c.name === name);
}
