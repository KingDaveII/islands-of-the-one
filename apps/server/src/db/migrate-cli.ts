import { loadConfig } from '../config.js';
import { createDb } from './client.js';

const config = loadConfig();
const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
try {
  await handle.migrate();
  console.log(`[migrate] ${handle.kind}: migrations applied`);
} finally {
  await handle.close();
}
