import "server-only";

import { apiKey, workspace } from "@supastack/db";
import { eq } from "drizzle-orm";

import { apiKeyStatus, hashApiKey, parseApiKeyScopes } from "./api-keys";
import type { ApiV1ApiKeyCaller, ApiV1Workspace } from "./api-v1-bff";
import { database } from "./auth-runtime";

export interface ApiKeyRecord {
  readonly expiresAt: Date | null;
  readonly id: string;
  readonly revokedAt: Date | null;
  readonly scopes: unknown;
  readonly userId: string;
  readonly workspaceId: string;
}

export interface ApiKeyAuthDependencies {
  findKeyByHash(keyHash: string): Promise<ApiKeyRecord | undefined>;
  findWorkspace(workspaceId: string): Promise<ApiV1Workspace | undefined>;
  now(): Date;
  touchLastUsed(keyId: string): Promise<void>;
}

/**
 * Resolves `Authorization: Bearer sk_*` callers. Returns `null` when no bearer
 * token is present (cookie-session auth may still apply on REST routes),
 * `"invalid"` for malformed/inactive keys, and the caller otherwise. Used by
 * the /api/v1 BFF and the /api/mcp endpoint — MCP rejects `null` outright.
 */
export function createApiKeyResolver(dependencies: ApiKeyAuthDependencies) {
  return async function resolveApiKey(
    headers: Headers,
  ): Promise<ApiV1ApiKeyCaller | "invalid" | null> {
    const authorization = headers.get("authorization");
    if (authorization === null) {
      return null;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    const token = match?.[1];
    if (token === undefined || !token.startsWith("sk_")) {
      return "invalid";
    }
    const row = await dependencies.findKeyByHash(hashApiKey(token));
    if (row === undefined || apiKeyStatus(row, dependencies.now()) !== "active") {
      return "invalid";
    }
    const keyWorkspace = await dependencies.findWorkspace(row.workspaceId);
    if (keyWorkspace === undefined) {
      return "invalid";
    }
    await dependencies.touchLastUsed(row.id);
    return {
      scopes: parseApiKeyScopes(row.scopes),
      userId: row.userId,
      workspace: keyWorkspace,
    };
  };
}

export const resolveApiKeyCaller = createApiKeyResolver({
  findKeyByHash: async (keyHash) => {
    const [row] = await database.select().from(apiKey).where(eq(apiKey.keyHash, keyHash)).limit(1);
    return row;
  },
  findWorkspace: async (workspaceId) => {
    const [row] = await database
      .select({
        createdAt: workspace.createdAt,
        name: workspace.name,
        workspaceId: workspace.id,
      })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    return row;
  },
  now: () => new Date(),
  touchLastUsed: async (keyId) => {
    await database.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, keyId));
  },
});
