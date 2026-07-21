/**
 * Postgres error classification.
 *
 * Drizzle does not surface driver errors directly — it wraps them in an
 * `Error("Failed query: ...")` and hangs the original pg error off `cause`.
 * Checking only `error.code` therefore misses every constraint violation and
 * lets it escape as an unhandled 500, so these walk the cause chain.
 */

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const MAX_CAUSE_DEPTH = 5;

function hasSqlState(error: unknown, sqlState: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (
      typeof current === "object" &&
      current !== null &&
      "code" in current &&
      (current as { code?: unknown }).code === sqlState
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** SQLSTATE 23505 — e.g. two tenants given the same Retell agent ID. */
export function isUniqueViolation(error: unknown): boolean {
  return hasSqlState(error, UNIQUE_VIOLATION);
}

/** SQLSTATE 23503 — e.g. deleting a tenant that still has calls. */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasSqlState(error, FOREIGN_KEY_VIOLATION);
}
