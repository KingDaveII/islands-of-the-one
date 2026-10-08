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

export const roomTemplates = rooms.templates;
export const TILE_SIZE_PX = rooms.tileSize;
