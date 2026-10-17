import "server-only";

import {
  canManageWorkspaceMembers,
  canWriteWorkspace,
  normalizeWorkspaceRole,
  workspaceMembership,
  type WorkspaceRole,
} from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { database, getAuthSession } from "./auth-runtime";
import { resolveActiveWorkspaceIdForUser } from "./organization-actions";

export interface WorkspaceManagerContext {
  userId: string;
  workspaceId: string;
}

/**
 * Resolves the signed-in user's active workspace and verifies they hold an
 * owner/admin role there. Used by developer-surface actions (API keys,
 * outbound webhooks).
 */
export async function requireWorkspaceManager(): Promise<
  WorkspaceManagerContext | { error: string }
> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return { error: "Sign in required." };
  }
  const workspaceId = await resolveActiveWorkspaceIdForUser(session.user.id);
  if (workspaceId === undefined) {
    return { error: "No active workspace." };
  }
  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspaceMembership.userId, session.user.id),
      ),
    )
    .limit(1);
  if (
    membership === undefined ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(membership.role))
  ) {
    return { error: "Owner or admin role required." };
  }
  return { userId: session.user.id, workspaceId };
}

/**
 * Owner/admin check for the Settings → General workspace export card.
 * Fails closed — outside a request scope (no `headers()`) or on any lookup
 * error the card stays hidden; the export route re-checks the role.
 */
export async function canExportWorkspaceData(): Promise<boolean> {
  try {
    return !("error" in (await requireWorkspaceManager()));
  } catch {
    return false;
  }
}

export interface WorkspaceWriterContext extends WorkspaceManagerContext {
  role: WorkspaceRole;
}

/**
 * Resolves the signed-in user's active workspace and verifies any membership,
 * including guests. Used by read surfaces that guests may view (feedback
 * board) — callers decide writes via `canWriteWorkspace(context.role)`.
 */
export async function requireWorkspaceViewer(): Promise<
  WorkspaceWriterContext | { error: string }
> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return { error: "Sign in required." };
  }
  const workspaceId = await resolveActiveWorkspaceIdForUser(session.user.id);
  if (workspaceId === undefined) {
    return { error: "No active workspace." };
  }
  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspaceMembership.userId, session.user.id),
      ),
    )
    .limit(1);
  if (membership === undefined) {
    return { error: "Workspace membership required." };
  }
  return {
    role: normalizeWorkspaceRole(membership.role),
    userId: session.user.id,
    workspaceId,
  };
}

/**
 * Resolves the signed-in user's active workspace and verifies they hold at
 * least a member role there (guests are read-only). Used by content and
 * catalog surfaces where members author but do not administer.
 */
export async function requireWorkspaceWriter(): Promise<
  WorkspaceWriterContext | { error: string }
> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return { error: "Sign in required." };
  }
  const workspaceId = await resolveActiveWorkspaceIdForUser(session.user.id);
  if (workspaceId === undefined) {
    return { error: "No active workspace." };
  }
  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspaceMembership.userId, session.user.id),
      ),
    )
    .limit(1);
  const role = normalizeWorkspaceRole(membership?.role);
  if (membership === undefined || !canWriteWorkspace(role)) {
    return { error: "Member role or above required." };
  }
  return { role, userId: session.user.id, workspaceId };
}
