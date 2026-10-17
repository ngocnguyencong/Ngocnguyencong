import "server-only";

import { createDrizzlePushTokenRepository, isDevicePushPlatform } from "@supastack/db";

import { database, getAuthSession } from "./auth-runtime";
import { createMobilePushTokensBff, type MobilePushToken } from "./mobile-push-tokens-bff";
import { resolveMobileWorkspaceContext } from "./mobile-workspace-context";

const pushTokens = createDrizzlePushTokenRepository(database);

function toMobilePushToken(row: {
  id: string;
  lastSeenAt: Date;
  platform: string;
}): MobilePushToken {
  return {
    id: row.id,
    lastSeenAt: row.lastSeenAt.toISOString(),
    platform: isDevicePushPlatform(row.platform) ? row.platform : "web",
  };
}

/** Drizzle/session wiring for `/api/mobile/push-tokens`. */
export const mobilePushTokensBff = createMobilePushTokensBff({
  getSession: (headers) => getAuthSession(headers),
  listForUser: async (userId) => (await pushTokens.listForUser(userId)).map(toMobilePushToken),
  register: async (input) => toMobilePushToken(await pushTokens.register(input)),
  resolveWorkspace: resolveMobileWorkspaceContext,
  unregister: (input) => pushTokens.unregister(input),
});
