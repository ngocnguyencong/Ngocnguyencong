import "server-only";

import {
  apiKey,
  auditEvent,
  commerceOrder,
  commerceOrderItem,
  commerceProduct,
  contentEntry,
  creditBalance,
  creditTransaction,
  entitlement,
  featureRequest,
  jobSchedule,
  usageCounter,
  user,
  webhookDelivery,
  webhookEndpoint,
  workspace,
  workspaceAiPolicy,
  workspaceDomain,
  workspaceInvitation,
  workspaceMembership,
  workspaceUsageCap,
} from "@supastack/db";
import { and, desc, eq, gte } from "drizzle-orm";

import { database } from "./auth-runtime";

type WorkspaceExportDatabase = Pick<typeof database, "select">;

/** Usage counters older than this many monthly periods are trimmed. */
const USAGE_COUNTER_PERIODS = 12;
const WEBHOOK_DELIVERY_LIMIT = 100;
const AUDIT_EVENT_LIMIT = 1000;
const CREDIT_TRANSACTION_LIMIT = 1000;

/**
 * Owner/admin workspace data export. Secrets never leave the server: every
 * select list is explicit so credential columns can never ride along —
 * `provider_credential`, `connected_account` token envelopes, webhook
 * signing secrets, API-key hashes, invitation tokens, OAuth material, and
 * delivery payload bodies (which may echo subscriber secrets) are
 * intentionally excluded. Session rows are never workspace data and are
 * left out entirely.
 */
