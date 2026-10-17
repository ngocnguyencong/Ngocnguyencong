export type NotificationPreferenceFlags = Readonly<{
  emailBilling: boolean;
  emailInvites: boolean;
  inAppProduct: boolean;
}>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferenceFlags = Object.freeze({
  emailBilling: true,
  emailInvites: true,
  inAppProduct: true,
});

export type CreateNotificationInput = Readonly<{
  body: string;
  createId: () => string;
  href?: string | null | undefined;
  now: () => Date;
  title: string;
  userId: string;
  workspaceId: string;
}>;

export function createNotificationRecord(input: CreateNotificationInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) {
    throw new Error("Notification title and body are required.");
  }
  if (!input.workspaceId || !input.userId) {
    throw new Error("Notification workspaceId and userId are required.");
  }

  const now = input.now();
  return {
    id: input.createId(),
    workspaceId: input.workspaceId,
    userId: input.userId,
    title,
    body,
    href: input.href?.trim() || null,
    readAt: null as Date | null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createNotificationPreferenceRecord(input: {
  now: () => Date;
  userId: string;
  workspaceId: string;
  flags?: Partial<NotificationPreferenceFlags> | undefined;
}) {
  if (!input.workspaceId || !input.userId) {
    throw new Error("Notification preference workspaceId and userId are required.");
  }
  const now = input.now();
  const flags = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...input.flags };
  return {
    userId: input.userId,
    workspaceId: input.workspaceId,
    emailInvites: flags.emailInvites,
    emailBilling: flags.emailBilling,
    inAppProduct: flags.inAppProduct,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeNotificationPreferences(
  current: NotificationPreferenceFlags | null | undefined,
  patch: Partial<NotificationPreferenceFlags>,
): NotificationPreferenceFlags {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...current,
    ...patch,
  };
}
