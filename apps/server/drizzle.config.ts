import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  // The item tables live in the inventory module, the only code allowed to touch them.
  schema: ['./src/db/schema.ts', './src/inventory/tables.ts'],
  out: './drizzle',
});
