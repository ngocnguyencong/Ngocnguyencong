import "server-only";

import { featureFlag, featureFlagOverride } from "@supastack/db";
import { eq } from "drizzle-orm";

import { database } from "./auth-runtime";
import { resolveFeatureFlag } from "./feature-flags";

/**
 * Resolves a flag for a caller context. Missing flags resolve to `false` so a
 * removed flag can never silently enable a surface.
 */
export async function isFeatureEnabled(
  key: string,
  context: Readonly<{ userId?: string; workspaceId?: string }> = {},
): Promise<boolean> {
  const [flag] = await database
    .select({ defaultEnabled: featureFlag.enabled, id: featureFlag.id })
    .from(featureFlag)
    .where(eq(featureFlag.key, key))
    .limit(1);
  if (flag === undefined) {
    return false;
  }
  const overrides = await database
    .select({
      enabled: featureFlagOverride.enabled,
      scopeId: featureFlagOverride.scopeId,
      scopeType: featureFlagOverride.scopeType,
    })
    .from(featureFlagOverride)
    .where(eq(featureFlagOverride.flagId, flag.id));
  const workspaceOverride =
    context.workspaceId === undefined
      ? null
      : (overrides.find(
          (entry) => entry.scopeType === "workspace" && entry.scopeId === context.workspaceId,
        )?.enabled ?? null);
  const userOverride =
    context.userId === undefined
      ? null
      : (overrides.find((entry) => entry.scopeType === "user" && entry.scopeId === context.userId)
          ?.enabled ?? null);
  return resolveFeatureFlag({
    defaultEnabled: flag.defaultEnabled,
    userOverride,
    workspaceOverride,
  });
}

/** Convenience for call sites that resolve several flags at once. */
export async function resolveFeatureFlags(
  keys: readonly string[],
  context: Readonly<{ userId?: string; workspaceId?: string }> = {},
): Promise<Record<string, boolean>> {
  const entries: Record<string, boolean> = {};
  for (const key of keys) {
    entries[key] = await isFeatureEnabled(key, context);
  }
  return entries;
}
