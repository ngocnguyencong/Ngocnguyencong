import "server-only";

import { sdSite, sdSiteKey } from "@supastack/db";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";

import { database, getAuthSession } from "../auth-runtime";
import { resolveApiKeyCaller } from "../api-key-auth";
import { resolveActiveWorkspaceIdForUser } from "../organization-actions";
import { sha256 } from "./id";

export type SdSite = typeof sdSite.$inferSelect;

/** Ingest/read key: `Bearer sd_*` resolves a site directly. */
export async function resolveSiteByKey(headersList: Headers): Promise<SdSite | null> {
  const auth = headersList.get("authorization");
  const token = /^Bearer\s+(\S+)$/i.exec(auth ?? "")?.[1];
  if (!token?.startsWith("sd_")) return null;
  const [row] = await database
    .select({ site: sdSite, keyId: sdSiteKey.id })
    .from(sdSiteKey)
    .innerJoin(sdSite, eq(sdSite.id, sdSiteKey.siteId))
    .where(and(eq(sdSiteKey.keyHash, sha256(token)), isNull(sdSiteKey.revokedAt)))
    .limit(1);
  if (!row) return null;
  await database
    .update(sdSiteKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(sdSiteKey.id, row.keyId));
  return row.site;
}

/**
 * Account access: `Bearer sk_*` (kit workspace key) or the cookie session.
 * Returns the caller's workspaceId or null.
 */
export async function resolveCallerWorkspace(): Promise<string | null> {
  const h = await headers();
  const caller = await resolveApiKeyCaller(h);
  if (caller !== null && caller !== "invalid") return caller.workspace.workspaceId;
  const session = await getAuthSession(h);
  if (!session) return null;
  return (await resolveActiveWorkspaceIdForUser(session.user.id)) ?? null;
}

/** Site owned by `workspaceId`, or null. `siteRef` accepts `sdid_*` or shareId. */
export async function siteForWorkspace(
  workspaceId: string,
  siteRef: string,
): Promise<SdSite | null> {
  const [row] = await database
    .select()
    .from(sdSite)
    .where(and(eq(sdSite.workspaceId, workspaceId), eq(sdSite.id, siteRef)))
    .limit(1);
  return row ?? null;
}

/** Combined bearer auth for /api/v1: site key pins the site; workspace key or session resolves the workspace. */
export async function resolveApiContext(): Promise<
  { kind: "site"; site: SdSite } | { kind: "workspace"; workspaceId: string } | null
> {
  const h = await headers();
  const site = await resolveSiteByKey(h);
  if (site) return { kind: "site", site };
  const workspaceId = await resolveCallerWorkspace();
  if (workspaceId) return { kind: "workspace", workspaceId };
  return null;
}

/**
 * Resolves the site for a /api/v1 request: `sd_*` pins the site; `sk_*`/session
 * callers pass `?site_id=sdid_*` (or `?site=`). Returns null when unauthed or
 * the site isn't in the caller's workspace.
 */
export async function resolveRequestSite(url: URL): Promise<SdSite | null> {
  const ctx = await resolveApiContext();
  if (!ctx) return null;
  if (ctx.kind === "site") return ctx.site;
  const ref = url.searchParams.get("site_id") ?? url.searchParams.get("site");
  if (!ref) return null;
  return siteForWorkspace(ctx.workspaceId, ref);
}

/** Lists sites owned by a workspace (dashboard site picker). */
export async function listWorkspaceSites(workspaceId: string): Promise<SdSite[]> {
  return database.select().from(sdSite).where(eq(sdSite.workspaceId, workspaceId));
}
