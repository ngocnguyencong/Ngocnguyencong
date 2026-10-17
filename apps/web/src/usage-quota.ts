import "server-only";

import {
  createDrizzleCreditsRepository,
  createDrizzleUsageCapRepository,
  createDrizzleUsageCounterRepository,
  entitlement,
  InsufficientCreditsError,
  isCreditReferenceConflict,
  MAX_USAGE_QUOTA,
  type ConsumeUsageCounterResult,
  type CreditsRepository,
  type UsageCapRepository,
  type UsageCounterRepository,
} from "@supastack/db";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";

import { database } from "./auth-runtime";
import { PRODUCT_PLANS, type ProductPlan } from "./product-plans";

/** First instant of `now`'s UTC calendar month — the default counter period. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface UsageQuotaDependencies {
  /** Plan catalog override — defaults to PRODUCT_PLANS (tests inject fixtures). */
  readonly plans?: readonly ProductPlan[];
  /** Counter storage override — defaults to the real Drizzle repository. */
  readonly repository?: UsageCounterRepository;
  /**
   * Owner-set usage caps (`workspace_usage_cap`) — defaults to the real
   * Drizzle repository. A stored cap is a hard ceiling layered over the
   * plan allowance; a cap-bound rejection never falls back to credits.
   */
  readonly caps?: Pick<UsageCapRepository, "get">;
  /**
   * Prepaid credit ledger for quota overflow — defaults to the real Drizzle
   * repository (only constructed when a configured quota first rejects).
   */
  readonly credits?: CreditsRepository;
  /**
   * Active entitlement keys for the workspace — defaults to the entitlement
   * table (status active|trialing, not expired). Tests inject a stub.
   */
  readonly listActiveEntitlementKeys?: (
    workspaceId: string,
    now: Date,
  ) => Promise<readonly string[]>;
  /** Clock override — defaults to the wall clock. */
  readonly now?: () => Date;
}

/**
 * The workspace's current plan: the first catalog plan whose `entitlement`
 * key is actively granted, else the `free` plan (id === "free"), else null.
 * Kit plans "pro"/"lifetime" share one entitlement key — products needing
 * distinct limits per paid tier must grant distinct entitlement keys.
 */
export function resolveWorkspacePlan(
  activeEntitlementKeys: readonly string[],
  plans: readonly ProductPlan[] = PRODUCT_PLANS,
): ProductPlan | null {
  const granted = new Set(activeEntitlementKeys);
  for (const plan of plans) {
    if (plan.entitlement !== null && granted.has(plan.entitlement)) {
      return plan;
    }
  }
  return plans.find((plan) => plan.id === "free") ?? null;
}

/**
 * The workspace's quota for `key` — the resolved plan's `usageLimits[key]`.
 * `null` means unlimited: an absent key in the plan, a plan without
 * `usageLimits`, or no matching plan at all.
 */
export async function resolveUsageLimit(
  workspaceId: string,
  key: string,
  dependencies?: UsageQuotaDependencies,
): Promise<number | null> {
  requireWorkspaceId(workspaceId);
  requireUsageKey(key);
  const now = (dependencies?.now ?? defaultNow)();
  const listKeys = dependencies?.listActiveEntitlementKeys ?? listActiveEntitlementKeys;
  const plan = resolveWorkspacePlan(
    await listKeys(workspaceId, now),
    dependencies?.plans ?? PRODUCT_PLANS,
  );
  const configured = plan?.usageLimits?.[key];
  // Number.isFinite, not just typeof === "number": a NaN limit must resolve
  // to unlimited rather than flowing into the counter guard as a poison value.
  return typeof configured === "number" && Number.isFinite(configured) ? configured : null;
}

/** The lower of two optional limits; `null` when both are unlimited. */
function effectiveUsageLimit(planLimit: number | null, cap: number | null): number | null {
  if (cap !== null && (planLimit === null || cap < planLimit)) {
    return cap;
  }
  return planLimit;
}

