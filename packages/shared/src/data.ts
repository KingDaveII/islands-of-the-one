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
 * How the walk, run and run_back cycles play by distance: world px per full
 * cycle (sprites.md §8). Presentation only, like `juice`; not part of the sim.
 */
export type AnimTuning = TuningData['anim'];
/** Kesh's toss (M2 Task 4b): how long the thrown thing flies and how high its arc is (world px). Presentation only. */
export type KeshTuning = TuningData['kesh'];
/**
 * The seal scene (M2 Task 5): the ring drawing itself round the plot, each
 * letter appearing, the sigil tracing from its circle to its bar, the ground
 * turning; whole frames, about a second in all. Presentation only.
 */
export type PlotsTuning = TuningData['plots'];

export const roomTemplates = rooms.templates;
/** One hand-made room of rooms.json: its name and its rows of legend characters. */
export type RoomTemplate = (typeof roomTemplates)[number];
export const TILE_SIZE_PX = rooms.tileSize;

export const controlsData = controls;
export type ControlsData = typeof controls;
/** One gamepad preset: which glyph (standard-mapping button) fires each action, and how aim works. */
export type ControlPreset = ControlsData['presets'][number];
export type ControlAction = keyof ControlsData['keyboard'];
