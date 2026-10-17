import type { NotificationPreferenceFlags } from "@supastack/db";

import {
  notificationCopyForEvent,
  planWorkspaceNotifications,
  shouldDeliverEmailNotification,
  type NotificationProductEvent,
} from "./notification-events";

export type NotificationInsertRow = Readonly<{
  body: string;
  createdAt: Date;
  href: string | null;
  id: string;
  readAt: Date | null;
  title: string;
  updatedAt: Date;
  userId: string;
  workspaceId: string;
}>;

export type NotificationEmailInput = Readonly<{
  subject: string;
  text: string;
  to: string;
  workspaceId: string;
}>;

export type NotificationPushInput = Readonly<{
  body: string;
  data?: Readonly<Record<string, unknown>> | undefined;
  title: string;
  userId: string;
  workspaceId: string;
}>;

export type EmitWorkspaceNotificationDependencies = Readonly<{
  createId: () => string;
  getMemberEmail?: (userId: string) => Promise<string | null>;
  insertNotification: (row: NotificationInsertRow) => Promise<void>;
  listMemberUserIds: (workspaceId: string) => Promise<readonly string[]>;
  now: () => Date;
  readPreferences: (
    userId: string,
    workspaceId: string,
  ) => Promise<NotificationPreferenceFlags | null>;
  sendEmail?: (input: NotificationEmailInput) => Promise<unknown>;
  sendPush?: (input: NotificationPushInput) => Promise<unknown>;
}>;

export async function emitWorkspaceProductNotification(
  event: NotificationProductEvent,
  dependencies: EmitWorkspaceNotificationDependencies,
  options: Readonly<{ excludeUserIds?: ReadonlyArray<string> }> = {},
): Promise<{ inserted: number }> {
  const memberIds = await dependencies.listMemberUserIds(event.workspaceId);
  if (memberIds.length === 0) {
    return { inserted: 0 };
  }

  const preferencesByUserId: Record<string, NotificationPreferenceFlags | null> = {};
  for (const userId of memberIds) {
    preferencesByUserId[userId] = await dependencies.readPreferences(userId, event.workspaceId);
  }

  const planned = planWorkspaceNotifications({
    createId: dependencies.createId,
    event,
    excludeUserIds: options.excludeUserIds,
    members: memberIds.map((userId) => ({ userId })),
    now: dependencies.now,
    preferencesByUserId,
  });

  for (const row of planned) {
    await dependencies.insertNotification(row);
  }

  if (dependencies.sendPush !== undefined) {
    for (const row of planned) {
      try {
        await dependencies.sendPush({
          body: row.body,
          ...(row.href !== null ? { data: { href: row.href } } : {}),
          title: row.title,
          userId: row.userId,
          workspaceId: row.workspaceId,
        });
      } catch {
        // Push delivery is best-effort; it never undoes in-app fan-out.
      }
    }
  }

  if (dependencies.sendEmail !== undefined && dependencies.getMemberEmail !== undefined) {
    const copy = notificationCopyForEvent(event);
    const excluded = new Set(options.excludeUserIds ?? []);
    for (const userId of memberIds) {
      if (excluded.has(userId)) {
        continue;
      }
      if (!shouldDeliverEmailNotification(event, preferencesByUserId[userId])) {
        continue;
      }
      try {
        const to = await dependencies.getMemberEmail(userId);
        if (to !== null) {
          await dependencies.sendEmail({
            subject: copy.title,
            text: copy.body,
            to,
            workspaceId: event.workspaceId,
          });
        }
      } catch {
        // Email delivery is best-effort; it never undoes in-app fan-out.
      }
    }
  }

  return { inserted: planned.length };
}
