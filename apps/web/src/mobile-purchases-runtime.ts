import "server-only";

import { parseServerConfig } from "@supastack/config";
import { entitlement, workspace } from "@supastack/db";
import { eq, sql } from "drizzle-orm";

import { database, getAuthSession } from "./auth-runtime";
import {
  createMobilePurchasesBff,
  createRevenueCatWebhookHandler,
  parseRevenueCatAccess,
  purchaseCustomerId,
  purchaseWorkspaceId,
} from "./mobile-purchases";
import { resolveMobileWorkspaceContext } from "./mobile-workspace-context";
import { createNamedRateLimiter } from "./rate-limit-runtime";

const config = parseServerConfig().mobilePurchases;
const syncLimiter = createNamedRateLimiter("mobile-purchases-sync", 20, 60_000, {
  failClosed: true,
});
const webhookLimiter = createNamedRateLimiter("revenuecat-webhook", 600, 60_000, {
  failClosed: true,
});

async function syncWorkspace(workspaceId: string): Promise<{ active: boolean }> {
  if (config.kind !== "revenuecat") throw new Error("Purchases unavailable.");
  if (!(await syncLimiter.check(workspaceId)).allowed)
    throw new Error("Purchase verification busy.");
  // Serialize retrieval and persistence so stale snapshots cannot be written in reverse order.
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`revenuecat:${workspaceId}`}))`,
    );
    const customerId = purchaseCustomerId(workspaceId);
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customerId)}`,
      {
        headers: { authorization: `Bearer ${config.secretApiKey}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      },
    );
    if (!response.ok) throw new Error("Purchase verification failed.");
    const access = parseRevenueCatAccess(
      (await response.json()) as unknown,
      config.entitlementId,
      config.allowSandbox,
    );
    await transaction
      .insert(entitlement)
      .values({
        id: `revenuecat:${workspaceId}:${config.entitlementKey}`,
        workspaceId,
        key: config.entitlementKey,
        source: "revenuecat",
        sourceReference: customerId,
        status: access.active ? "active" : "inactive",
        expiresAt: access.expiresAt,
      })
      .onConflictDoUpdate({
        target: [entitlement.workspaceId, entitlement.key, entitlement.source],
        set: {
          status: access.active ? "active" : "inactive",
          expiresAt: access.expiresAt,
          sourceReference: customerId,
          updatedAt: new Date(),
        },
      });
    return { active: access.active };
  });
}

export const mobilePurchasesBff = createMobilePurchasesBff({
  entitlementId: config.kind === "revenuecat" ? config.entitlementId : null,
  getSession: getAuthSession,
  resolveWorkspace: resolveMobileWorkspaceContext,
  syncWorkspace,
});

const handleWebhook = createRevenueCatWebhookHandler({
  authorization: config.kind === "revenuecat" ? config.webhookAuthorization : null,
  async syncCustomer(customerId) {
    const workspaceId = purchaseWorkspaceId(customerId);
    if (!workspaceId) return;
    const [existing] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    if (existing) await syncWorkspace(workspaceId);
  },
});

export async function handleRevenueCatWebhook(request: Request): Promise<Response> {
  if (!(await webhookLimiter.check("global")).allowed)
    return Response.json({ error: "Too many requests." }, { status: 429 });
  return handleWebhook(request);
}
