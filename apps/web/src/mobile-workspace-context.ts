import "server-only";

import {
  canManageWorkspaceMembers,
  normalizeWorkspaceRole,
  workspace,
  workspaceMembership,
  type WorkspaceRole,
} from "@supastack/db";
import { and, eq } from "drizzle-orm";

import { database } from "./auth-runtime";
import { resolveActiveWorkspaceIdForSessionUser } from "./organization-actions";

export type MobileWorkspaceContext = Readonly<{
  role: WorkspaceRole;
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}>;

/**
 * Resolves the signed-in user's active workspace plus their membership role.
 * `resolveActiveWorkspaceIdForSessionUser` applies the web's resolution
 * order — request cookie → stored preference — without re-resolving the
 * session: callers always pass a session-verified `userId`, and the
 * membership join below is the authorization, so a forged or stale
 * active-workspace cookie resolves `null` instead of a foreign workspace.
 * Works inside `/api/mobile/*` route handlers because `next/headers` reads
 * the incoming request headers there too.
 */
export async function resolveMobileWorkspaceContext(
  userId: string,
): Promise<MobileWorkspaceContext | null> {
  const workspaceId = await resolveActiveWorkspaceIdForSessionUser(userId);
  if (!workspaceId) {
    return null;
  }

  const [membership] = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceType: workspace.type,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(
      and(eq(workspaceMembership.userId, userId), eq(workspaceMembership.workspaceId, workspaceId)),
    )
    .limit(1);

  if (membership === undefined) {
    return null;
  }

  return {
    role: normalizeWorkspaceRole(membership.role),
    userId,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    workspaceType: membership.workspaceType === "organization" ? "organization" : "personal",
  };
}

/** Like {@link resolveMobileWorkspaceContext} but requires an owner/admin role. */
export async function resolveMobileManagerContext(
  userId: string,
): Promise<MobileWorkspaceContext | null> {
  const context = await resolveMobileWorkspaceContext(userId);
  if (context === null || !canManageWorkspaceMembers(context.role)) {
    return null;
  }
  return context;
}
