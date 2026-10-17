import "server-only";

import { randomUUID } from "node:crypto";
import { promises as dns } from "node:dns";
import { request as httpsRequest } from "node:https";

import { webhookDelivery, webhookEndpoint } from "@supastack/db";
import { isCorrelationId } from "@supastack/observability";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";

import { database } from "./auth-runtime";
import { serverObservability } from "./observability-runtime";
import {
  buildWebhookPayload,
  isPubliclyRoutableHost,
  isValidWebhookEndpointUrl,
  nextWebhookRetryAt,
  signWebhookPayload,
  stripIpv6Brackets,
} from "./webhooks";

const WEBHOOK_TIMEOUT_MS = 10_000;
/** Claim lease: the 10s delivery timeout plus margin for a crashed worker. */
const WEBHOOK_CLAIM_LEASE_MS = 30_000;

export interface WorkspaceEventInput {
  /**
   * Opaque `corr_<uuid>` minted at the request boundary that produced this
   * event (billing webhook receipt, AI task completion, …). Stored as
   * `webhook_delivery.payload.correlationId` so delivery rows, attempts, and
   * the terminal `webhook.delivery_failed` alert join back to that request.
   */
  correlationId?: string;
  data: Record<string, unknown>;
  eventType: string;
  workspaceId: string;
}

/**
 * Fans a product event out to every active workspace endpoint subscribed to
 * the type, records a delivery ledger row, then attempts delivery inline.
 * Failures stay `pending` with `nextAttemptAt` for the retry sweep.
 */
export async function emitWorkspaceEvent(input: WorkspaceEventInput): Promise<{
  deliveries: number;
}> {
  const endpoints = await database
    .select()
    .from(webhookEndpoint)
    .where(
      and(eq(webhookEndpoint.workspaceId, input.workspaceId), eq(webhookEndpoint.status, "active")),
    );
  const subscribed = endpoints.filter(
    (endpoint) => Array.isArray(endpoint.events) && endpoint.events.includes(input.eventType),
  );
  for (const endpoint of subscribed) {
    const deliveryId = `whd_${randomUUID()}`;
    const now = new Date();
    const payload = buildWebhookPayload({
      // Only a well-formed caller id propagates — a malformed one (empty,
      // whitespace, oversized, non-string) is dropped, never written
      // verbatim into the stored ledger payload.
      ...(isCorrelationId(input.correlationId) ? { correlationId: input.correlationId } : {}),
      data: input.data,
      eventType: input.eventType,
      id: deliveryId,
      timestamp: now,
      workspaceId: input.workspaceId,
    });
    await database.insert(webhookDelivery).values({
      attempts: 0,
      createdAt: now,
      endpointId: endpoint.id,
      eventType: input.eventType,
      id: deliveryId,
      // Due immediately — a crash before/inside the inline attempt must not
      // leave a NULL nextAttemptAt that the retry sweep can never pick up.
      nextAttemptAt: now,
      payload: payload as unknown as Record<string, unknown>,
      status: "pending",
      updatedAt: now,
      workspaceId: input.workspaceId,
    });
    await deliverWebhookDelivery(deliveryId);
  }
  return { deliveries: subscribed.length };
}

/**
 * Atomically claims a due `pending` row, then attempts one delivery on it.
 * Returns false when the claim found nothing — already delivered/failed,
 * not yet due, or leased by a concurrent pass.
 *
 * The claim bumps `attempts` and pushes `nextAttemptAt` to a lease horizon
 * in one statement guarded by `status='pending' AND still-due`, so the
 * sweep racing the inline emit attempt (or a second overlapping sweep) sees
 * no row — one row, one in-flight delivery. The completion writes are
 * guarded by `status='pending' AND attempts=<claimed attempt>`: a stale
 * attempt cannot overwrite a newer claim even while its row remains pending.
 * DNS and HTTPS share one deadline shorter than the lease. A crash before
 * completion leaves the row `pending` and claimable when the lease expires.
 *
 * Delivery-attempt outcomes are written to the row, not thrown — but the
 * claim and completion UPDATEs DO reject on a DB outage, so callers must
 * handle a rejection (`tryEmitWorkspaceEvent` and the sweep's callers do).
 */
export async function deliverWebhookDelivery(deliveryId: string): Promise<boolean> {
  const claimedAt = new Date();
  const [claim] = await database
    .update(webhookDelivery)
    .set({
      attempts: sql`${webhookDelivery.attempts} + 1`,
      nextAttemptAt: new Date(claimedAt.getTime() + WEBHOOK_CLAIM_LEASE_MS),
      updatedAt: claimedAt,
    })
    .where(
      and(
        eq(webhookDelivery.id, deliveryId),
        eq(webhookDelivery.status, "pending"),
        or(isNull(webhookDelivery.nextAttemptAt), lte(webhookDelivery.nextAttemptAt, claimedAt)),
      ),
    )
    .returning({ attempts: webhookDelivery.attempts });
  if (claim === undefined) {
    return false;
  }
  await runClaimedDelivery(deliveryId, claim.attempts);
  return true;
}

