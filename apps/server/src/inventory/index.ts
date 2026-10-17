/** The inventory module: the only code that touches the item tables (docs/design/inventory.md). */
export {
  createInventory,
  InventoryInputError,
  MAX_REF_LENGTH,
  placeOrder,
  type ApplyError,
  type ApplyOptions,
  type ApplyResult,
  type Holding,
  type Inventory,
  type InventoryOptions,
  type ItemChange,
  type LedgerEntry,
} from './inventory.js';
export { grantByUsername, parseGrantArgs, type GrantArgs, type GrantResult } from './grant.js';
export { canReachStore, moveItems, type MoveArgs, type MoveResult } from './move.js';
