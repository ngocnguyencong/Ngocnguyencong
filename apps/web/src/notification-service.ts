import { and, desc, eq } from "drizzle-orm";

import {
  createNotificationPreferenceRecord,
  mergeNotificationPreferences,
  notification,
  notificationPreference,
  type NotificationPreferenceFlags,
  userWorkspacePreference,
  workspace,
  workspaceMembership,
} from "@supastack/db";

import { readActiveWorkspaceCookie, resolveBillingWorkspaceId } from "./active-workspace";
import { database, getAuthSession } from "./auth-runtime";
import { markNotificationReadRecord } from "./notification-mark-read";

async function resolveSessionWorkspace(headers: Headers) {
  const session = await getAuthSession(headers);
  if (!session) {
    return null;
  }

  const memberships = await database
    .select({
      role: workspaceMembership.role,
      workspaceId: workspaceMembership.workspaceId,
      workspaceType: workspace.type,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, session.user.id));

  const preference = await database
    .select({ activeWorkspaceId: userWorkspacePreference.activeWorkspaceId })
    .from(userWorkspacePreference)
    .where(eq(userWorkspacePreference.userId, session.user.id))
    .limit(1);

  const workspaceId = resolveBillingWorkspaceId({
    cookieWorkspaceId: readActiveWorkspaceCookie(headers.get("cookie")),
    preferredWorkspaceId: preference[0]?.activeWorkspaceId,
    memberships: memberships.map((row) => ({
      role: row.role,
      workspaceId: row.workspaceId,
      workspaceType: row.workspaceType as "organization" | "personal",
    })),
  });

  if (!workspaceId) {
    return null;
  }

  return { session, workspaceId };
}

export async function listNotificationsForRequest(headers: Headers) {
  const context = await resolveSessionWorkspace(headers);
  if (!context) {
    return { ok: false as const, status: 401 as const, notifications: [] };
  }

  const rows = await database
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.workspaceId, context.workspaceId),
        eq(notification.userId, context.session.user.id),
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(50);

  return {
    ok: true as const,
    status: 200 as const,
    notifications: rows,
    workspaceId: context.workspaceId,
  };
}

export async function getNotificationPreferencesForRequest(headers: Headers) {
  const context = await resolveSessionWorkspace(headers);
  if (!context) {
    return { ok: false as const, status: 401 as const, preferences: null };
  }

  const existing = await database
    .select()
    .from(notificationPreference)
    .where(
      and(
        eq(notificationPreference.workspaceId, context.workspaceId),
        eq(notificationPreference.userId, context.session.user.id),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return {
      ok: true as const,
      status: 200 as const,
      preferences: {
        emailBilling: existing[0].emailBilling,
        emailInvites: existing[0].emailInvites,
        inAppProduct: existing[0].inAppProduct,
      } satisfies NotificationPreferenceFlags,
      workspaceId: context.workspaceId,
    };
  }

  const created = createNotificationPreferenceRecord({
    now: () => new Date(),
    userId: context.session.user.id,
    workspaceId: context.workspaceId,
  });
  await database.insert(notificationPreference).values(created);
  return {
    ok: true as const,
    status: 200 as const,
    preferences: {
      emailBilling: created.emailBilling,
      emailInvites: created.emailInvites,
      inAppProduct: created.inAppProduct,
    },
    workspaceId: context.workspaceId,
  };
}

export async function updateNotificationPreferencesForRequest(
  headers: Headers,
  patch: Partial<NotificationPreferenceFlags>,
) {
  const current = await getNotificationPreferencesForRequest(headers);
  if (!current.ok || !current.preferences || !current.workspaceId) {
    return { ok: false as const, status: 401 as const, preferences: null };
  }

  const session = await getAuthSession(headers);
  if (!session) {
    return { ok: false as const, status: 401 as const, preferences: null };
  }

  const next = mergeNotificationPreferences(current.preferences, patch);
  const now = new Date();
  await database
    .update(notificationPreference)
    .set({
      emailInvites: next.emailInvites,
      emailBilling: next.emailBilling,
      inAppProduct: next.inAppProduct,
      updatedAt: now,
    })
    .where(
      and(
        eq(notificationPreference.userId, session.user.id),
        eq(notificationPreference.workspaceId, current.workspaceId),
      ),
    );

  return { ok: true as const, status: 200 as const, preferences: next };
}

export async function markNotificationReadForRequest(headers: Headers, notificationId: string) {
  const context = await resolveSessionWorkspace(headers);
  if (!context) {
    return { ok: false as const, status: 401 as const, notification: null };
  }

  const trimmedId = notificationId.trim();
  if (!trimmedId) {
    return { ok: false as const, status: 400 as const, notification: null };
  }

  const [existing] = await database
    .select({
      id: notification.id,
      readAt: notification.readAt,
      userId: notification.userId,
      workspaceId: notification.workspaceId,
    })
    .from(notification)
    .where(eq(notification.id, trimmedId))
    .limit(1);

  const stamped = markNotificationReadRecord({
    notification: existing ?? null,
    now: () => new Date(),
    sessionUserId: context.session.user.id,
    workspaceId: context.workspaceId,
  });
  if (stamped === null) {
    return { ok: false as const, status: 404 as const, notification: null };
  }

  if (existing?.readAt === null) {
    await database
      .update(notification)
      .set({ readAt: stamped.readAt, updatedAt: stamped.updatedAt })
      .where(
        and(
          eq(notification.id, stamped.id),
          eq(notification.userId, context.session.user.id),
          eq(notification.workspaceId, context.workspaceId),
        ),
      );
  }

  return {
    ok: true as const,
    status: 200 as const,
    notification: { id: stamped.id, readAt: stamped.readAt },
  };
}
