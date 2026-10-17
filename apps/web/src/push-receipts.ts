import "server-only";

import { parseServerConfig } from "@supastack/config";
import type { PushTicketRepository } from "@supastack/db";

import type { ExpoPushFailureLogger } from "./push";

const serverConfig = parseServerConfig();

export const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";
/** Expo accepts at most 300 ticket ids per receipts call. */
export const EXPO_RECEIPT_CHUNK_SIZE = 300;
/** Tickets younger than this still may not have a receipt — skip them. */
const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;
/** Unreconciled leftovers are dropped after this age regardless. */
const TICKET_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TICKET_BATCH_LIMIT = 1000;

export interface PushReceiptTokenRepository {
  removeTokens(tokens: readonly string[]): Promise<number>;
}

export interface PushReceiptReconcileDependencies {
  /** `EXPO_ACCESS_TOKEN` — same Bearer auth the send path uses. */
  readonly accessToken?: string | undefined;
  readonly fetch?: typeof fetch | undefined;
  /** Defaults to the lazily-resolved `serverObservability.logger`. */
  readonly logger?: ExpoPushFailureLogger | undefined;
  readonly ticketRepository: Pick<PushTicketRepository, "listDue" | "remove" | "removeOlderThan">;
  readonly tokenRepository: PushReceiptTokenRepository;
}

export interface PushReceiptReconcileResult {
  /** Tickets that received a receipt back (and were deleted). */
  readonly checked: number;
  /** Leftover tickets dropped for exceeding 24h without a receipt. */
  readonly expired: number;
  /** Receipt POSTs that failed — logged, never fatal to other chunks. */
  readonly failedChunks: number;
  /** Device tokens deleted after `DeviceNotRegistered` receipts. */
  readonly pruned: number;
}

interface ExpoReceipt {
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  readonly status: "error" | "ok";
}

function readReceiptMap(payload: unknown): Record<string, ExpoReceipt> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("The Expo receipts response was malformed.");
  }
  const data = (payload as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("The Expo receipts response was malformed.");
  }
  const receipts: Record<string, ExpoReceipt> = {};
  for (const [id, value] of Object.entries(data)) {
    if (typeof value !== "object" || value === null) continue;
    const receipt = value as { details?: Record<string, unknown>; status?: unknown };
    receipts[id] = {
      ...(receipt.details !== undefined && typeof receipt.details === "object"
        ? { details: receipt.details }
        : {}),
      status: receipt.status === "ok" ? "ok" : "error",
    };
  }
  return receipts;
}

/**
 * Reconciles recorded send tickets against Expo's receipts API: every
 * ticket due (older than 15 minutes, ≤1000 per run) is queried in ≤300-id
 * chunks, `DeviceNotRegistered` receipts prune their device token, every
 * ticket that got a receipt back is deleted, and leftovers older than 24h
 * are swept regardless. A failed chunk is logged — never tokens — and
 * does not abort later chunks. Best-effort like the send path.
 */
export async function reconcilePushReceipts(
  dependencies: PushReceiptReconcileDependencies,
  now: Date,
): Promise<PushReceiptReconcileResult> {
  const post = dependencies.fetch ?? fetch;
  const accessToken = dependencies.accessToken ?? serverConfig.expo.accessToken;
  let failureLogger = dependencies.logger;

  const due = await dependencies.ticketRepository.listDue(
    new Date(now.getTime() - RECEIPT_MIN_AGE_MS),
    TICKET_BATCH_LIMIT,
  );
  const tokensByTicket = new Map(due.map((row) => [row.id, row.token]));

  let checked = 0;
  let failedChunks = 0;
  let pruned = 0;
  const staleTokens: string[] = [];
  const answeredIds: string[] = [];

  for (let index = 0; index < due.length; index += EXPO_RECEIPT_CHUNK_SIZE) {
    const chunk = due.slice(index, index + EXPO_RECEIPT_CHUNK_SIZE);
    const ids = chunk.map((row) => row.id);
    try {
      const response = await post(EXPO_RECEIPTS_ENDPOINT, {
        body: JSON.stringify({ ids }),
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Expo receipt lookup failed with status ${response.status}.`);
      }
      const receipts = readReceiptMap(await response.json());
      for (const [ticketId, receipt] of Object.entries(receipts)) {
        answeredIds.push(ticketId);
        checked += 1;
        const token = tokensByTicket.get(ticketId);
        if (receipt.details?.["error"] === "DeviceNotRegistered" && token !== undefined) {
          staleTokens.push(token);
        }
      }
    } catch (error) {
      failedChunks += 1;
      failureLogger ??= await defaultPushLogger();
      failureLogger.error("Expo push receipt chunk failed.", {
        chunkSize: chunk.length,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  if (staleTokens.length > 0) {
    pruned = await dependencies.tokenRepository.removeTokens(staleTokens);
  }
  if (answeredIds.length > 0) {
    await dependencies.ticketRepository.remove(answeredIds);
  }
  const expired = await dependencies.ticketRepository.removeOlderThan(
    new Date(now.getTime() - TICKET_MAX_AGE_MS),
  );

  return { checked, expired, failedChunks, pruned };
}

/** Lazy so tests and non-push paths never load the observability graph. */
async function defaultPushLogger(): Promise<ExpoPushFailureLogger> {
  const { serverObservability } = await import("./observability-runtime");
  return serverObservability.logger;
}
