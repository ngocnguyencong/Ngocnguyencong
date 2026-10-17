"use server";

import { randomUUID } from "node:crypto";

import { apiKey, AUDIT_ACTIONS } from "@supastack/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  apiKeyStatus,
  generateApiKey,
  isValidApiKeyName,
  parseApiKeyScopes,
  type ApiKeyScope,
} from "./api-keys";
import { recordAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import { requireWorkspaceManager } from "./workspace-access";

export interface WorkspaceApiKeyRow {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  status: "active" | "expired" | "revoked";
}

export async function listWorkspaceApiKeys(): Promise<{
  error?: string;
  keys: WorkspaceApiKeyRow[];
  manageable: boolean;
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, keys: [], manageable: false };
  }
  const rows = await database
    .select({
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      id: apiKey.id,
      lastUsedAt: apiKey.lastUsedAt,
      name: apiKey.name,
      prefix: apiKey.prefix,
      revokedAt: apiKey.revokedAt,
      scopes: apiKey.scopes,
    })
    .from(apiKey)
    .where(eq(apiKey.workspaceId, context.workspaceId))
    .orderBy(desc(apiKey.createdAt));
  const now = new Date();
  return {
    keys: rows.map((row) => ({
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      id: row.id,
      lastUsedAt: row.lastUsedAt,
      name: row.name,
      prefix: row.prefix,
      scopes: parseApiKeyScopes(row.scopes),
      status: apiKeyStatus(row, now),
    })),
    manageable: true,
  };
}

export type CreateApiKeyResult =
  { error: string; ok: false } | { keyId: string; ok: true; plaintext: string };

/**
 * Creates a workspace API key. The plaintext is returned exactly once for the
 * settings UI to display; only the sha256 hash is persisted.
 */
export async function createApiKeyAction(input: {
  expiresInDays?: number;
  name: string;
  scopes: string[];
}): Promise<CreateApiKeyResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const name = input.name.trim();
  if (!isValidApiKeyName(name)) {
    return { error: "A key name of 1-100 characters is required.", ok: false };
  }
  const scopes = parseApiKeyScopes(input.scopes);
  const expiresInDays =
    typeof input.expiresInDays === "number" && Number.isFinite(input.expiresInDays)
      ? Math.min(Math.max(Math.trunc(input.expiresInDays), 0), 3650)
      : 0;
  const generated = generateApiKey(process.env.NODE_ENV ?? "development");
  const keyId = `key_${randomUUID()}`;
  const now = new Date();
  await database.insert(apiKey).values({
    createdAt: now,
    expiresAt: expiresInDays > 0 ? new Date(now.getTime() + expiresInDays * 86_400_000) : null,
    id: keyId,
    keyHash: generated.keyHash,
    lastUsedAt: null,
    name,
    prefix: generated.prefix,
    revokedAt: null,
    scopes,
    updatedAt: now,
    userId: context.userId,
    workspaceId: context.workspaceId,
  });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.apiKeyCreated,
    actorUserId: context.userId,
    metadata: { name, prefix: generated.prefix, scopes },
    targetId: keyId,
    targetType: "api_key",
    workspaceId: context.workspaceId,
  });
  return { keyId, ok: true, plaintext: generated.plaintext };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    revalidatePath("/settings/developers");
    return;
  }
  const keyId = formData.get("keyId");
  if (typeof keyId !== "string" || keyId.length === 0) {
    return;
  }
  await database
    .update(apiKey)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(apiKey.id, keyId),
        eq(apiKey.workspaceId, context.workspaceId),
        isNull(apiKey.revokedAt),
      ),
    );
  await recordAuditEvent({
    action: AUDIT_ACTIONS.apiKeyRevoked,
    actorUserId: context.userId,
    targetId: keyId,
    targetType: "api_key",
    workspaceId: context.workspaceId,
  });
  revalidatePath("/settings/developers");
}
