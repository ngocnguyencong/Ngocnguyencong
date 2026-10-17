import "server-only";

import {
  canManageWorkspaceMembers,
  effectiveAiMonthlyBudget,
  readAiSpendForPeriod,
  workspaceAiPolicy,
} from "@supastack/db";
import { eq } from "drizzle-orm";

import { database } from "./auth-runtime";
import { getWorkspaceCredits } from "./credits";
import { getQuota, monthStart, type UsageQuotaDependencies } from "./usage-quota";
import { usageMeters } from "./usage-meters";
import { requireWorkspaceViewer } from "./workspace-access";

/** Per-meter row on the usage overview — `limit` is the effective quota. */
export type UsageMeterOverview = Readonly<{
  key: string;
  label: string;
  description: string;
  used: number;
  planLimit: number | null;
  cap: number | null;
  limit: number | null;
}>;

/**
 * Everything the Settings → Usage section and `GET /api/mobile/usage`
 * render for the active workspace's current UTC month. Bigints are
 * serialized as decimal strings so the shape survives JSON/RSC transport.
 */
export type WorkspaceUsageOverview = Readonly<{
  /** First instant of the UTC month the numbers cover, ISO-8601. */
  periodStart: string;
  /** First instant of the next UTC month — the reset boundary, ISO-8601. */
  periodEnd: string;
  ai: Readonly<{
    keyMode: string;
    /** Effective monthly budget in microunits, decimal string; null = unlimited (BYOK). */
    budgetMicrounits: string | null;
    /** True when the effective budget is the platform default, not an explicit limit. */
    isDefaultBudget: boolean;
    committedMicrounits: string;
    heldMicrounits: string;
  }>;
  meters: readonly UsageMeterOverview[];
  credits: Readonly<{ balance: number }>;
}>;

type AiPolicySnapshot = Readonly<{
  keyMode: string;
  monthlyBudgetMicrounits: bigint | null;
}>;

export interface UsageOverviewDependencies extends UsageQuotaDependencies {
  /** `workspace_ai_policy` row for the workspace — defaults to a real read. */
  readonly readAiPolicy?: (workspaceId: string) => Promise<AiPolicySnapshot | undefined>;
  /** Committed/held AI spend — defaults to the shared `readAiSpendForPeriod`. */
  readonly readAiSpend?: (
    workspaceId: string,
    periodStart: Date,
  ) => Promise<Readonly<{ committedMicrounits: bigint; heldMicrounits: bigint }>>;
  /** Prepaid credit balance — defaults to the credits ledger. */
  readonly getCreditBalance?: (workspaceId: string) => Promise<number>;
}

/** First instant of the next UTC month after `date`. */
function nextMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

async function readAiPolicy(workspaceId: string): Promise<AiPolicySnapshot | undefined> {
  const [policy] = await database
    .select({
      keyMode: workspaceAiPolicy.keyMode,
      monthlyBudgetMicrounits: workspaceAiPolicy.monthlyBudgetMicrounits,
    })
    .from(workspaceAiPolicy)
    .where(eq(workspaceAiPolicy.workspaceId, workspaceId))
    .limit(1);
  return policy;
}

/**
 * The workspace's current-month usage overview. Period boundaries come
 * from `now` (UTC month); spend is the same committed/held read the AI
 * budget enforcement path uses, so enforcement and display agree.
 */
export async function getWorkspaceUsageOverview(
  workspaceId: string,
  now: Date = new Date(),
  dependencies?: UsageOverviewDependencies,
): Promise<WorkspaceUsageOverview> {
  const periodStart = monthStart(now);
  const periodEnd = nextMonthStart(periodStart);
  const readPolicy = dependencies?.readAiPolicy ?? readAiPolicy;
  const readSpend =
    dependencies?.readAiSpend ??
    ((id: string, start: Date) => readAiSpendForPeriod(database, id, start));
  const creditBalance = dependencies?.getCreditBalance ?? getWorkspaceCredits;

  const [policy, spend, balance] = await Promise.all([
    readPolicy(workspaceId),
    readSpend(workspaceId, periodStart),
    creditBalance(workspaceId),
  ]);
  const budgetMicrounits = effectiveAiMonthlyBudget(policy);

  const meters = await Promise.all(
    usageMeters(dependencies?.plans).map(async (meter) => ({
      ...meter,
      ...(await getQuota({ key: meter.key, periodStart, workspaceId }, dependencies)),
    })),
  );

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    ai: {
      keyMode: policy?.keyMode ?? "platform",
      budgetMicrounits: budgetMicrounits?.toString() ?? null,
      // The $5 platform default applies only when no explicit budget is
      // stored and the policy isn't BYOK — in which case there is no
      // budget to report at all.
      isDefaultBudget: budgetMicrounits !== null && policy?.monthlyBudgetMicrounits == null,
      committedMicrounits: spend.committedMicrounits.toString(),
      heldMicrounits: spend.heldMicrounits.toString(),
    },
    meters,
    credits: { balance },
  };
}

/** Panel payload for the settings page — overview plus the viewer's manage rights. */
export type UsagePanelData =
  | Readonly<{ ok: true; canManage: boolean; overview: WorkspaceUsageOverview }>
  | Readonly<{ ok: false; error: string }>;

/**
 * Server-side loader for `/settings/usage` (and its localized twin):
 * resolves the signed-in user's active workspace + role, then the
 * overview. Guests and members read (`canManage: false`); the write
 * actions re-check the role server-side.
 */
export async function loadUsagePanelData(): Promise<UsagePanelData> {
  const viewer = await requireWorkspaceViewer();
  if ("error" in viewer) {
    return { ok: false, error: viewer.error };
  }
  const overview = await getWorkspaceUsageOverview(viewer.workspaceId, new Date());
  return { ok: true, canManage: canManageWorkspaceMembers(viewer.role), overview };
}
