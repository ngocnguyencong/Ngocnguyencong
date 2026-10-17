"use server";

import {
  AUDIT_ACTIONS,
  billingSubscription,
  user,
  workspace,
  workspaceMembership,
} from "@supastack/db";
import { desc, eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordAuditEvent } from "./audit-runtime";
import { auth, database } from "./auth-runtime";
import { isAdminRole, normalizeAdminSession, type AdminSession, type AdminUserRow } from "./admin";

interface AdminAuthApi {
  banUser(input: {
    body: { banExpiresIn?: number; banReason?: string; userId: string };
    headers: Headers;
  }): Promise<unknown>;
  getSession(input: { headers: Headers }): Promise<unknown>;
  impersonateUser(input: {
    body: { userId: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
  listUsers(input: {
    headers: Headers;
    query: {
      limit: number;
      searchField?: "email" | "name";
      searchOperator?: "contains";
      searchValue?: string;
    };
  }): Promise<unknown>;
  removeUser(input: { body: { userId: string }; headers: Headers }): Promise<unknown>;
  revokeUserSessions(input: { body: { userId: string }; headers: Headers }): Promise<unknown>;
  setRole(input: { body: { role: string; userId: string }; headers: Headers }): Promise<unknown>;
  stopImpersonating(input: {
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: unknown }>;
  unbanUser(input: { body: { userId: string }; headers: Headers }): Promise<unknown>;
}

const adminApi = auth.api as unknown as AdminAuthApi;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Server-side platform-admin session; null when signed out or not an admin. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const requestHeaders = await headers();
  const raw = await adminApi.getSession({ headers: requestHeaders });
  const session = normalizeAdminSession(raw);
  if (session === null || !isAdminRole(session.user.role)) {
    return null;
  }
  return session;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (session === null) {
    redirect("/admin/users?status=forbidden");
  }
  return session;
}

/** Writes Better Auth response cookies (e.g. impersonation session) onto this response. */
async function forwardAuthCookies(source: Headers): Promise<void> {
  const jar = await cookies();
  for (const line of source.getSetCookie()) {
    const [pair, ...attributes] = line.split(";").map((part) => part.trim());
    if (!pair) continue;
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    const options: {
      expires?: Date;
      httpOnly: boolean;
      maxAge?: number;
      path: string;
      sameSite: "lax" | "none" | "strict";
      secure?: boolean;
    } = { httpOnly: true, path: "/", sameSite: "lax" };
    for (const attribute of attributes) {
      const attributeSeparator = attribute.indexOf("=");
      const key = (
        attributeSeparator === -1 ? attribute : attribute.slice(0, attributeSeparator)
      ).toLowerCase();
      const attributeValue =
        attributeSeparator === -1 ? "" : attribute.slice(attributeSeparator + 1);
      if (key === "path" && attributeValue) options.path = attributeValue;
      if (key === "max-age") options.maxAge = Number(attributeValue);
      if (key === "expires") options.expires = new Date(attributeValue);
      if (key === "samesite" && ["lax", "none", "strict"].includes(attributeValue.toLowerCase())) {
        options.sameSite = attributeValue.toLowerCase() as "lax" | "none" | "strict";
      }
      if (key === "secure") options.secure = true;
      if (key === "httponly") options.httpOnly = true;
    }
    jar.set(name, value, options);
  }
}

function normalizeAdminUserRow(value: unknown): AdminUserRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.email !== "string") {
    return null;
  }
  return {
    banned: record.banned === true,
    createdAt:
      record.createdAt instanceof Date
        ? record.createdAt
        : new Date(typeof record.createdAt === "string" ? record.createdAt : ""),
    email: record.email,
    id: record.id,
    name: typeof record.name === "string" ? record.name : "",
    role: typeof record.role === "string" ? record.role : "user",
  };
}

export async function listAdminUsers(search: string): Promise<AdminUserRow[]> {
  const session = await getAdminSession();
  if (session === null) {
    return [];
  }
  const requestHeaders = await headers();
  const result = (await adminApi.listUsers({
    headers: requestHeaders,
    query: {
      limit: 200,
      ...(search.trim()
        ? {
            searchField: "email" as const,
            searchOperator: "contains" as const,
            searchValue: search.trim(),
          }
        : {}),
    },
  })) as { users?: unknown[] };
  return (result.users ?? [])
    .map(normalizeAdminUserRow)
    .filter((row): row is AdminUserRow => row !== null);
}

export async function adminSetUserRoleAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  const role = formString(formData, "role") === "admin" ? "admin" : "user";
  if (!userId || userId === session.user.id) {
    redirect("/admin/users?status=invalid");
  }
  const requestHeaders = await headers();
  await adminApi.setRole({ body: { role, userId }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserRoleChanged,
    actorUserId: session.user.id,
    metadata: { role },
    targetId: userId,
    targetType: "user",
  });
  redirect("/admin/users?status=role-updated");
}

export async function adminBanUserAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId || userId === session.user.id) {
    redirect("/admin/users?status=invalid");
  }
  const requestHeaders = await headers();
  const reason = formString(formData, "reason") || "Banned by platform admin";
  await adminApi.banUser({ body: { banReason: reason, userId }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserBanned,
    actorUserId: session.user.id,
    metadata: { reason },
    targetId: userId,
    targetType: "user",
  });
  redirect("/admin/users?status=banned");
}

