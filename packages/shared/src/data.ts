import controls from '../data/controls.json' with { type: 'json' };
import rooms from '../data/rooms.json' with { type: 'json' };
import tuning from '../data/tuning.json' with { type: 'json' };

/**
 * Game data. All balance and feel numbers live in packages/shared/data —
 * never hardcode them in apps or the sim. The tuning panel (F2) exports JSON
 * in exactly this shape for pasting back into data/tuning.json.
 */
export const defaultTuning = tuning;
export type TuningData = typeof tuning;
/** Presentation-only feel values (shake, particles, camera). Not part of the sim. */
export type JuiceTuning = TuningData['juice'];
/**
 * How the walk and run cycles play by distance: world px per full cycle
 * (sprites.md §8). Presentation only, like `juice`; not part of the sim.
 */
export type AnimTuning = TuningData['anim'];

export const roomTemplates = rooms.templates;
export const TILE_SIZE_PX = rooms.tileSize;

export const controlsData = controls;
export type ControlsData = typeof controls;
/** One gamepad preset: which glyph (standard-mapping button) fires each action, and how aim works. */
export type ControlPreset = ControlsData['presets'][number];
export type ControlAction = keyof ControlsData['keyboard'];
