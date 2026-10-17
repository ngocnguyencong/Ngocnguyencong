import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  notification,
  notificationPreference,
  user,
  workspaceMembership,
  type NotificationPreferenceFlags,
} from "@supastack/db";

import { parseServerConfig } from "@supastack/config";

import { emitWorkspaceProductNotification } from "./notification-emit";
import type { NotificationProductEvent } from "./notification-events";
import { database } from "./auth-runtime";
import { sendUserPush } from "./push";
import { createServerTransactionalEmailSender } from "./server-provider-composition";

const serverConfig = parseServerConfig();
const notificationEmail = createServerTransactionalEmailSender(serverConfig.providers.email);

export async function emitProductNotificationForWorkspace(
  event: NotificationProductEvent,
  options: Readonly<{ excludeUserIds?: ReadonlyArray<string> }> = {},
): Promise<{ inserted: number }> {
  return emitWorkspaceProductNotification(
    event,
    {
      createId: () => `ntf_${randomUUID()}`,
      async getMemberEmail(userId) {
        const [row] = await database
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1);
        return row?.email ?? null;
      },
      now: () => new Date(),
      async listMemberUserIds(workspaceId) {
        const rows = await database
          .select({ userId: workspaceMembership.userId })
          .from(workspaceMembership)
          .where(eq(workspaceMembership.workspaceId, workspaceId));
        return rows.map((row) => row.userId);
      },
      async readPreferences(userId, workspaceId) {
        const [existing] = await database
          .select({
            emailBilling: notificationPreference.emailBilling,
            emailInvites: notificationPreference.emailInvites,
            inAppProduct: notificationPreference.inAppProduct,
          })
          .from(notificationPreference)
          .where(
            and(
              eq(notificationPreference.userId, userId),
              eq(notificationPreference.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        return existing
          ? ({
              emailBilling: existing.emailBilling,
              emailInvites: existing.emailInvites,
              inAppProduct: existing.inAppProduct,
            } satisfies NotificationPreferenceFlags)
          : null;
      },
      async insertNotification(row) {
        await database.insert(notification).values(row);
      },
      async sendEmail(input) {
        await notificationEmail.send({ ...input, category: "transactional" });
      },
      async sendPush(input) {
        await sendUserPush(input.userId, {
          body: input.body,
          ...(input.data !== undefined ? { data: input.data } : {}),
          title: input.title,
        });
      },
    },
    options,
  );
}

/** Best-effort emit after a successful primary write; never throws. */
export async function tryEmitProductNotification(
  event: NotificationProductEvent,
  options: Readonly<{ excludeUserIds?: ReadonlyArray<string> }> = {},
): Promise<void> {
  try {
    await emitProductNotificationForWorkspace(event, options);
  } catch {
    // Notification fan-out must not undo billing, invite, or AI outcomes.
  }
}
