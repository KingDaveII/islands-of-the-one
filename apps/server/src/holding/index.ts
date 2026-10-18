/** The holding module: the active action, its settle, the baskets' take-all, the skill XP and the Writ (docs/design/holding.md). */
export {
  createHolding,
  fitsInStore,
  inRange,
  offlineHorizonMs,
  ONLINE_GRACE_MS,
  settleMath,
  settleRef,
  type Holding,
  type HoldingError,
  type HoldingResult,
  type Settlement,
} from './holding.js';
export { moveAway, parseAwayArgs, type AwayArgs } from './away.js';
export { feedChanges, feedPlaces, feedable, lockWrit, writStored, WRIT_ALREADY_NAMED, WRIT_INSUFFICIENT, WRIT_UNNAMED } from './writ.js';
export { parseWritSetArgs, setWrit, WRIT_SET_USAGE, type WritSetArgs, type WritSetResult } from './writ-set.js';
