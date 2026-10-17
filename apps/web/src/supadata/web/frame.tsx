import type { ReactNode } from "react";

import { LogIn } from "lucide-react";

import { WorkspaceShell } from "../../app-chrome";
import { getRequestBrand } from "../../custom-domains/runtime";
import { EmptyState } from "../../kit/blocks/app/empty-state";
import { dashboardContext, type DashboardContext } from "../load";
import { SiteNav } from "./site-nav";

/**
 * Resolves workspace + active site (`?site=`) and renders the app shell with
 * the analytics nav. Pages render inside; `ctx.site === null` → empty state.
 */
export async function DashboardFrame({
  siteParam,
  children,
}: {
  siteParam: string | null;
  children: (ctx: DashboardContext) => ReactNode;
}) {
  const ctx = await dashboardContext(siteParam);
  const brand = await getRequestBrand();
  return (
    <WorkspaceShell active="Dashboard" brand={brand}>
      {"error" in ctx ? (
        <EmptyState
          action={{ href: "/auth", label: "Sign in" }}
          icon={<LogIn />}
          text={ctx.error}
          title="Analytics"
        />
      ) : ctx.site ? (
        <>
          <SiteNav
            activeSiteId={ctx.site.id}
            sites={ctx.sites.map((s) => ({ id: s.id, name: s.name, domain: s.domain }))}
          />
          {children(ctx)}
        </>
      ) : (
        children(ctx)
      )}
    </WorkspaceShell>
  );
}
