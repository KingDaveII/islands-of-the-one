import { itemDef, kitLine, RACK_TEXT, type HoldingResponse, type RackView } from '@iot/shared';
import { isWeaponAvailable, type Tuning } from '@iot/sim';
import { displayable } from './drawable.js';

/**
 * The weapon rack on the client (docs/design/holding.md "The weapon rack",
 * M2 Task 8), pure so it is tested in node: the panel's rows from the
 * holding answer's `rack` (one per weapon owned, in the server's roster
 * order, each with LORE's name and card, its kit on one line and its state),
 * the focus through the rows, and the start screen's weapon: the rack's
 * choice from a holding answer, or the roster's first weapon that can fight
 * when no answer can be had. The scene (ui/rackPanel.ts, scenes/StartScene.ts)
 * draws these and sends the choice; the server decides what hangs there.
 */

/** A row's state: the weapon going out next run, one that can be taken, or one the sim can't run yet (greyed). */
export type RackRowState = 'taken' | 'take' | 'not-ready';

export interface RackRow {
  itemId: string;
  name: string;
  /** LORE's card, muted and wrapped. */
  card: string;
  /** The kit in input order: "Arc · Hook-thrust · Haul"; empty for a weapon without one. */
  kit: string;
  state: RackRowState;
  /** The state's text on the right: "Taken", or LORE's not-ready line; null on a row with the TAKE button. */
  stateText: string | null;
}

/** The panel's rows: the weapons owned, in the answer's order (roster order), with their state. */
export function rackRows(rack: RackView): RackRow[] {
  return rack.weapons.map((w) => {
    const def = itemDef(w.itemId);
    const state: RackRowState = w.itemId === rack.chosen ? 'taken' : w.ready ? 'take' : 'not-ready';
    return {
      itemId: w.itemId,
      name: displayable(def?.name ?? w.itemId),
      card: displayable(def?.description ?? ''),
      kit: kitLine(w.itemId),
      state,
      stateText: state === 'taken' ? RACK_TEXT.TAKEN : state === 'not-ready' ? RACK_TEXT.NOT_READY : null,
    };
  });
}

/** Up and down through the rows, wrapping; nothing to focus with no rows. */
export function moveRackFocus(count: number, focus: number, delta: number): number {
  if (count <= 0) return 0;
  return (((focus + delta) % count) + count) % count;
}

/** Whether Cross or Enter on a row does anything: only a row with the TAKE button chooses. */
export function rackPressable(row: RackRow | undefined): boolean {
  return row?.state === 'take';
}

/** What the start screen shows and starts with: the weapon's id and name, and the line under it (null when it didn't come from the rack). */
export interface StartWeapon {
  weapon: string;
  name: string;
  line: string | null;
}

/**
 * The run's weapon on the start screen (GAME DESIGN: the rack decides; START
 * RUN takes the weapon chosen there): `rack.chosen` from a holding answer,
 * with "Taken from your weapon rack." under its name; without an answer
 * (the server is down, or no Kindled) the roster's first weapon that can
 * fight, as before, and the line says nothing.
 */
export function startWeapon(answer: Pick<HoldingResponse, 'rack'> | null, t: Tuning): StartWeapon {
  const chosen = answer?.rack.chosen ?? null;
  if (chosen !== null) return { weapon: chosen, name: weaponName(chosen, t), line: RACK_TEXT.FROM_RACK };
  const fallback = t.weaponRoster.find((w) => isWeaponAvailable(t, w.id))?.id ?? 'hookblade';
  return { weapon: fallback, name: weaponName(fallback, t), line: null };
}

/** A weapon's display name: items.json's, else the tuning's, else its id. */
export function weaponName(weaponId: string, t: Tuning): string {
  return displayable(itemDef(weaponId)?.name ?? t.weapons[weaponId]?.name ?? t.weaponRoster.find((w) => w.id === weaponId)?.name ?? weaponId);
}
