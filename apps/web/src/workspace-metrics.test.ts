import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("workspace metrics welcome view", () => {
  it("serves workspace-scoped metrics with session and membership verification", () => {
    const route = readWeb("app/api/workspace/metrics/route.ts");
    expect(route).toContain("getAuthSession");
    expect(route).toContain("status: 401");
    expect(route).toContain("resolveChatScope");
    expect(route).toContain("loadWorkspaceMetrics");
  });

  it("aggregates members, invites, notifications, AI usage, and plan status in one scope", () => {
    const service = readWeb("src/workspace-metrics.ts");
    expect(service).toContain('import "server-only"');
    for (const table of [
      "workspaceMembership",
      "workspaceInvitation",
      "notification",
      "taskRun",
      "aiUsage",
      "chatThread",
      "billingSubscription",
    ]) {
      expect(service).toContain(table);
    }
    expect(service).toContain("workspaceId");
  });

  it("renders a metrics panel with loading, unavailable, and populated states", () => {
    const panel = readWeb("src/workspace-metrics-panel.tsx");
    expect(panel).toContain('"use client"');
    expect(panel).toContain("/api/workspace/metrics");
    expect(panel).toContain("metric-grid");
    expect(panel).toContain("Metrics unavailable");
    expect(panel).toContain("aria-busy");
  });

  it("mounts the metrics panel on both dashboard applications", () => {
    const production = readWeb("src/production-reference-app.tsx");
    expect(production).toContain("WorkspaceMetricsPanel");
    const local = readWeb("src/reference-app.tsx");
    expect(local).toContain("WorkspaceMetricsPanel");
  });

  it("styles metric cards with app theme tokens", () => {
    const css = readWeb("app/app-theme.css");
    expect(css).toContain(".metric-grid");
    expect(css).toMatch(/\.metric-card\s*\{[^}]*var\(--raised\)[^}]*var\(--border\)/s);
    expect(css).toMatch(/\.metric-value\s*\{[^}]*var\(--text\)/s);
  });
});
