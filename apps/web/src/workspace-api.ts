import "server-only";

import {
  resolveActiveWorkspaceId,
  userWorkspacePreference,
  workspaceMembership,
} from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { database, getAuthSession } from "./auth-runtime";
import { listMembershipsForCurrentUser } from "./organization-actions";
import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants";

export type WorkspaceMembershipEntry = Readonly<{
  role: string;
  workspaceId: string;
  workspaceLogo: string | null;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}>;

export type WorkspaceListResult =
  | Readonly<{
      ok: true;
      activeWorkspaceId: string | null;
      memberships: readonly WorkspaceMembershipEntry[];
    }>
  | Readonly<{ ok: false; status: 401 }>;

/**
 * Lists memberships plus the resolved active workspace for the rail switcher.
 * Active resolution order: cookie → stored preference → personal → first.
 */
export async function listWorkspacesForRequest(userId: string): Promise<WorkspaceListResult> {
  const listed = await listMembershipsForCurrentUser();
  if (!listed.ok) {
    return { ok: false, status: 401 };
  }

  const membershipIds = listed.memberships.map((membership) => membership.workspaceId);
  const personalWorkspaceId =
    listed.memberships.find((membership) => membership.workspaceType === "personal")?.workspaceId ??
    membershipIds[0] ??
    null;

  const jar = await cookies();
  let candidate = jar.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  if (!candidate) {
    const preference = await database.query.userWorkspacePreference.findFirst({
      columns: { activeWorkspaceId: true },
      where: (fields, { eq: equals }) => equals(fields.userId, userId),
    });
    candidate = preference?.activeWorkspaceId ?? null;
  }

  const activeWorkspaceId =
    personalWorkspaceId === null
      ? null
      : resolveActiveWorkspaceId({
          activeWorkspaceId: candidate,
          membershipWorkspaceIds: membershipIds,
          personalWorkspaceId,
        });

  return {
    ok: true,
    activeWorkspaceId,
    memberships: listed.memberships,
  };
}

export type WorkspaceSwitchResult =
  Readonly<{ ok: true; workspaceId: string }> | Readonly<{ ok: false; status: 401 | 403 }>;

/**
 * Verifies membership then persists the active workspace preference. The route
 * handler owns the response cookie mutation.
 */
export async function switchWorkspaceForRequest(
  requestHeaders: Headers,
  workspaceId: string,
): Promise<WorkspaceSwitchResult> {
  const session = await getAuthSession(requestHeaders);
  if (session === null) {
    return { ok: false, status: 401 };
  }
  if (!workspaceId) {
    return { ok: false, status: 403 };
  }

  const [membership] = await database
    .select({ workspaceId: workspaceMembership.workspaceId })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.userId, session.user.id),
        eq(workspaceMembership.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (membership === undefined) {
    return { ok: false, status: 403 };
  }

  await database
    .insert(userWorkspacePreference)
    .values({
      userId: session.user.id,
      activeWorkspaceId: workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userWorkspacePreference.userId,
      set: { activeWorkspaceId: workspaceId, updatedAt: new Date() },
    });

  return { ok: true, workspaceId };
}
