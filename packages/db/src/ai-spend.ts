import { and, eq, gte, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { aiBudgetReservation, aiUsage } from "./schema";
import type * as schema from "./schema";

/**
 * Only `select` is required, so both a root `PostgresJsDatabase` and a
 * transaction handle can call the read — the budget-enforcement transaction
 * and read-only callers share the same query shapes.
 */
type AiSpendDatabase = Pick<PostgresJsDatabase<typeof schema>, "select">;

/** Committed and reserved (held) AI spend for one UTC month, in microunits. */
export type AiSpendPeriod = Readonly<{
  committedMicrounits: bigint;
  heldMicrounits: bigint;
}>;

/**
 * Workspace AI spend for the UTC month containing `periodStart`:
 * `committed` sums `ai_usage.cost_microunits` rows created inside
 * `[monthStart, nextMonthStart)`; `held` sums `ai_budget_reservation`
 * `reserved_microunits` pinned to the period start with status "reserved"
 * (settled or released holds never count). This is the exact read the
 * budget-enforcement path uses, shared with the usage overview so both
 * surfaces agree on the numbers.
 */
export async function readAiSpendForPeriod(
  database: AiSpendDatabase,
  workspaceId: string,
  periodStart: Date,
): Promise<AiSpendPeriod> {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  if (!(periodStart instanceof Date) || Number.isNaN(periodStart.getTime())) {
    throw new Error("A valid period start is required.");
  }
  const start = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const [committed, held] = await Promise.all([
    database
      .select({ costMicrounits: aiUsage.costMicrounits })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.workspaceId, workspaceId),
          gte(aiUsage.createdAt, start),
          lt(aiUsage.createdAt, end),
        ),
      ),
    database
      .select({ reservedMicrounits: aiBudgetReservation.reservedMicrounits })
      .from(aiBudgetReservation)
      .where(
        and(
          eq(aiBudgetReservation.workspaceId, workspaceId),
          eq(aiBudgetReservation.periodStart, start),
          eq(aiBudgetReservation.status, "reserved"),
        ),
      ),
  ]);

  return {
    committedMicrounits: committed.reduce((total, row) => total + row.costMicrounits, 0n),
    heldMicrounits: held.reduce((total, row) => total + row.reservedMicrounits, 0n),
  };
}
