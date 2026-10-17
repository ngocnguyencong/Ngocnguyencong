import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { userAppearance } from "./schema";
import type * as schema from "./schema";

type UserAppearanceDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one `user_appearance` row per user (`user_id` PK). */
export type UserAppearanceRow = typeof userAppearance.$inferSelect;

/** Stored snapshot: the opaque preferences JSON plus its last-write stamp. */
export type UserAppearanceRecord = Readonly<{
  preferences: unknown;
  updatedAt: Date;
}>;

/**
 * Per-user appearance preference store backing the cross-device theme sync.
 * Scoped by `userId` (not `workspaceId`) — appearance follows the account,
 * not the organization. The repository treats `preferences` as opaque JSON;
 * validating it against the theme catalogs is the web layer's job so a
 * removed pack/style can never corrupt the row.
 */
export interface UserAppearanceRepository {
  /** The user's stored snapshot, or `null` when they have never saved one. */
  get(userId: string): Promise<UserAppearanceRecord | null>;
  /** Inserts or replaces the snapshot; returns the persisted row projection. */
  upsert(userId: string, preferences: unknown): Promise<UserAppearanceRecord>;
}

export function createDrizzleUserAppearanceRepository(
  database: UserAppearanceDatabase,
): UserAppearanceRepository {
  return Object.freeze({
    async get(userId: string): Promise<UserAppearanceRecord | null> {
      const [row] = await database
        .select({
          preferences: userAppearance.preferences,
          updatedAt: userAppearance.updatedAt,
        })
        .from(userAppearance)
        .where(eq(userAppearance.userId, normalizeUserId(userId)))
        .limit(1);
      return row ?? null;
    },

    async upsert(userId: string, preferences: unknown): Promise<UserAppearanceRecord> {
      const scope = normalizeUserId(userId);
      const [row] = await database
        .insert(userAppearance)
        .values({ preferences, userId: scope })
        .onConflictDoUpdate({
          target: userAppearance.userId,
          set: { preferences, updatedAt: new Date() },
        })
        .returning({
          preferences: userAppearance.preferences,
          updatedAt: userAppearance.updatedAt,
        });
      if (row === undefined) {
        throw new Error("The appearance preferences were not saved.");
      }
      return row;
    },
  });
}

function normalizeUserId(userId: string): string {
  if (typeof userId !== "string" || userId.trim().length === 0) {
    throw new Error("A valid user id is required.");
  }
  return userId;
}