/** Context the terminal-failure alert needs — carried through the attempt. */
interface DeliveryAttemptContext {
  /** Emit-time `corr_<uuid>` stored on the ledger payload, when one exists. */
  correlationId?: string;
  eventType: string;
  workspaceId: string;
}

/** Runs the post-claim attempt; every outcome writes the lease away. */
async function runClaimedDelivery(deliveryId: string, attempts: number): Promise<void> {
  const [row] = await database
    .select({
      deliveryId: webhookDelivery.id,
      eventType: webhookDelivery.eventType,
      payload: webhookDelivery.payload,
      url: webhookEndpoint.url,
      secret: webhookEndpoint.secret,
      workspaceId: webhookDelivery.workspaceId,
    })
    .from(webhookDelivery)
    .innerJoin(webhookEndpoint, eq(webhookEndpoint.id, webhookDelivery.endpointId))
    .where(eq(webhookDelivery.id, deliveryId))
    .limit(1);
  if (row === undefined) {
    return; // endpoint cascade-deleted between claim and read
  }

  // The emit-time correlationId rides inside the stored payload meta — rows
  // written before correlation existed (or holding a non-object payload)
  // simply have none. Guarded: a null payload would TypeError on property
  // access here, outside the attempt try/catch.
  const storedCorrelationId =
    typeof row.payload === "object" && row.payload !== null ? row.payload.correlationId : undefined;
  const correlationId = typeof storedCorrelationId === "string" ? storedCorrelationId : undefined;
  const context: DeliveryAttemptContext = {
    ...(correlationId === undefined ? {} : { correlationId }),
    eventType: row.eventType,
    workspaceId: row.workspaceId,
  };

  const body = JSON.stringify(row.payload);
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(row.secret, timestampSeconds, body);
  const deadline = createDeliveryDeadline();

  try {
    // Delivery-time SSRF re-check: a hostname that passed registration can
    // later resolve to private space (DNS rebinding, edited rows). Any
    // private answer fails the delivery permanently — no retry budget is
    // burned on a target we would never fetch. A lookup ERROR is transient
    // and flows to the retryable catch below.
    const headers = {
      "content-type": "application/json",
      "x-webhook-id": row.deliveryId,
      "x-webhook-signature": signature,
      "x-webhook-timestamp": String(timestampSeconds),
    };
    let response: { ok: boolean; status: number };
    if (process.env.NODE_ENV === "production") {
      if (!isValidWebhookEndpointUrl(row.url, true)) {
        await markDeliveryFailed(deliveryId, attempts, null, "Invalid webhook endpoint URL.", {
          context,
          final: true,
        });
        return;
      }
      // URL hostnames keep IPv6 literal brackets — dns.lookup rejects them.
      const url = new URL(row.url);
      const lookupHost = stripIpv6Brackets(url.hostname);
      const resolved = await waitForSignal(
        dns.lookup(lookupHost, {
          all: true,
          verbatim: true,
        }),
        deadline.signal,
      );
      const blocked = resolved.find(({ address }) => !isPubliclyRoutableHost(address));
      if (blocked !== undefined) {
        await markDeliveryFailed(
          deliveryId,
          attempts,
          null,
          `Endpoint resolved to non-public address ${blocked.address}.`,
          { context, final: true },
        );
        return;
      }
      // Rotate within the validated set per attempt so one dead edge address
      // (unreachable v6, a dead multi-A leg) can't burn the whole budget.
      const target = resolved[(attempts - 1) % resolved.length];
      if (target === undefined) {
        await markDeliveryFailed(deliveryId, attempts, null, "Endpoint has no DNS addresses.", {
          context,
          final: true,
        });
        return;
      }
      // Keep the original URL hostname for TLS certificate verification and
      // Host, while the socket connects only to an address checked above.
      response = await postPinnedHttpsWebhook(
        url,
        lookupHost,
        target,
        headers,
        body,
        deadline.signal,
      );
    } else {
      response = await fetch(row.url, {
        body,
        headers,
        method: "POST",
        // Never replay the signed body at a redirect target.
        redirect: "manual",
        signal: deadline.signal,
      });
    }
    if (response.ok) {
      // Same status='pending' guard as markDeliveryFailed: a stale attempt
      // whose lease lapsed mid-flight must not resurrect a row the
      // re-claim already terminal-failed.
      await database
        .update(webhookDelivery)
        .set({
          attempts,
          deliveredAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
          responseCode: response.status,
          status: "delivered",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(webhookDelivery.id, deliveryId),
            eq(webhookDelivery.status, "pending"),
            eq(webhookDelivery.attempts, attempts),
          ),
        )
        .returning({ id: webhookDelivery.id });
      return;
    }
    await markDeliveryFailed(deliveryId, attempts, response.status, `HTTP ${response.status}`, {
      context,
    });
  } catch (error) {
    await markDeliveryFailed(
      deliveryId,
      attempts,
      null,
      error instanceof Error ? error.message : "Delivery failed.",
      { context },
    );
  } finally {
    deadline.clear();
  }
}

