import controllerGlyphs from '../assets/controller-glyphs.json' with { type: 'json' };
import fieldGround from '../assets/field-ground.json' with { type: 'json' };
import hookbladeFx from '../assets/hookblade-fx.json' with { type: 'json' };
import itemIcons from '../assets/item-icons.json' with { type: 'json' };
import toastGlyphs from '../assets/toast-glyphs.json' with { type: 'json' };

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

/** An item-icon sheet: one 16 px cell per item, named by its id in data/items.json, drawn in its own colours. */
export interface ItemIconsSheet extends CellSheet {
  meta?: Partial<EngineSheetMeta>;
}

/** The M2 item icons (ART, #77): every item in items.json has a cell named by its id. */
export const itemIconsSheet: ItemIconsSheet = itemIcons;

/** The toast glyph sheet (ART, #109; M2 Task 7): one 12 px cell per toast kind (`skill-<skill>` per skill), drawn in colour, untinted. */
export interface ToastGlyphsSheet extends CellSheet {
  meta?: Partial<EngineSheetMeta>;
}

export const toastGlyphsSheet: ToastGlyphsSheet = toastGlyphs;
/** A toast glyph's size (UI px): drawn at 1 UI px per px, vertically centred on its line. */
export const TOAST_GLYPH_PX = 12;

/** The field ground's cells (ART, #123): a named field before SOW, once sown, and faded (sown or not). */
export const FIELD_GROUND_CELLS = ['unsown', 'sown', 'faded'] as const;
export type FieldGroundCell = (typeof FIELD_GROUND_CELLS)[number];

/**
 * The field's ground (ART, #123; M2 Task 5's placeholder dither retired): one
 * seamless `cell`-px pattern per state, drawn untinted, tiled over a named
 * plot's rect less `inset` (world px, at 1 world px per sheet px) from that
 * inner rect's top-left corner. The inset is the headland of plain holding
 * ground that keeps the seal ring, its letters and the divider on pale earth.
 */
export interface FieldGroundSheet extends CellSheet {
  cell: number;
  meta?: Partial<EngineSheetMeta>;
  inset: { top: number; right: number; bottom: number; left: number };
}

export const fieldGroundSheet: FieldGroundSheet = fieldGround;

/** The cell called `name`, or undefined. */
export function sheetCellNamed(sheet: CellSheet, name: string): SheetCell | undefined {
  return sheet.cells.find((c) => c.name === name);
}
