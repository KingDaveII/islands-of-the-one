/** The holding module: the active action, its settle, the baskets' take-all and the skill XP (docs/design/holding.md). */
export {
  createHolding,
  fitsInStore,
  inRange,
  offlineAllowed,
  ONLINE_GRACE_MS,
  settleMath,
  settleRef,
  type Holding,
  type HoldingError,
  type HoldingResult,
  type Settlement,
} from './holding.js';
export { moveAway, parseAwayArgs, type AwayArgs } from './away.js';
