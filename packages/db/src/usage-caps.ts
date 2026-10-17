import { and, asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { workspaceUsageCap } from "./schema";
import type * as schema from "./schema";
import { MAX_USAGE_QUOTA } from "./usage-counters";

type UsageCapDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one cap per (workspaceId, key). */
export type UsageCap = typeof workspaceUsageCap.$inferSelect;

/**
 * Workspace-level usage caps backing the Settings → Usage controls. Caps are
 * owner/admin-set hard ceilings layered over plan `usageLimits`: the
 * enforcement seam in the web app resolves `min(plan limit, cap)` as the
 * effective quota, and a cap-bound rejection never falls back to prepaid
 * credits. Unlike `usage_counter` rows, caps persist across periods.
 */
export interface UsageCapRepository {
  /** Every cap row for the workspace, ordered by meter key. */
  list(workspaceId: string): Promise<UsageCap[]>;
  /** The stored cap for one meter key, or `null` when none is set. */
  get(workspaceId: string, key: string): Promise<number | null>;
  /** Inserts or replaces the cap; returns the persisted row. */
  set(workspaceId: string, key: string, cap: number): Promise<UsageCap>;
  /** Removes the cap; no-op when none exists. */
  clear(workspaceId: string, key: string): Promise<void>;
}

export function createDrizzleUsageCapRepository(database: UsageCapDatabase): UsageCapRepository {
  return Object.freeze({
    async list(workspaceId: string): Promise<UsageCap[]> {
      return database
        .select()
        .from(workspaceUsageCap)
        .where(eq(workspaceUsageCap.workspaceId, normalizeWorkspaceId(workspaceId)))
        .orderBy(asc(workspaceUsageCap.key));
    },

    async get(workspaceId: string, key: string): Promise<number | null> {
      const [row] = await database
        .select({ cap: workspaceUsageCap.cap })
        .from(workspaceUsageCap)
        .where(capScope(workspaceId, key))
        .limit(1);
      return row?.cap ?? null;
    },

    async set(workspaceId: string, key: string, cap: number): Promise<UsageCap> {
      const scope = normalizeScope(workspaceId, key);
      const value = normalizeCap(cap);
      const [row] = await database
        .insert(workspaceUsageCap)
        .values({ ...scope, cap: value })
        .onConflictDoUpdate({
          target: [workspaceUsageCap.workspaceId, workspaceUsageCap.key],
          set: { cap: value, updatedAt: new Date() },
        })
        .returning();
      if (row === undefined) {
        throw new Error("The usage cap was not saved.");
      }
      return row;
    },

    async clear(workspaceId: string, key: string): Promise<void> {
      await database.delete(workspaceUsageCap).where(capScope(workspaceId, key));
    },
  });
}

function capScope(workspaceId: string, key: string) {
  const scope = normalizeScope(workspaceId, key);
  return and(
    eq(workspaceUsageCap.workspaceId, scope.workspaceId),
    eq(workspaceUsageCap.key, scope.key),
  );
}

function normalizeScope(workspaceId: string, key: string) {
  return Object.freeze({ key: normalizeKey(key), workspaceId: normalizeWorkspaceId(workspaceId) });
}

function normalizeWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  return workspaceId;
}

function normalizeKey(key: string): string {
  if (typeof key !== "string" || key.trim().length === 0 || key.length > 100) {
    throw new Error("A valid usage counter key is required.");
  }
  return key;
}

function normalizeCap(cap: number): number {
  if (!Number.isInteger(cap) || cap < 0 || cap > MAX_USAGE_QUOTA) {
    throw new Error("A valid usage cap is required.");
  }
  return cap;
}
