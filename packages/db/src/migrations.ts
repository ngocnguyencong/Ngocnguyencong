import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { MIGRATION_JOURNAL_ENTRIES } from "./migration-journal";
import type * as schema from "./schema";

type MigrationDatabase = Pick<PostgresJsDatabase<typeof schema>, "execute">;

/** Postgres `undefined_table` — the migrations table does not exist yet. */
function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "42P01"
  );
}

/**
 * Journal tags not yet recorded in `drizzle.__drizzle_migrations`. A missing
 * migrations table means nothing was ever applied, so every bundled tag is
 * pending — the same convention `scripts/supabase-doctor.mjs` uses. Any
 * other read error rethrows so callers can distinguish "nothing applied"
 * from "state unreadable" instead of misreporting all-pending.
 */
export async function listPendingMigrations(
  database: MigrationDatabase,
): Promise<readonly string[]> {
  let appliedCreatedAts: readonly unknown[];
  try {
    const rows = await database.execute<{ createdAt: unknown }>(
      sql`select created_at as "createdAt" from drizzle.__drizzle_migrations`,
    );
    appliedCreatedAts = [...rows].map((row) => row.createdAt);
  } catch (error) {
    if (isMissingTableError(error)) {
      return MIGRATION_JOURNAL_ENTRIES.map((entry) => entry.tag);
    }
    throw error;
  }
  const applied = new Set(appliedCreatedAts.map((value) => Number(value)));
  return MIGRATION_JOURNAL_ENTRIES.filter((entry) => !applied.has(entry.when)).map(
    (entry) => entry.tag,
  );
}
