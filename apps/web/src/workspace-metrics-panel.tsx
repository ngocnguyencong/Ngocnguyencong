"use client";

import { useEffect, useState } from "react";

type WorkspaceMetricsPayload = Readonly<{
  aiSpendMicrounitsThisMonth: string;
  aiTasksThisMonth: number;
  chatThreads: number;
  memberCount: number;
  pendingInvitations: number;
  plan: Readonly<{ priceReference: string; status: string }> | null;
  unreadNotifications: number;
  workspaceName: string;
  workspaceType: string;
}>;

type MetricsState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "ready"; metrics: WorkspaceMetricsPayload }>;

/** Workspace-scoped welcome metrics for the dashboard. */
export function WorkspaceMetricsPanel() {
  const [state, setState] = useState<MetricsState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/workspace/metrics", { cache: "no-store" });
        if (!response.ok) {
          if (active) setState({ status: "unavailable" });
          return;
        }
        const payload: unknown = await response.json();
        const metrics =
          typeof payload === "object" && payload !== null && "metrics" in payload
            ? (payload.metrics as WorkspaceMetricsPayload)
            : null;
        if (active) {
          setState(metrics === null ? { status: "unavailable" } : { status: "ready", metrics });
        }
      } catch {
        if (active) setState({ status: "unavailable" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      aria-busy={state.status === "loading"}
      aria-label="Workspace metrics"
      className="metrics-panel"
    >
      {state.status === "loading" ? (
        <p className="quiet-note" aria-live="polite">
          Loading workspace metrics…
        </p>
      ) : null}

      {state.status === "unavailable" ? (
        <p className="quiet-note">
          Metrics unavailable — sign in with a workspace to see live product data.
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          <div className="screen-intro">
            <div>
              <p className="eyebrow">{state.metrics.workspaceType}</p>
              <h2>Welcome to {state.metrics.workspaceName}</h2>
            </div>
          </div>
          <div className="metric-grid">
            <MetricCard label="Members" value={String(state.metrics.memberCount)} />
            <MetricCard label="Pending invites" value={String(state.metrics.pendingInvitations)} />
            <MetricCard
              label="Unread notifications"
              value={String(state.metrics.unreadNotifications)}
            />
            <MetricCard label="Chat threads" value={String(state.metrics.chatThreads)} />
            <MetricCard
              label="AI tasks this month"
              value={String(state.metrics.aiTasksThisMonth)}
            />
            <MetricCard
              label="AI spend this month"
              value={formatMicrounits(state.metrics.aiSpendMicrounitsThisMonth)}
            />
            <MetricCard
              label="Plan"
              value={state.metrics.plan === null ? "Free" : planLabel(state.metrics.plan.status)}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article className="metric-card">
      <span className="label">{label}</span>
      <strong className="metric-value">{value}</strong>
    </article>
  );
}

function planLabel(status: string): string {
  return status === "active" || status === "trialing" ? `Active (${status})` : status;
}

function formatMicrounits(microunits: string): string {
  const value = Number(microunits);
  if (!Number.isFinite(value)) return "$0.00";
  return `$${(value / 1_000_000).toFixed(2)}`;
}
