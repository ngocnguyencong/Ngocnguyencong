import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { usageCounter } from "./schema";
import type * as schema from "./schema";

type UsageCounterDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one counter per (workspaceId, key, periodStart). */
export type UsageCounter = typeof usageCounter.$inferSelect;

/**
 * Upper bound for a single consume amount AND for a configured limit.
 * On the *limited* path, `used <= limit <= MAX` and `n <= MAX` keep
 * `used + n` below the int4 maximum (2·10^9 < 2^31−1), so the guarded
 * UPDATE expression cannot overflow. Unlimited counters (limit null) skip
 * the guard, so a metered key consumed past ~2^31 can still hit the int4
 * ceiling — MAX is a contract for bounded quotas, not a physical guarantee
 * for unlimited ones.
 */
export const MAX_USAGE_QUOTA = 1_000_000_000;

export interface ConsumeUsageCounterInput {
  readonly workspaceId: string;
  readonly key: string;
  readonly n: number;
  /** `null` means unlimited — omitting it is a validation error, never unlimited. */
  readonly limit: number | null;
  readonly periodStart: Date;
}

export type ConsumeUsageCounterResult =
  | Readonly<{ ok: true; used: number; limit: number | null }>
  | Readonly<{ ok: false; reason: "quota_exhausted"; used: number; limit: number | null }>;

export interface GetUsageCounterInput {
  readonly workspaceId: string;
  readonly key: string;
  readonly periodStart: Date;
}

export interface ListUsageCountersFilter {
  readonly periodStart?: Date;
}

/**
 * Generic per-workspace usage counters backed by `usage_counter`. Limits are
 * resolved by the caller (e.g. the workspace's product plan); this layer only
 * enforces them atomically.
 */
export interface UsageCounterRepository {
  /**
   * Atomically adds `n` to the counter when it fits within `limit` — a single
   * `INSERT … ON CONFLICT … DO UPDATE … WHERE used + n <= limit` statement.
   * The conditional UPDATE takes the row lock before re-checking, so two
   * concurrent consumes can never both pass a guard only one fits. On
   * rejection a follow-up read returns the current `used`.
   */
  consume(input: ConsumeUsageCounterInput): Promise<ConsumeUsageCounterResult>;
  /** Current usage for one counter; `{used: 0}` when no row exists yet. */
  get(input: GetUsageCounterInput): Promise<Readonly<{ used: number }>>;
  /** Every counter row for a workspace — admin/debug listing. */
  list(workspaceId: string, filter?: ListUsageCountersFilter): Promise<UsageCounter[]>;
}

export function createDrizzleUsageCounterRepository(
  database: UsageCounterDatabase,
): UsageCounterRepository {
  const readUsed = async (scope: CounterScope): Promise<number> => {
    const [row] = await database
      .select({ used: usageCounter.used })
      .from(usageCounter)
      .where(
        and(
          eq(usageCounter.workspaceId, scope.workspaceId),
          eq(usageCounter.key, scope.key),
          eq(usageCounter.periodStart, scope.periodStart),
        ),
      )
      .limit(1);
    return row?.used ?? 0;
  };

  return Object.freeze({
    async consume(input: ConsumeUsageCounterInput): Promise<ConsumeUsageCounterResult> {
      const scope = normalizeConsumeInput(input);
      const { key, limit, n, periodStart, workspaceId } = scope;

      // A consume larger than the limit can never succeed: `used` is
      // monotonically >= 0, so `used + n > limit` under every row state.
      // Skipping the upsert matters — the INSERT branch is unconditional,
      // so letting this through would create a row already over quota.
      if (limit !== null && n > limit) {
        return {
          ok: false,
          reason: "quota_exhausted",
          used: await readUsed(scope),
          limit,
        };
      }

      // The quota check lives in the statement itself, not a pre-read:
      // ON CONFLICT DO UPDATE takes the row lock, then evaluates WHERE on
      // the locked row, so concurrent consumers serialize on the lock and
      // only the consumes that still fit pass. A rejected update returns
      // zero rows — the row keeps its current `used`.
      const periodStartIso = periodStart.toISOString();
      const rows = await database.execute<ConsumedRow>(sql`
        INSERT INTO usage_counter (workspace_id, key, period_start, used)
        VALUES (${workspaceId}, ${key}, ${periodStartIso}::timestamptz, ${n})
        ON CONFLICT (workspace_id, key, period_start) DO UPDATE
          SET used = usage_counter.used + ${n},
              updated_at = now()
        ${limit === null ? sql`` : sql`WHERE usage_counter.used + ${n} <= ${limit}`}
        RETURNING used
      `);

      const consumed = rows[0];
      if (consumed !== undefined) {
        return { ok: true, used: consumed.used, limit };
      }
      return {
        ok: false,
        reason: "quota_exhausted",
        used: await readUsed(scope),
        limit,
      };
    },

    async get(input: GetUsageCounterInput) {
      const scope = normalizeCounterScope(input);
      return { used: await readUsed(scope) };
    },

    async list(workspaceId: string, filter?: ListUsageCountersFilter) {
      const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
      const periodStart = normalizeOptionalPeriodStart(filter?.periodStart);
      const rows = await database
        .select()
        .from(usageCounter)
        .where(
          and(
            eq(usageCounter.workspaceId, normalizedWorkspaceId),
            ...(periodStart === undefined ? [] : [eq(usageCounter.periodStart, periodStart)]),
          ),
        )
        .orderBy(asc(usageCounter.key), desc(usageCounter.periodStart));
      return rows;
    },
  });
}

type CounterScope = Readonly<{
  key: string;
  periodStart: Date;
  workspaceId: string;
}>;

type ConsumedRow = Readonly<{ used: number }>;

function requireInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid usage counter input is required.");
  }
}

function normalizeConsumeInput(
  input: ConsumeUsageCounterInput,
): CounterScope & { limit: number | null; n: number } {
  requireInput(input);
  const n = input.n;
  if (!Number.isInteger(n) || n < 1 || n > MAX_USAGE_QUOTA) {
    throw new Error("A valid consume amount is required.");
  }
  const limit = input.limit;
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > MAX_USAGE_QUOTA)) {
    throw new Error("A valid usage limit is required.");
  }
  return { ...normalizeCounterScope(input), limit, n };
}

function normalizeCounterScope(input: GetUsageCounterInput): CounterScope {
  requireInput(input);
  return Object.freeze({
    key: normalizeKey(input.key),
    periodStart: normalizePeriodStart(input.periodStart),
    workspaceId: normalizeWorkspaceId(input.workspaceId),
  });
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

function normalizePeriodStart(periodStart: Date): Date {
  if (!(periodStart instanceof Date) || Number.isNaN(periodStart.getTime())) {
    throw new Error("A valid period start is required.");
  }
  return periodStart;
}

function normalizeOptionalPeriodStart(periodStart: Date | undefined): Date | undefined {
  if (periodStart === undefined) {
    return undefined;
  }
  return normalizePeriodStart(periodStart);
}
