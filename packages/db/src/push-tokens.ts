import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { devicePushToken } from "./schema";
import type * as schema from "./schema";

type PushTokenDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one device push token per registration (unique on `token`). */
export type DevicePushToken = typeof devicePushToken.$inferSelect;

export const DEVICE_PUSH_PLATFORMS = ["android", "ios", "web"] as const;
export type DevicePushPlatform = (typeof DEVICE_PUSH_PLATFORMS)[number];

/**
 * Per-user device cap — `register` prunes the oldest `lastSeenAt` rows past
 * it so a single account cannot grow the token surface unboundedly.
 */
export const MAX_PUSH_TOKENS_PER_USER = 20;
/** Bounded reads for fan-out (`sendUserPush`/`sendWorkspacePush`) and the list endpoint. */
export const PUSH_TOKEN_LIST_LIMIT = 500;

export function isDevicePushPlatform(value: unknown): value is DevicePushPlatform {
  return typeof value === "string" && (DEVICE_PUSH_PLATFORMS as readonly string[]).includes(value);
}

export interface RegisterPushTokenInput {
  readonly platform: DevicePushPlatform;
  readonly token: string;
  readonly userId: string;
  readonly workspaceId: string;
}

export interface UnregisterPushTokenInput {
  readonly token: string;
  readonly userId: string;
}

export interface PushTokenRepositoryDependencies {
  /** Defaults to `dpt_${randomUUID()}`. */
  readonly createId?: (() => string) | undefined;
  /** Defaults to `new Date()`. */
  readonly now?: (() => Date) | undefined;
}

/**
 * Device push tokens registered by signed-in users' devices. `token` is
 * unique, so `register` is an upsert that re-points an existing token at the
 * registering user/workspace — reinstalls and account switches update the row
 * instead of duplicating devices. Every query stays scoped (`userId`,
 * `workspaceId`, or an explicit token list) like every user-owned record.
 */
export interface PushTokenRepository {
  /**
   * Upserts `token` → `{userId, workspaceId, platform}`; bumps `lastSeenAt`.
   * Afterwards the caller's rows past {@link MAX_PUSH_TOKENS_PER_USER} are
   * pruned oldest-`lastSeenAt` first — the upserted token itself is never
   * evicted by its own call.
   */
  register(input: RegisterPushTokenInput): Promise<DevicePushToken>;
  /** Deletes the token row only when it belongs to `userId`. `true` when a row was removed. */
  unregister(input: UnregisterPushTokenInput): Promise<boolean>;
  listForUser(userId: string): Promise<DevicePushToken[]>;
  listForWorkspace(workspaceId: string): Promise<DevicePushToken[]>;
  listForUsers(userIds: readonly string[]): Promise<DevicePushToken[]>;
  /** Deletes rows by token value (Expo `DeviceNotRegistered` pruning). Returns rows removed. */
  removeTokens(tokens: readonly string[]): Promise<number>;
}

