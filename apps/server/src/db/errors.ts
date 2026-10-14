/** A Postgres error's SQLSTATE and constraint name, through Drizzle's error wrapping (`cause`). */
export function pgError(
  err: unknown,
): { code: string; constraint: string | undefined } | undefined {
  let e: unknown = err;
  for (let depth = 0; depth < 5 && typeof e === 'object' && e !== null; depth++) {
    const { code, constraint } = e as { code?: unknown; constraint?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code))
      return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = '23505';
export const FOREIGN_KEY_VIOLATION = '23503';

/** Postgres unique_violation (optionally of one constraint). */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = pgError(err);
  return (
    pg?.code === UNIQUE_VIOLATION && (constraint === undefined || pg.constraint === constraint)
  );
}
