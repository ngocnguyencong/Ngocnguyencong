import type { MobileApiClient } from "../api/client";

export interface MobileNotification {
  body: string;
  createdAt: string;
  id: string;
  read: boolean;
  title: string;
  type: string;
}

export interface NotificationPreferences {
  emailBilling: boolean;
  emailInvites: boolean;
  inAppProduct: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotification(value: unknown): value is MobileNotification {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.type === "string" &&
    typeof value.read === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isPreferences(value: unknown): value is NotificationPreferences {
  return (
    isRecord(value) &&
    typeof value.emailBilling === "boolean" &&
    typeof value.emailInvites === "boolean" &&
    typeof value.inAppProduct === "boolean"
  );
}

/** `/api/notifications` — inbox, mark-read, and preference toggles. */
export function createMobileNotificationActions(api: MobileApiClient) {
  return {
    async getPreferences(): Promise<NotificationPreferences> {
      const payload = await api.request<unknown>("/api/notifications?view=preferences");
      if (!isRecord(payload) || !isPreferences(payload.preferences)) {
        throw new Error("The notification preferences were invalid.");
      }
      return payload.preferences;
    },

    async list(): Promise<MobileNotification[]> {
      const payload = await api.request<unknown>("/api/notifications");
      if (!isRecord(payload) || !Array.isArray(payload.notifications)) {
        throw new Error("The notification list was invalid.");
      }
      return payload.notifications.filter(isNotification);
    },

    async markRead(notificationId: string): Promise<void> {
      await api.request("/api/notifications", {
        body: { id: notificationId },
        method: "PATCH",
      });
    },

    async updatePreferences(patch: Partial<NotificationPreferences>): Promise<void> {
      await api.request("/api/notifications", {
        body: { preferences: patch },
        method: "PATCH",
      });
    },
  };
}