export async function adminUnbanUserAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) {
    redirect("/admin/users?status=invalid");
  }
  const requestHeaders = await headers();
  await adminApi.unbanUser({ body: { userId }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserUnbanned,
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "user",
  });
  redirect("/admin/users?status=unbanned");
}

export async function adminRevokeUserSessionsAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId) {
    redirect("/admin/users?status=invalid");
  }
  const requestHeaders = await headers();
  await adminApi.revokeUserSessions({ body: { userId }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserSessionsRevoked,
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "user",
  });
  redirect("/admin/users?status=sessions-revoked");
}

export async function adminDeleteUserAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  const confirm = formString(formData, "confirm");
  if (!userId || userId === session.user.id) {
    redirect("/admin/users?status=invalid");
  }
  const [target] = await database
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (target === undefined || confirm !== target.email) {
    redirect("/admin/users?status=confirm-mismatch");
  }
  const requestHeaders = await headers();
  await adminApi.removeUser({ body: { userId }, headers: requestHeaders });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserDeleted,
    actorUserId: session.user.id,
    metadata: { email: target.email },
    targetId: userId,
    targetType: "user",
  });
  redirect("/admin/users?status=deleted");
}

export async function adminImpersonateUserAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const userId = formString(formData, "userId");
  if (!userId || userId === session.user.id) {
    redirect("/admin/users?status=invalid");
  }
  const requestHeaders = await headers();
  const result = await adminApi.impersonateUser({
    body: { userId },
    headers: requestHeaders,
    returnHeaders: true,
  });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminUserImpersonated,
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "user",
  });
  await forwardAuthCookies(result.headers);
  redirect("/dashboard?status=impersonating");
}

/**
 * Stops the current impersonation session. This runs under the impersonated
 * (non-admin) session, so it checks the marker rather than the admin role.
 */
export async function adminStopImpersonatingAction(): Promise<void> {
  const requestHeaders = await headers();
  const raw = await adminApi.getSession({ headers: requestHeaders });
  const session = normalizeAdminSession(raw);
  if (session === null || session.session.impersonatedBy === null) {
    redirect("/dashboard");
  }
  const result = await adminApi.stopImpersonating({
    headers: requestHeaders,
    returnHeaders: true,
  });
  await forwardAuthCookies(result.headers);
  redirect("/admin/users?status=impersonation-ended");
}

export type AdminOrganizationRow = Readonly<{
  createdAt: Date;
  id: string;
  memberCount: number;
  name: string;
  slug: string;
}>;

export async function listAdminOrganizations(): Promise<AdminOrganizationRow[]> {
  const session = await getAdminSession();
  if (session === null) {
    return [];
  }
  const rows = await database
    .select({
      createdAt: workspace.createdAt,
      id: workspace.id,
      memberCount: sql<number>`count(${workspaceMembership.id})::int`,
      name: workspace.name,
      slug: workspace.slug,
    })
    .from(workspace)
    .leftJoin(workspaceMembership, eq(workspaceMembership.workspaceId, workspace.id))
    .where(eq(workspace.type, "organization"))
    .groupBy(workspace.id)
    .orderBy(desc(workspace.createdAt))
    .limit(500);
  return rows.map((row) => ({
    createdAt: row.createdAt,
    id: row.id,
    memberCount: Number(row.memberCount ?? 0),
    name: row.name,
    slug: row.slug,
  }));
}

export async function adminDeleteOrganizationAction(formData: FormData): Promise<void> {
  const session = await requireAdminSession();
  const workspaceId = formString(formData, "workspaceId");
  const confirm = formString(formData, "confirm");
  const [org] = await database
    .select({ name: workspace.name, type: workspace.type })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);
  if (org === undefined || org.type !== "organization" || confirm !== org.name) {
    redirect("/admin/organizations?status=confirm-mismatch");
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.adminOrganizationDeleted,
    actorUserId: session.user.id,
    metadata: { name: org.name },
    targetId: workspaceId,
    targetType: "workspace",
  });
  await database.delete(workspace).where(eq(workspace.id, workspaceId));
  redirect("/admin/organizations?status=deleted");
}

export async function adminOverviewStats(): Promise<{
  organizations: number;
  subscriptions: number;
  users: number;
  workspaces: number;
}> {
  const session = await getAdminSession();
  if (session === null) {
    return { organizations: 0, subscriptions: 0, users: 0, workspaces: 0 };
  }
  const [userCount] = await database.select({ count: sql<number>`count(*)::int` }).from(user);
  const [workspaceCount] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(workspace);
  const [orgCount] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(workspace)
    .where(eq(workspace.type, "organization"));
  const [subCount] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(billingSubscription)
    .where(eq(billingSubscription.status, "active"));
  return {
    organizations: Number(orgCount?.count ?? 0),
    subscriptions: Number(subCount?.count ?? 0),
    users: Number(userCount?.count ?? 0),
    workspaces: Number(workspaceCount?.count ?? 0),
  };
}