export function createDrizzlePushTokenRepository(
  database: PushTokenDatabase,
  dependencies: PushTokenRepositoryDependencies = {},
): PushTokenRepository {
  const createId = dependencies.createId ?? (() => `dpt_${randomUUID()}`);
  const now = dependencies.now ?? (() => new Date());

  return Object.freeze({
    async register(input: RegisterPushTokenInput): Promise<DevicePushToken> {
      const scope = normalizeRegisterInput(input);
      const seenAt = now();
      const [row] = await database
        .insert(devicePushToken)
        .values({
          id: createId(),
          lastSeenAt: seenAt,
          platform: scope.platform,
          token: scope.token,
          userId: scope.userId,
          workspaceId: scope.workspaceId,
        })
        .onConflictDoUpdate({
          target: devicePushToken.token,
          set: {
            lastSeenAt: seenAt,
            platform: scope.platform,
            userId: scope.userId,
            workspaceId: scope.workspaceId,
          },
        })
        .returning();
      if (row === undefined) {
        throw new Error("The push token was not registered.");
      }
      // Enforce the per-user cap: the user's OTHER tokens are ranked
      // newest-seen first, and everything past the budget the upserted row
      // leaves room for (MAX - 1) is deleted.
      const overflow = await database
        .select({ token: devicePushToken.token })
        .from(devicePushToken)
        .where(
          and(eq(devicePushToken.userId, scope.userId), ne(devicePushToken.token, scope.token)),
        )
        .orderBy(desc(devicePushToken.lastSeenAt))
        .offset(MAX_PUSH_TOKENS_PER_USER - 1);
      if (overflow.length > 0) {
        await database.delete(devicePushToken).where(
          inArray(
            devicePushToken.token,
            overflow.map((entry) => entry.token),
          ),
        );
      }
      return row;
    },

    async unregister(input: UnregisterPushTokenInput): Promise<boolean> {
      const scope = normalizeUnregisterInput(input);
      const removed = await database
        .delete(devicePushToken)
        .where(
          and(eq(devicePushToken.token, scope.token), eq(devicePushToken.userId, scope.userId)),
        )
        .returning({ id: devicePushToken.id });
      return removed.length > 0;
    },

    async listForUser(userId: string): Promise<DevicePushToken[]> {
      return await database
        .select()
        .from(devicePushToken)
        .where(eq(devicePushToken.userId, normalizeId(userId, "user")))
        .orderBy(asc(devicePushToken.createdAt))
        .limit(PUSH_TOKEN_LIST_LIMIT);
    },

    async listForWorkspace(workspaceId: string): Promise<DevicePushToken[]> {
      return await database
        .select()
        .from(devicePushToken)
        .where(eq(devicePushToken.workspaceId, normalizeId(workspaceId, "workspace")))
        .orderBy(asc(devicePushToken.createdAt))
        .limit(PUSH_TOKEN_LIST_LIMIT);
    },

    async listForUsers(userIds: readonly string[]): Promise<DevicePushToken[]> {
      const ids = normalizeIdList(userIds, "users");
      if (ids.length === 0) {
        return [];
      }
      return await database
        .select()
        .from(devicePushToken)
        .where(inArray(devicePushToken.userId, ids))
        .orderBy(asc(devicePushToken.createdAt));
    },

    async removeTokens(tokens: readonly string[]): Promise<number> {
      const values = normalizeTokenList(tokens);
      if (values.length === 0) {
        return 0;
      }
      const removed = await database
        .delete(devicePushToken)
        .where(inArray(devicePushToken.token, values))
        .returning({ id: devicePushToken.id });
      return removed.length;
    },
  });
}

function requireInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid push token input is required.");
  }
}

function normalizeId(value: string, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`A valid ${label} id is required.`);
  }
  return value;
}

function normalizeToken(token: string): string {
  if (typeof token !== "string") {
    throw new Error("A valid push token is required.");
  }
  const value = token.trim();
  if (value.length === 0 || value.length > 255) {
    throw new Error("A valid push token is required.");
  }
  return value;
}

function normalizeIdList(values: readonly string[], label: string): string[] {
  if (!Array.isArray(values)) {
    throw new Error(`A valid ${label} id list is required.`);
  }
  return values.map((value: string) => normalizeId(value, label.slice(0, -1)));
}

function normalizeTokenList(tokens: readonly string[]): string[] {
  if (!Array.isArray(tokens)) {
    throw new Error("A valid push token list is required.");
  }
  return tokens.map((token: string) => normalizeToken(token));
}

function normalizeRegisterInput(
  input: RegisterPushTokenInput,
): Readonly<{ platform: DevicePushPlatform; token: string; userId: string; workspaceId: string }> {
  requireInput(input);
  if (!isDevicePushPlatform(input.platform)) {
    throw new Error("A valid push token platform is required.");
  }
  return Object.freeze({
    platform: input.platform,
    token: normalizeToken(input.token),
    userId: normalizeId(input.userId, "user"),
    workspaceId: normalizeId(input.workspaceId, "workspace"),
  });
}

function normalizeUnregisterInput(
  input: UnregisterPushTokenInput,
): Readonly<{ token: string; userId: string }> {
  requireInput(input);
  return Object.freeze({
    token: normalizeToken(input.token),
    userId: normalizeId(input.userId, "user"),
  });
}
