import type { DevicePushPlatform } from "@supastack/db";

export interface MobilePushToken {
  id: string;
  lastSeenAt: string;
  platform: DevicePushPlatform;
}

export interface MobilePushTokenSession {
  user: { id: string };
}

export interface MobilePushTokenWorkspace {
  workspaceId: string;
}

export interface MobilePushTokenDependencies {
  listForUser: (userId: string) => Promise<MobilePushToken[]>;
  register: (input: {
    platform: DevicePushPlatform;
    token: string;
    userId: string;
    workspaceId: string;
  }) => Promise<MobilePushToken>;
  getSession: (headers: Headers) => Promise<MobilePushTokenSession | null>;
  resolveWorkspace: (userId: string) => Promise<MobilePushTokenWorkspace | null>;
  unregister: (input: { token: string; userId: string }) => Promise<boolean>;
}

type BffErrorCode = "internalError" | "invalidInput" | "noWorkspace" | "unauthorized";

type BffError = {
  body: { error: { code: BffErrorCode; message: string } };
  status: 401 | 404 | 422 | 500;
};

export type MobilePushTokenListResponse =
  { body: { data: { tokens: MobilePushToken[] } }; status: 200 } | BffError;

export type MobilePushTokenRegisterResponse =
  { body: { data: { token: MobilePushToken } }; status: 201 } | BffError;

export type MobilePushTokenUnregisterResponse =
  { body: { data: { removed: boolean } }; status: 200 } | BffError;

function error(code: BffErrorCode, message: string, status: BffError["status"]): BffError {
  return { body: { error: { code, message } }, status };
}

function internalError(): BffError {
  return error("internalError", "The push tokens could not be loaded.", 500);
}

async function resolveSession(
  deps: MobilePushTokenDependencies,
  headers: Headers,
): Promise<MobilePushTokenSession | BffError> {
  const session = await deps.getSession(headers);
  if (session === null) {
    return error("unauthorized", "Sign in before managing push tokens.", 401);
  }
  return session;
}

const PLATFORMS: ReadonlySet<string> = new Set(["android", "ios", "web"]);

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const token = value.trim();
  return token.length > 0 && token.length <= 255 ? token : null;
}

function normalizePlatform(value: unknown): DevicePushPlatform | null {
  return typeof value === "string" && PLATFORMS.has(value) ? (value as DevicePushPlatform) : null;
}

/**
 * Authentication/workspace/validation boundary for `/api/mobile/push-tokens`,
 * defined independently of Next, Better Auth, or Drizzle so it can be
 * exercised with deterministic data. Every operation needs the caller's
 * session; only `register` also resolves the membership-verified active
 * workspace (token rows are stamped with it) — `list`/`unregister` are
 * scoped by `session.user.id` so an account with no resolvable workspace
 * can still read and delete its own tokens.
 */
export function createMobilePushTokensBff(deps: MobilePushTokenDependencies) {
  return {
    async list(headers: Headers): Promise<MobilePushTokenListResponse> {
      try {
        const session = await resolveSession(deps, headers);
        if ("body" in session) {
          return session;
        }
        const tokens = await deps.listForUser(session.user.id);
        return { body: { data: { tokens } }, status: 200 };
      } catch {
        return internalError();
      }
    },

    async register(
      headers: Headers,
      input: { platform?: unknown; token?: unknown },
    ): Promise<MobilePushTokenRegisterResponse> {
      try {
        const session = await resolveSession(deps, headers);
        if ("body" in session) {
          return session;
        }
        const workspace = await deps.resolveWorkspace(session.user.id);
        if (workspace === null) {
          return error("noWorkspace", "No workspace is available for this account.", 404);
        }
        const token = normalizeToken(input.token);
        const platform = normalizePlatform(input.platform);
        if (token === null || platform === null) {
          return error(
            "invalidInput",
            "A token of at most 255 characters and a platform of ios, android, or web are required.",
            422,
          );
        }
        const row = await deps.register({
          platform,
          token,
          userId: session.user.id,
          workspaceId: workspace.workspaceId,
        });
        return { body: { data: { token: row } }, status: 201 };
      } catch {
        return internalError();
      }
    },

    async unregister(
      headers: Headers,
      input: { token?: unknown },
    ): Promise<MobilePushTokenUnregisterResponse> {
      try {
        const session = await resolveSession(deps, headers);
        if ("body" in session) {
          return session;
        }
        const token = normalizeToken(input.token);
        if (token === null) {
          return error("invalidInput", "A valid push token is required.", 422);
        }
        const removed = await deps.unregister({
          token,
          userId: session.user.id,
        });
        return { body: { data: { removed } }, status: 200 };
      } catch {
        return internalError();
      }
    },
  };
}
