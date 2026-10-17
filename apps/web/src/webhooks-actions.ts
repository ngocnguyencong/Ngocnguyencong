"use server";

import { randomBytes, randomUUID } from "node:crypto";

import { AUDIT_ACTIONS, webhookDelivery, webhookEndpoint } from "@supastack/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import { requireWorkspaceManager } from "./workspace-access";
import { isValidWebhookEndpointUrl, isWebhookEventType, type WebhookEventType } from "./webhooks";

export interface WebhookEndpointRow {
  createdAt: Date;
  events: WebhookEventType[];
  id: string;
  status: string;
  url: string;
}

export interface WebhookDeliveryRow {
  attempts: number;
  createdAt: Date;
  deliveredAt: Date | null;
  eventType: string;
  id: string;
  lastError: string | null;
  responseCode: number | null;
  status: string;
}

export async function listWebhookEndpoints(): Promise<{
  endpoints: WebhookEndpointRow[];
  error?: string;
  manageable: boolean;
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { endpoints: [], error: context.error, manageable: false };
  }
  const rows = await database
    .select({
      createdAt: webhookEndpoint.createdAt,
      events: webhookEndpoint.events,
      id: webhookEndpoint.id,
      status: webhookEndpoint.status,
      url: webhookEndpoint.url,
    })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.workspaceId, context.workspaceId))
    .orderBy(desc(webhookEndpoint.createdAt));
  return {
    endpoints: rows.map((row) => ({
      ...row,
      events: row.events.filter(isWebhookEventType),
    })),
    manageable: true,
  };
}

export async function listWebhookDeliveries(endpointId: string): Promise<{
  deliveries: WebhookDeliveryRow[];
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { deliveries: [] };
  }
  const rows = await database
    .select({
      attempts: webhookDelivery.attempts,
      createdAt: webhookDelivery.createdAt,
      deliveredAt: webhookDelivery.deliveredAt,
      eventType: webhookDelivery.eventType,
      id: webhookDelivery.id,
      lastError: webhookDelivery.lastError,
      responseCode: webhookDelivery.responseCode,
      status: webhookDelivery.status,
    })
    .from(webhookDelivery)
    .where(
      and(
        eq(webhookDelivery.endpointId, endpointId),
        eq(webhookDelivery.workspaceId, context.workspaceId),
      ),
    )
    .orderBy(desc(webhookDelivery.createdAt))
    .limit(50);
  return { deliveries: rows };
}

export type CreateWebhookEndpointResult =
  { error: string; ok: false } | { endpointId: string; ok: true; secret: string };

/**
 * Creates an endpoint. The signing secret is returned once for display; it is
 * stored server-side only and used for `x-webhook-signature` HMAC headers.
 */
export async function createWebhookEndpointAction(input: {
  events: string[];
  url: string;
}): Promise<CreateWebhookEndpointResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const url = input.url.trim();
  const production = process.env.NODE_ENV === "production";
  if (!isValidWebhookEndpointUrl(url, production)) {
    return {
      error: production
        ? "A public https:// endpoint URL without credentials is required."
        : "An http(s):// endpoint URL without credentials is required.",
      ok: false,
    };
  }
  const events = [...new Set(input.events.filter(isWebhookEventType))].filter(
    (event) => event !== "ping",
  );
  if (events.length === 0) {
    return { error: "Subscribe to at least one event type.", ok: false };
  }
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  const endpointId = `whe_${randomUUID()}`;
  const now = new Date();
  await database.insert(webhookEndpoint).values({
    createdAt: now,
    events,
    id: endpointId,
    secret,
    status: "active",
    updatedAt: now,
    url,
    workspaceId: context.workspaceId,
  });
  await recordAuditEvent({
    action: AUDIT_ACTIONS.webhookEndpointCreated,
    actorUserId: context.userId,
    metadata: { events, url },
    targetId: endpointId,
    targetType: "webhook_endpoint",
    workspaceId: context.workspaceId,
  });
  return { endpointId, ok: true, secret };
}

/** Sends a `ping` event through the full delivery path for verification. */
export async function pingWebhookEndpointAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return;
  }
  const endpointId = formData.get("endpointId");
  if (typeof endpointId !== "string" || endpointId.length === 0) {
    return;
  }
  const [endpoint] = await database
    .select({ id: webhookEndpoint.id })
    .from(webhookEndpoint)
    .where(
      and(eq(webhookEndpoint.id, endpointId), eq(webhookEndpoint.workspaceId, context.workspaceId)),
    )
    .limit(1);
  if (endpoint === undefined) {
    return;
  }
  const { emitWorkspaceEvent } = await import("./webhook-delivery");
  await emitWorkspaceEvent({
    data: { endpointId, message: "ping" },
    eventType: "ping",
    workspaceId: context.workspaceId,
  });
  revalidatePath("/settings/developers");
}

export async function deleteWebhookEndpointAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return;
  }
  const endpointId = formData.get("endpointId");
  if (typeof endpointId !== "string" || endpointId.length === 0) {
    return;
  }
  const deleted = await database
    .delete(webhookEndpoint)
    .where(
      and(eq(webhookEndpoint.id, endpointId), eq(webhookEndpoint.workspaceId, context.workspaceId)),
    )
    .returning({ id: webhookEndpoint.id });
  if (deleted.length > 0) {
    await recordAuditEvent({
      action: AUDIT_ACTIONS.webhookEndpointDeleted,
      actorUserId: context.userId,
      targetId: endpointId,
      targetType: "webhook_endpoint",
      workspaceId: context.workspaceId,
    });
  }
  revalidatePath("/settings/developers");
}
