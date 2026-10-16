import controllerGlyphs from '../assets/controller-glyphs.json' with { type: 'json' };
import hookbladeFx from '../assets/hookblade-fx.json' with { type: 'json' };

/**
 * Cell sheets: a 1× PNG plus a JSON contract listing named rectangles
 * (`cells`), the engine sheets delivered by ART DIRECTION alongside the Old
 * Letters (docs/design/sprites.md). The controller glyphs are white on
 * transparent and tinted at draw time; hookblade-fx says which it is in its
 * `meta` (`engineSheetMeta`). `packages/shared/test/sheets.test.ts` checks
 * every sheet against its PNG.
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

/**
 * An engine sheet's `meta` (sprites.md "Engine sheets"): its contract version,
 * world px per sheet px, and whether the engine tints its shapes at draw time
 * (`true`: white shapes, tinted, with a rim of offset copies) or draws the
 * frames in their own colours (`false`: ART draws the colours and outline in).
 * Every number in the sheet (cells, origins, spacings) is in sheet px.
 */
export interface EngineSheetMeta {
  version: string;
  pixelScale: number;
  tinted: boolean;
}

/** A sheet without `meta` is M1's: version "1", drawn at the legacy 2×, tinted. */
export const ENGINE_SHEET_DEFAULTS: EngineSheetMeta = { version: '1', pixelScale: 2, tinted: true };

/** An engine sheet's meta with its defaults filled in. */
export function engineSheetMeta(sheet: { meta?: Partial<EngineSheetMeta> }): EngineSheetMeta {
  return { ...ENGINE_SHEET_DEFAULTS, ...sheet.meta };
}

/** The hookblade-fx contract: its cells, the charge spark's frames, the chain and the hook (sheet px). */
export interface HookbladeFxSheet extends CellSheet {
  meta?: Partial<EngineSheetMeta>;
  anims: { charge_spark: { frames: string[]; fps: number; loop: boolean; note?: string } };
  chain: { link: string; taut: string; spacing: number; note?: string };
  hook: { flight: string; set: string; origin: number[]; note?: string };
}

/** Hookblade FX: chain links, the Haul hook and the charge spark, with their anims. */
export const hookbladeFxSheet: HookbladeFxSheet = hookbladeFx;

/** The cell called `name`, or undefined. */
export function sheetCellNamed(sheet: CellSheet, name: string): SheetCell | undefined {
  return sheet.cells.find((c) => c.name === name);
}
