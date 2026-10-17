export type MarkNotificationReadInput = Readonly<{
  notification: Readonly<{
    id: string;
    readAt: Date | null;
    userId: string;
    workspaceId: string;
  }> | null;
  now: () => Date;
  sessionUserId: string;
  workspaceId: string;
}>;

export type MarkNotificationReadResult = Readonly<{
  id: string;
  readAt: Date;
  updatedAt: Date;
}>;

/** Pure ownership check + readAt stamp for workspace-scoped mark-read. */
export function markNotificationReadRecord(
  input: MarkNotificationReadInput,
): MarkNotificationReadResult | null {
  const row = input.notification;
  if (row === null || row.userId !== input.sessionUserId || row.workspaceId !== input.workspaceId) {
    return null;
  }

  if (row.readAt !== null) {
    return { id: row.id, readAt: row.readAt, updatedAt: row.readAt };
  }

  const readAt = input.now();
  return { id: row.id, readAt, updatedAt: readAt };
}