/**
 * The effective quota for `key`: the lower of the plan `usageLimits`
 * allowance and the workspace's owner-set cap. `null` means unlimited —
 * neither the plan nor a cap constrains the meter.
 */
export async function resolveEffectiveUsageLimit(
  workspaceId: string,
  key: string,
  dependencies?: UsageQuotaDependencies,
): Promise<number | null> {
  const [planLimit, cap] = await Promise.all([
    resolveUsageLimit(workspaceId, key, dependencies),
    usageCapRepository(dependencies).get(workspaceId, key),
  ]);
  return effectiveUsageLimit(planLimit, cap);
}

/**
 * Atomically consumes `n` units of `key` for the current (or given) period,
 * enforcing the effective quota — the lower of the workspace's plan limit
 * and its owner-set cap. Limits are resolved server-side — callers never
 * supply them.
 *
 * When a PLAN-BOUND quota rejects (`quota_exhausted` with the plan limit
 * binding), the prepaid credit pool takes over: `n` credits are debited
 * from `credit_transaction` (kind "debit", reason "usage quota overflow",
 * linked by `referenceId`) and the consume reports `ok: true`. The usage
 * counter is intentionally left at its limit — the ledger row is the record
 * of over-quota usage. When the balance cannot cover the debit the original
 * rejection stands.
 *
 * An owner-set CAP is a hard ceiling: when it binds (cap is set and below
 * the plan limit, or the plan is unlimited), a rejection is returned
 * untouched — credits never cover it. Workspaces without any configured
 * limit never reach the ledger: unlimited meters change nothing.
 */
export async function consumeQuota(
  input: {
    readonly workspaceId: string;
    readonly key: string;
    readonly n: number;
    readonly periodStart?: Date;
    /**
     * Optional caller-side reference (e.g. the AI task id) recorded on the
     * overflow debit so the ledger entry links back to its cause.
     */
    readonly referenceId?: string;
  },
  dependencies?: UsageQuotaDependencies,
): Promise<ConsumeUsageCounterResult> {
  requireQuotaInput(input);
  const { key, workspaceId } = input;
  const n = requireConsumeAmount(input.n);
  const referenceId = normalizeOptionalReferenceId(input.referenceId);
  const periodStart = normalizePeriodStart(
    input.periodStart ?? monthStart((dependencies?.now ?? defaultNow)()),
  );
  const [planLimit, cap] = await Promise.all([
    resolveUsageLimit(workspaceId, key, dependencies),
    usageCapRepository(dependencies).get(workspaceId, key),
  ]);
  const limit = effectiveUsageLimit(planLimit, cap);
  const consumed = await usageCounterRepository(dependencies).consume({
    key,
    limit,
    n,
    periodStart,
    workspaceId,
  });
  if (consumed.ok || consumed.limit === null) {
    return consumed;
  }

  // The cap is the binding limit — a hard ceiling prepaid credits never
  // cover. The plan-binds case (cap unset or >= plan limit) falls through
  // to the credit overflow below.
  if (cap !== null && (planLimit === null || cap < planLimit)) {
    return consumed;
  }

  // Configured quota exhausted — prepaid credits keep the action running.
  try {
    await creditsRepository(dependencies).appendTransaction({
      amount: -n,
      kind: "debit",
      reason: "usage quota overflow",
      ...(referenceId === undefined ? {} : { referenceId }),
      workspaceId,
    });
    return { ok: true, used: consumed.used, limit: consumed.limit };
  } catch (error) {
    // A raced twin debit (same reference — e.g. two intakes sharing an
    // idempotency key) already charged this action once: report success so
    // the loser resolves through the normal replay path rather than
    // double-spending or erroring.
    if (referenceId !== undefined && isCreditReferenceConflict(error)) {
      return { ok: true, used: consumed.used, limit: consumed.limit };
    }
    // An empty pool keeps the quota rejection; infrastructure failures
    // (ledger unreachable) are NOT quota rejections and must surface.
    if (error instanceof InsufficientCreditsError) {
      return consumed;
    }
    throw error;
  }
}

