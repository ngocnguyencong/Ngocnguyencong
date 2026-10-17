import "server-only";

import {
  createDrizzleUserAppearanceRepository,
  type UserAppearanceRepository,
} from "@supastack/db";

import { database } from "./auth-runtime";
import { parseAppearancePreferences, type AppearancePreferences } from "./theme/appearance";

/** What an API route hands the client — preferences validated against the live catalogs. */
export type UserAppearanceSnapshot = Readonly<{
  preferences: AppearancePreferences | null;
  updatedAt: Date | null;
}>;

export type UserAppearanceStore = Readonly<{
  get(userId: string): Promise<UserAppearanceSnapshot>;
  save(
    userId: string,
    preferences: AppearancePreferences,
  ): Promise<{ preferences: AppearancePreferences; updatedAt: Date }>;
}>;

/**
 * Server-side accessor for `user_appearance`. A stored row whose JSON no
 * longer validates against the theme catalogs (a removed pack or style)
 * reads back as `preferences: null` — the row's `updatedAt` is still
 * reported so clients can reconcile stamps.
 */
export function createAppearanceSync(repository: UserAppearanceRepository): UserAppearanceStore {
  return Object.freeze({
    async get(userId: string): Promise<UserAppearanceSnapshot> {
      const row = await repository.get(userId);
      if (row === null) {
        return { preferences: null, updatedAt: null };
      }
      return {
        preferences: parseAppearancePreferences(row.preferences),
        updatedAt: row.updatedAt,
      };
    },

    async save(userId: string, preferences: AppearancePreferences) {
      const row = await repository.upsert(userId, preferences);
      return { preferences, updatedAt: row.updatedAt };
    },
  });
}

let store: UserAppearanceStore | null = null;
function appearanceStore(): UserAppearanceStore {
  store ??= createAppearanceSync(createDrizzleUserAppearanceRepository(database));
  return store;
}

export async function getUserAppearance(userId: string): Promise<UserAppearanceSnapshot> {
  return appearanceStore().get(userId);
}

export async function saveUserAppearance(
  userId: string,
  preferences: AppearancePreferences,
): Promise<{ preferences: AppearancePreferences; updatedAt: Date }> {
  return appearanceStore().save(userId, preferences);
}
