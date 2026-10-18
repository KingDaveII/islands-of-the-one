import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { forgetWord, grantWord, parseWordsArgs, WORDS_USAGE } from './words.js';

/**
 * pnpm --filter @iot/server words:grant <username> <wordId>
 * pnpm --filter @iot/server words:forget <username> <wordId>
 *
 * Teaches a Kindled a word tile of words.json, or takes it back, so a
 * playtest can learn ישן, which nothing gives in M2. Uses DATABASE_URL (or
 * PGLITE_DIR), the same database as the dev server; never an in-memory
 * PGlite the server holds. Prints the words known after, or why it was
 * refused, with a non-zero exit code. Nothing in the game calls it.
 */
async function main(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv;
  if (verb !== 'grant' && verb !== 'forget') {
    console.error(WORDS_USAGE);
    return 2;
  }
  const parsed = parseWordsArgs(rest);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 2;
  }
  const config = loadConfig();
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    const result = verb === 'grant' ? await grantWord(handle.db, parsed.args) : await forgetWord(handle.db, parsed.args);
    if (!result.ok) {
      console.error(result.message);
      return 1;
    }
    const did = verb === 'grant' ? (result.changed ? 'learned' : 'already knew') : result.changed ? 'forgot' : 'did not know';
    console.log(`${parsed.args.username}: ${did} ${parsed.args.wordId}; knows ${result.known.length ? result.known.join(', ') : 'no words'}`);
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