/**
 * Current usage plus the resolved limits — `limit` is the effective quota
 * (the lower of `planLimit` and `cap`); `planLimit` and `cap` are reported
 * separately so callers can explain which one binds.
 */
export async function getQuota(
  input: {
    readonly workspaceId: string;
    readonly key: string;
    readonly periodStart?: Date;
  },
  dependencies?: UsageQuotaDependencies,
): Promise<
  Readonly<{ used: number; limit: number | null; planLimit: number | null; cap: number | null }>
> {
  requireQuotaInput(input);
  const { key, workspaceId } = input;
  const periodStart = normalizePeriodStart(
    input.periodStart ?? monthStart((dependencies?.now ?? defaultNow)()),
  );
  const [planLimit, cap, usage] = await Promise.all([
    resolveUsageLimit(workspaceId, key, dependencies),
    usageCapRepository(dependencies).get(workspaceId, key),
    usageCounterRepository(dependencies).get({ key, periodStart, workspaceId }),
  ]);
  return { used: usage.used, limit: effectiveUsageLimit(planLimit, cap), planLimit, cap };
}

/* ------------------------------------------------------------------------ */

const defaultNow = () => new Date();

let repository: UsageCounterRepository | null = null;
function usageCounterRepository(dependencies?: UsageQuotaDependencies): UsageCounterRepository {
  if (dependencies?.repository !== undefined) {
    return dependencies.repository;
  }
  repository ??= createDrizzleUsageCounterRepository(database);
  return repository;
}

let caps: Pick<UsageCapRepository, "get"> | null = null;
function usageCapRepository(
  dependencies?: UsageQuotaDependencies,
): Pick<UsageCapRepository, "get"> {
  if (dependencies?.caps !== undefined) {
    return dependencies.caps;
  }
  caps ??= createDrizzleUsageCapRepository(database);
  return caps;
}

let credits: CreditsRepository | null = null;
function creditsRepository(dependencies?: UsageQuotaDependencies): CreditsRepository {
  if (dependencies?.credits !== undefined) {
    return dependencies.credits;
  }
  credits ??= createDrizzleCreditsRepository(database);
  return credits;
}

/** Active/trialing, unexpired entitlement keys — the workspace→plan bridge. */
async function listActiveEntitlementKeys(
  workspaceId: string,
  now: Date,
): Promise<readonly string[]> {
  const rows = await database
    .select({ key: entitlement.key })
    .from(entitlement)
    .where(
      and(
        eq(entitlement.workspaceId, workspaceId),
        inArray(entitlement.status, ["active", "trialing"]),
        or(isNull(entitlement.expiresAt), gt(entitlement.expiresAt, now)),
      ),
    );
  return rows.map((row) => row.key);
}

function requireQuotaInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid usage quota input is required.");
  }
}

function requireWorkspaceId(workspaceId: string): string {
  if (typeof workspaceId !== "string" || workspaceId.trim().length === 0) {
    throw new Error("A valid workspace is required.");
  }
  return workspaceId;
}

function requireUsageKey(key: string): string {
  if (typeof key !== "string" || key.trim().length === 0 || key.length > 100) {
    throw new Error("A valid usage counter key is required.");
  }
  return key;
}

function requireConsumeAmount(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > MAX_USAGE_QUOTA) {
    throw new Error("A valid consume amount is required.");
  }
  return n;
}

function normalizePeriodStart(periodStart: Date): Date {
  if (!(periodStart instanceof Date) || Number.isNaN(periodStart.getTime())) {
    throw new Error("A valid period start is required.");
  }
  return periodStart;
}

function normalizeOptionalReferenceId(referenceId: string | undefined): string | undefined {
  if (referenceId === undefined) {
    return undefined;
  }
  if (
    typeof referenceId !== "string" ||
    referenceId.trim().length === 0 ||
    referenceId.length > 128
  ) {
    throw new Error("A valid usage quota reference is required.");
  }
  return referenceId;
}