export async function buildWorkspaceExport(
  workspaceId: string,
  now: Date,
  db: WorkspaceExportDatabase = database,
) {
  const [workspaceRow] = await db
    .select({
      createdAt: workspace.createdAt,
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      type: workspace.type,
      updatedAt: workspace.updatedAt,
    })
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .limit(1);

  const members = await db
    .select({
      email: user.email,
      joinedAt: workspaceMembership.createdAt,
      name: user.name,
      role: workspaceMembership.role,
      userId: workspaceMembership.userId,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(eq(workspaceMembership.workspaceId, workspaceId))
    .orderBy(workspaceMembership.createdAt);

  // Pending invitations only — the token column is never selected.
  const invitations = await db
    .select({
      createdAt: workspaceInvitation.createdAt,
      email: workspaceInvitation.email,
      expiresAt: workspaceInvitation.expiresAt,
      id: workspaceInvitation.id,
      invitedByUserId: workspaceInvitation.invitedByUserId,
      role: workspaceInvitation.role,
      status: workspaceInvitation.status,
    })
    .from(workspaceInvitation)
    .where(
      and(
        eq(workspaceInvitation.workspaceId, workspaceId),
        eq(workspaceInvitation.status, "pending"),
      ),
    )
    .orderBy(workspaceInvitation.createdAt);

  const content = await db
    .select({
      body: contentEntry.body,
      createdAt: contentEntry.createdAt,
      createdBy: contentEntry.createdBy,
      excerpt: contentEntry.excerpt,
      id: contentEntry.id,
      locale: contentEntry.locale,
      publishedAt: contentEntry.publishedAt,
      requiredEntitlement: contentEntry.requiredEntitlement,
      slug: contentEntry.slug,
      status: contentEntry.status,
      title: contentEntry.title,
      type: contentEntry.type,
      updatedAt: contentEntry.updatedAt,
    })
    .from(contentEntry)
    .where(eq(contentEntry.workspaceId, workspaceId))
    .orderBy(contentEntry.createdAt);

  const products = await db
    .select({
      createdAt: commerceProduct.createdAt,
      currency: commerceProduct.currency,
      description: commerceProduct.description,
      id: commerceProduct.id,
      imageUrl: commerceProduct.imageUrl,
      inventory: commerceProduct.inventory,
      name: commerceProduct.name,
      priceCents: commerceProduct.priceCents,
      slug: commerceProduct.slug,
      status: commerceProduct.status,
      updatedAt: commerceProduct.updatedAt,
    })
    .from(commerceProduct)
    .where(eq(commerceProduct.workspaceId, workspaceId))
    .orderBy(commerceProduct.createdAt);

  const orderRows = await db
    .select({
      createdAt: commerceOrder.createdAt,
      currency: commerceOrder.currency,
      customerEmail: commerceOrder.customerEmail,
      id: commerceOrder.id,
      status: commerceOrder.status,
      totalCents: commerceOrder.totalCents,
      updatedAt: commerceOrder.updatedAt,
    })
    .from(commerceOrder)
    .where(eq(commerceOrder.workspaceId, workspaceId))
    .orderBy(desc(commerceOrder.createdAt));

  const orderItemRows = await db
    .select({
      createdAt: commerceOrderItem.createdAt,
      id: commerceOrderItem.id,
      orderId: commerceOrderItem.orderId,
      productId: commerceOrderItem.productId,
      productName: commerceOrderItem.productName,
      quantity: commerceOrderItem.quantity,
      unitPriceCents: commerceOrderItem.unitPriceCents,
    })
    .from(commerceOrderItem)
    .where(eq(commerceOrderItem.workspaceId, workspaceId))
    .orderBy(commerceOrderItem.createdAt);

  const itemsByOrder = new Map<string, typeof orderItemRows>();
  for (const item of orderItemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }
  const orders = orderRows.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));

  // Workspace schedules only — platform schedules have a NULL workspaceId
  // and are filtered out by the equality scope.
  const schedules = await db
    .select({
      createdAt: jobSchedule.createdAt,
      cron: jobSchedule.cron,
      enabled: jobSchedule.enabled,
      id: jobSchedule.id,
      input: jobSchedule.input,
      lastRunAt: jobSchedule.lastRunAt,
      missedRuns: jobSchedule.missedRuns,
      nextRunAt: jobSchedule.nextRunAt,
      type: jobSchedule.type,
      updatedAt: jobSchedule.updatedAt,
    })
    .from(jobSchedule)
    .where(eq(jobSchedule.workspaceId, workspaceId))
    .orderBy(jobSchedule.createdAt);

  // The signing secret is never selected.
  const webhookEndpoints = await db
    .select({
      createdAt: webhookEndpoint.createdAt,
      events: webhookEndpoint.events,
      id: webhookEndpoint.id,
      status: webhookEndpoint.status,
      updatedAt: webhookEndpoint.updatedAt,
      url: webhookEndpoint.url,
    })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.workspaceId, workspaceId))
    .orderBy(webhookEndpoint.createdAt);

  // Delivery metadata only — payload bodies may embed subscriber secrets.
  const webhookDeliveries = await db
    .select({
      attempts: webhookDelivery.attempts,
      createdAt: webhookDelivery.createdAt,
      deliveredAt: webhookDelivery.deliveredAt,
      endpointId: webhookDelivery.endpointId,
      eventType: webhookDelivery.eventType,
      id: webhookDelivery.id,
      lastError: webhookDelivery.lastError,
      nextAttemptAt: webhookDelivery.nextAttemptAt,
      responseCode: webhookDelivery.responseCode,
      status: webhookDelivery.status,
      updatedAt: webhookDelivery.updatedAt,
    })
    .from(webhookDelivery)
    .where(eq(webhookDelivery.workspaceId, workspaceId))
    .orderBy(desc(webhookDelivery.createdAt))
    .limit(WEBHOOK_DELIVERY_LIMIT);

  // Metadata only — key_hash is never selected.
  const apiKeys = await db
    .select({
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      id: apiKey.id,
      lastUsedAt: apiKey.lastUsedAt,
      name: apiKey.name,
      prefix: apiKey.prefix,
      revokedAt: apiKey.revokedAt,
      scopes: apiKey.scopes,
      userId: apiKey.userId,
    })
    .from(apiKey)
    .where(eq(apiKey.workspaceId, workspaceId))
    .orderBy(apiKey.createdAt);

  const domains = await db
    .select({
      createdAt: workspaceDomain.createdAt,
      hostname: workspaceDomain.hostname,
      id: workspaceDomain.id,
      lastCheckedAt: workspaceDomain.lastCheckedAt,
      providerHostnameId: workspaceDomain.providerHostnameId,
      sslStatus: workspaceDomain.sslStatus,
      status: workspaceDomain.status,
      updatedAt: workspaceDomain.updatedAt,
      verification: workspaceDomain.verification,
      verifiedAt: workspaceDomain.verifiedAt,
    })
    .from(workspaceDomain)
    .where(eq(workspaceDomain.workspaceId, workspaceId))
    .orderBy(workspaceDomain.createdAt);

  const featureRequests = await db
    .select({
      createdAt: featureRequest.createdAt,
      createdBy: featureRequest.createdBy,
      details: featureRequest.details,
      id: featureRequest.id,
      status: featureRequest.status,
      title: featureRequest.title,
      updatedAt: featureRequest.updatedAt,
      voteCount: featureRequest.voteCount,
    })
    .from(featureRequest)
    .where(eq(featureRequest.workspaceId, workspaceId))
    .orderBy(desc(featureRequest.voteCount));

  const [creditBalanceRow] = await db
    .select({
      balance: creditBalance.balance,
      updatedAt: creditBalance.updatedAt,
    })
    .from(creditBalance)
    .where(eq(creditBalance.workspaceId, workspaceId))
    .limit(1);

  const creditTransactions = await db
    .select({
      actorUserId: creditTransaction.actorUserId,
      amount: creditTransaction.amount,
      balanceAfter: creditTransaction.balanceAfter,
      createdAt: creditTransaction.createdAt,
      id: creditTransaction.id,
      kind: creditTransaction.kind,
      reason: creditTransaction.reason,
      referenceId: creditTransaction.referenceId,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.workspaceId, workspaceId))
    .orderBy(desc(creditTransaction.createdAt))
    .limit(CREDIT_TRANSACTION_LIMIT);

  const usageCaps = await db
    .select({
      cap: workspaceUsageCap.cap,
      createdAt: workspaceUsageCap.createdAt,
      key: workspaceUsageCap.key,
      updatedAt: workspaceUsageCap.updatedAt,
    })
    .from(workspaceUsageCap)
    .where(eq(workspaceUsageCap.workspaceId, workspaceId))
    .orderBy(workspaceUsageCap.key);

  const usagePeriodFloor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (USAGE_COUNTER_PERIODS - 1), 1),
  );
  const usageCounters = await db
    .select({
      key: usageCounter.key,
      periodStart: usageCounter.periodStart,
      updatedAt: usageCounter.updatedAt,
      used: usageCounter.used,
    })
    .from(usageCounter)
    .where(
      and(
        eq(usageCounter.workspaceId, workspaceId),
        gte(usageCounter.periodStart, usagePeriodFloor),
      ),
    )
    .orderBy(usageCounter.key, desc(usageCounter.periodStart));

  const [aiPolicyRow] = await db
    .select({
      keyMode: workspaceAiPolicy.keyMode,
      monthlyBudgetMicrounits: workspaceAiPolicy.monthlyBudgetMicrounits,
    })
    .from(workspaceAiPolicy)
    .where(eq(workspaceAiPolicy.workspaceId, workspaceId))
    .limit(1);

  const entitlements = await db
    .select({
      createdAt: entitlement.createdAt,
      expiresAt: entitlement.expiresAt,
      id: entitlement.id,
      key: entitlement.key,
      source: entitlement.source,
      sourceReference: entitlement.sourceReference,
      status: entitlement.status,
      updatedAt: entitlement.updatedAt,
    })
    .from(entitlement)
    .where(eq(entitlement.workspaceId, workspaceId))
    .orderBy(entitlement.createdAt);

  // metadata/ipAddress stay server-side — they can embed caller-supplied
  // detail that an export should not redistribute.
  const auditLog = await db
    .select({
      action: auditEvent.action,
      actorUserId: auditEvent.actorUserId,
      createdAt: auditEvent.createdAt,
      id: auditEvent.id,
      targetId: auditEvent.targetId,
      targetType: auditEvent.targetType,
    })
    .from(auditEvent)
    .where(eq(auditEvent.workspaceId, workspaceId))
    .orderBy(desc(auditEvent.createdAt))
    .limit(AUDIT_EVENT_LIMIT);

  return normalizeExportValue({
    aiPolicy: aiPolicyRow ?? null,
    apiKeys,
    auditLog,
    content,
    credits: {
      balance: creditBalanceRow?.balance ?? 0,
      transactions: creditTransactions,
      updatedAt: creditBalanceRow?.updatedAt ?? null,
    },
    domains,
    entitlements,
    exportedAt: now,
    featureRequests,
    format: "supastack.workspace-export",
    invitations,
    members,
    schedules,
    usage: { caps: usageCaps, counters: usageCounters },
    version: 1,
    webhooks: { deliveries: webhookDeliveries, endpoints: webhookEndpoints },
    workspace: workspaceRow ?? null,
    commerce: { orders, products },
  });
}

/**
 * Serializes the export into JSON-safe values: Date → ISO string and
 * bigint → decimal string (Postgres bigint columns like the AI budget).
 */
function normalizeExportValue<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as T;
  }
  if (typeof value === "bigint") {
    return value.toString() as T;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeExportValue) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeExportValue(entry)]),
    ) as T;
  }
  return value;
}
