import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { entitlement } from "@supastack/db";

import { database, getAuthSession } from "./auth-runtime";
import type { EntitlementRecord } from "./entitlement-check";
import { resolveActiveWorkspaceIdForUser } from "./organization-actions";

export async function listWorkspaceEntitlements(workspaceId: string): Promise<EntitlementRecord[]> {
  return database
    .select({
      expiresAt: entitlement.expiresAt,
      key: entitlement.key,
      status: entitlement.status,
    })
    .from(entitlement)
    .where(eq(entitlement.workspaceId, workspaceId));
}

/**
 * The signed-in viewer's active workspace + its entitlement rows. Anonymous
 * viewers get `{ workspaceId: null, entitlements: [] }` — surfaces then treat
 * every gated entry as locked.
 */
export async function listViewerEntitlements(): Promise<{
  entitlements: EntitlementRecord[];
  workspaceId: string | null;
}> {
  const session = await getAuthSession(await headers());
  const workspaceId =
    session === null ? null : ((await resolveActiveWorkspaceIdForUser(session.user.id)) ?? null);
  if (workspaceId === null) return { entitlements: [], workspaceId: null };
  return { entitlements: await listWorkspaceEntitlements(workspaceId), workspaceId };
}
