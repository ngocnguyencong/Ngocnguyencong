import type { MobileApiClient } from "../api/client";

export interface WorkspaceMetrics {
  aiSpendMicrounitsThisMonth: number;
  aiTasksThisMonth: number;
  chatThreads: number;
  memberCount: number;
  pendingInvitations: number;
  plan: { priceReference: string; status: string } | null;
  unreadNotifications: number;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `GET /api/workspace/metrics` — the web dashboard's stat grid. */
export function createMobileMetricsActions(api: MobileApiClient) {
  return {
    async get(): Promise<WorkspaceMetrics> {
      const payload = await api.request<unknown>("/api/workspace/metrics");
      if (!isRecord(payload) || !isRecord(payload.metrics)) {
        throw new Error("The workspace metrics were invalid.");
      }
      const metrics = payload.metrics;
      const plan =
        isRecord(metrics.plan) &&
        typeof metrics.plan.priceReference === "string" &&
        typeof metrics.plan.status === "string"
          ? { priceReference: metrics.plan.priceReference, status: metrics.plan.status }
          : null;
      const numberField = (key: string): number =>
        typeof metrics[key] === "number" ? metrics[key] : 0;
      return {
        aiSpendMicrounitsThisMonth: numberField("aiSpendMicrounitsThisMonth"),
        aiTasksThisMonth: numberField("aiTasksThisMonth"),
        chatThreads: numberField("chatThreads"),
        memberCount: numberField("memberCount"),
        pendingInvitations: numberField("pendingInvitations"),
        plan,
        unreadNotifications: numberField("unreadNotifications"),
        workspaceName:
          typeof metrics.workspaceName === "string" ? metrics.workspaceName : "Workspace",
        workspaceType: metrics.workspaceType === "organization" ? "organization" : "personal",
      };
    },
  };
}

/** Formats microunits (1e-6 of a unit) into a compact currency-style string. */
export function formatAiSpend(microunits: number): string {
  const units = microunits / 1_000_000;
  return `$${units.toFixed(2)}`;
}