function createDeliveryDeadline(): Readonly<{ signal: AbortSignal; clear: () => void }> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error("Webhook delivery deadline exceeded.")),
    WEBHOOK_TIMEOUT_MS,
  );
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new Error("Webhook delivery deadline exceeded.");
}

/** Races non-abortable system DNS against the same network deadline. */
function waitForSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error instanceof Error ? error : new Error("Webhook DNS lookup failed."));
      },
    );
  });
}

function postPinnedHttpsWebhook(
  url: URL,
  lookupHost: string,
  target: { address: string; family: number },
  headers: Record<string, string>,
  body: string,
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    const request = httpsRequest(
      url,
      {
        agent: false,
        // Pinning the family keeps Node's lookup contract in the single-
        // address form (autoSelectFamily stays off) for the checked answer.
        family: target.family,
        headers,
        // The socket may only resolve the validated host — to the validated
        // address, never a fresh DNS answer (rebinding) or another name.
        lookup: (requested, _options, callback) => {
          if (requested !== lookupHost) {
            callback(
              Object.assign(new Error(`Blocked lookup for ${requested}.`), { code: "ENOTFOUND" }),
              "",
            );
            return;
          }
          callback(null, target.address, target.family);
        },
        method: "POST",
        signal,
      },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        incoming.resume();
        resolve({ ok: status >= 200 && status < 300, status });
      },
    );
    request.on("error", reject);
    if (signal.aborted) {
      reject(abortReason(signal));
      return;
    }
    request.end(body);
  });
}

/**
 * Records one failed attempt. `final: true` and an exhausted retry budget
 * both land on `status: "failed"`. The write is guarded by
 * `status='pending' AND attempts=<claimed attempt>` and returns the transitioned
 * row — a stale attempt updates nothing even while its newer claimant remains
 * pending.
 * The terminal `webhook.delivery_failed` alert therefore fires only when
 * this statement won the transition: once per row, enforced by the DB,
 * never per attempt. Retryable failures stay `pending` and alert-free:
 * retries are normal operation.
 */
async function markDeliveryFailed(
  deliveryId: string,
  attempts: number,
  responseCode: number | null,
  lastError: string,
  options: { context: DeliveryAttemptContext; final?: boolean },
): Promise<void> {
  const nextAttemptAt = options.final === true ? null : nextWebhookRetryAt(attempts, new Date());
  const transitioned = await database
    .update(webhookDelivery)
    .set({
      attempts,
      lastError: lastError.slice(0, 500),
      nextAttemptAt,
      responseCode,
      status: nextAttemptAt === null ? "failed" : "pending",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(webhookDelivery.id, deliveryId),
        eq(webhookDelivery.status, "pending"),
        eq(webhookDelivery.attempts, attempts),
      ),
    )
    .returning({ id: webhookDelivery.id });

  if (nextAttemptAt === null && transitioned.length > 0) {
    // Fire-and-forget, never awaited — the narrow gap between the terminal
    // UPDATE and this call means a crash in between loses the alert.
    // Inherent: the row's `failed` status is the source of truth.
    serverObservability.alert({
      context: {
        attempts,
        ...(options.context.correlationId === undefined
          ? {}
          : { correlationId: options.context.correlationId }),
        deliveryId,
        eventType: options.context.eventType,
        // Last HTTP status, or null when the failure never got a response
        // (DNS block, socket error) — operators see "died after N tries"
        // plus the last status without querying the row.
        responseCode,
        workspaceId: options.context.workspaceId,
      },
      // Stable template, never error.message: the alert body is sent verbatim
      // and delivery errors may carry provider internals.
      message: `Webhook delivery ${deliveryId} permanently failed for workspace ${options.context.workspaceId}`,
      name: "webhook.delivery_failed",
      // "critical" — retries are spent (or were never possible); nobody will
      // retry this delivery, so a human has to look.
      severity: "critical",
    });
  }
}

/** Best-effort emit after a successful primary write; never throws. */
export async function tryEmitWorkspaceEvent(input: WorkspaceEventInput): Promise<void> {
  try {
    await emitWorkspaceEvent(input);
  } catch {
    // Webhook fan-out must not undo the product action that produced the event.
  }
}

/**
 * Retry sweep for pending deliveries whose backoff has elapsed. NULL
 * nextAttemptAt rows (pre-fix ledger entries) are claimed too — otherwise
 * they would sit pending forever. The select is only a candidate list:
 * `deliverWebhookDelivery` re-checks and claims each row atomically, so an
 * overlapping pass skips rows already leased.
 */
export async function deliverDueWebhookDeliveries(now = new Date()): Promise<{
  attempted: number;
}> {
  const rows = await database
    .select({ id: webhookDelivery.id })
    .from(webhookDelivery)
    .where(
      and(
        eq(webhookDelivery.status, "pending"),
        or(isNull(webhookDelivery.nextAttemptAt), lte(webhookDelivery.nextAttemptAt, now)),
      ),
    )
    .limit(50);
  let attempted = 0;
  for (const row of rows) {
    if (await deliverWebhookDelivery(row.id)) {
      attempted += 1;
    }
  }
  return { attempted };
}
