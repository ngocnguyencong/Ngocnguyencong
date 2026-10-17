import "server-only";

import type { SdSite } from "./auth";
import { listWorkspaceSites } from "./auth";
import { requireWorkspaceViewer } from "../workspace-access";

export interface DashboardContext {
  workspaceId: string;
  sites: SdSite[];
  site: SdSite | null;
}

/**
 * Resolves the viewer's workspace sites and picks the active one —
 * `?site=` param wins, else the first site (null when none exist).
 */
export async function dashboardContext(
  siteParam?: string | null,
): Promise<DashboardContext | { error: string }> {
  const ctx = await requireWorkspaceViewer();
  if ("error" in ctx) return { error: ctx.error };
  const sites = await listWorkspaceSites(ctx.workspaceId);
  const site = (siteParam && sites.find((s) => s.id === siteParam)) || sites[0] || null;
  return { workspaceId: ctx.workspaceId, sites, site };
}
