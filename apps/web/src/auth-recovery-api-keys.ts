import { apiKey, type createPostgresDatabase } from "@supastack/db";
import { and, eq, isNull } from "drizzle-orm";

type RecoveryDatabase = Pick<
  ReturnType<typeof createPostgresDatabase>["database"],
  "select" | "update"
>;

export function createAuthRecoveryApiKeyRevoker(database: RecoveryDatabase) {
  return async (userId: string): Promise<void> => {
    const keys = await database
      .select({ id: apiKey.id, workspaceId: apiKey.workspaceId })
      .from(apiKey)
      .where(and(eq(apiKey.userId, userId), isNull(apiKey.revokedAt)));
    const now = new Date();
    for (const key of keys) {
      await database
        .update(apiKey)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(apiKey.id, key.id),
            eq(apiKey.userId, userId),
            eq(apiKey.workspaceId, key.workspaceId),
            isNull(apiKey.revokedAt),
          ),
        );
    }
  };
}
