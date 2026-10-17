"use server";

import { AUDIT_ACTIONS, user, workspace, workspaceMembership } from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAuditEvent } from "./audit-runtime";
import { auth, database, getAuthSession } from "./auth-runtime";
import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants";
import { workspaceSeatLockStatement } from "./workspace-seat-transaction";

interface SessionAuthApi {
  listSessions(input: { headers: Headers }): Promise<unknown>;
  revokeOtherSessions(input: { headers: Headers }): Promise<unknown>;
  revokeSession(input: { body: { token: string }; headers: Headers }): Promise<unknown>;
}

const sessionApi = auth.api as unknown as SessionAuthApi;

export interface AccountSessionRow {
  createdAt: Date;
  current: boolean;
  expiresAt: Date;
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface NormalizedAccountSession {
  row: AccountSessionRow;
  token: string;
}

function normalizeSessionRecord(
  value: unknown,
  currentToken: string | null,
): NormalizedAccountSession | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.token !== "string") {
    return null;
  }
  return {
    row: {
      createdAt:
        record.createdAt instanceof Date
          ? record.createdAt
          : new Date(typeof record.createdAt === "string" ? record.createdAt : ""),
      current: record.token === currentToken,
      expiresAt:
        record.expiresAt instanceof Date
          ? record.expiresAt
          : new Date(typeof record.expiresAt === "string" ? record.expiresAt : ""),
      id: record.id,
      ipAddress: typeof record.ipAddress === "string" ? record.ipAddress : null,
      userAgent: typeof record.userAgent === "string" ? record.userAgent : null,
    },
    token: record.token,
  };
}

async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies();
  for (const name of [
    "supastack.session_token",
    "better-auth.session_token",
    "__Secure-supastack.session_token",
    "__Secure-better-auth.session_token",
  ]) {
    const value = jar.get(name)?.value;
    if (value) {
      return value.split(".")[0] ?? value;
    }
  }
  return null;
}

export async function listMySessions(): Promise<AccountSessionRow[]> {
  const requestHeaders = await headers();
  const session = await getAuthSession(requestHeaders);
  if (session === null) {
    return [];
  }
  const currentToken = await currentSessionToken();
  const result = (await sessionApi.listSessions({ headers: requestHeaders })) as unknown[];
  return (Array.isArray(result) ? result : [])
    .map((row) => normalizeSessionRecord(row, currentToken))
    .filter((row): row is NormalizedAccountSession => row !== null)
    .map(({ row }) => row)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function revokeMySessionAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  const session = await getAuthSession(requestHeaders);
  if (session === null) {
    redirect("/settings/security?status=unauthorized");
  }
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    redirect("/settings/security?status=invalid");
  }
  const currentToken = await currentSessionToken();
  const result = (await sessionApi.listSessions({ headers: requestHeaders })) as unknown[];
  const target = (Array.isArray(result) ? result : [])
    .map((row) => normalizeSessionRecord(row, currentToken))
    .find((row) => row?.row.id === sessionId);
  if (target === undefined || target === null || target.token === currentToken) {
    redirect("/settings/security?status=invalid");
  }
  await sessionApi.revokeSession({ body: { token: target.token }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.sessionRevoked,
    actorUserId: session.user.id,
    targetId: session.user.id,
    targetType: "session",
  });
  redirect("/settings/security?status=session-revoked");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/settings/security?status=unauthorized");
  }
  const requestHeaders = await headers();
  await sessionApi.revokeOtherSessions({ headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.sessionOthersRevoked,
    actorUserId: session.user.id,
    targetId: session.user.id,
    targetType: "session",
  });
  redirect("/settings/security?status=sessions-revoked");
}

/**
 * Deletes the signed-in account. Sole owners of organization workspaces must
 * transfer ownership or delete the organization first; personal workspaces are
 * removed with the account. Related rows cascade by foreign key.
 */
export async function deleteAccountAction(formData: FormData): Promise<void> {
  const session = await getAuthSession(await headers());
  if (session === null) {
    redirect("/settings/security?status=unauthorized");
  }
  const confirm = formData.get("confirm");
  let retrySnapshot = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await database.transaction(async (transaction) => {
        const [account] = await transaction
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, session.user.id))
          .for("no key update")
          .limit(1);
        if (account === undefined || confirm !== account.email) {
          redirect("/settings/security?status=confirm-mismatch");
        }

        const readMemberships = () =>
          transaction
            .select({
              role: workspaceMembership.role,
              workspaceId: workspaceMembership.workspaceId,
              workspaceType: workspace.type,
            })
            .from(workspaceMembership)
            .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
            .where(eq(workspaceMembership.userId, session.user.id));
        const initialMemberships = await readMemberships();
        const initiallyObservedWorkspaceIds = [
          ...new Set(initialMemberships.map(({ workspaceId }) => workspaceId)),
        ].sort();
        for (const workspaceId of initiallyObservedWorkspaceIds) {
          await transaction.execute(workspaceSeatLockStatement(workspaceId));
        }

        // Upgrade only after acquiring workspace locks: invite acceptance uses
        // the same workspace lock before its membership FK checks.
        const [lockedAccount] = await transaction
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, session.user.id))
          .for("update")
          .limit(1);
        if (lockedAccount === undefined) {
          redirect("/settings/security?status=confirm-mismatch");
        }

        const memberships = await readMemberships();
        const lockedWorkspaceIds = new Set(initiallyObservedWorkspaceIds);
        if (memberships.some(({ workspaceId }) => !lockedWorkspaceIds.has(workspaceId))) {
          throw new MembershipSnapshotChangedError();
        }

        const blocking: string[] = [];
        const personalIds: string[] = [];
        for (const membership of memberships) {
          if (membership.workspaceType === "personal") {
            personalIds.push(membership.workspaceId);
            continue;
          }
          if (membership.role === "owner") {
            const owners = await transaction
              .select({ count: workspaceMembership.id })
              .from(workspaceMembership)
              .where(
                and(
                  eq(workspaceMembership.workspaceId, membership.workspaceId),
                  eq(workspaceMembership.role, "owner"),
                ),
              );
            if (owners.length <= 1) {
              blocking.push(membership.workspaceId);
            }
          }
        }
        if (blocking.length > 0) {
          redirect("/settings/security?status=sole-owner");
        }

        for (const workspaceId of personalIds) {
          await transaction.delete(workspace).where(eq(workspace.id, workspaceId));
        }
        await transaction.delete(user).where(eq(user.id, session.user.id));
      });
      retrySnapshot = false;
      break;
    } catch (error) {
      if (!(error instanceof MembershipSnapshotChangedError)) {
        throw error;
      }
      retrySnapshot = true;
      if (attempt === 2) {
        redirect("/settings/security?status=retry");
      }
    }
  }
  if (retrySnapshot) {
    redirect("/settings/security?status=retry");
  }

  await recordAuditEvent({
    action: AUDIT_ACTIONS.accountSelfDeleted,
    actorUserId: null,
    metadata: { selfService: true },
    targetId: session.user.id,
    targetType: "user",
  });

  const jar = await cookies();
  jar.delete(ACTIVE_WORKSPACE_COOKIE);
  redirect("/auth?status=account-deleted");
}

class MembershipSnapshotChangedError extends Error {}
