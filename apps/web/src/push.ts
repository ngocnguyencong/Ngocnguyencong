import "server-only";

import { parseServerConfig } from "@supastack/config";
import {
  createDrizzlePushTicketRepository,
  createDrizzlePushTokenRepository,
  type DevicePushToken,
  type PushTicketRepository,
  type PushTokenRepository,
} from "@supastack/db";

const serverConfig = parseServerConfig();

export const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
export const EXPO_PUSH_CHUNK_SIZE = 100;
const EXPO_TOKEN_PATTERN = /^ExponentPushToken\[[\w-]+\]$/;
const DEV_TOKEN_ENVIRONMENTS: ReadonlySet<string> = new Set(["local", "test"]);

export interface ExpoPushMessage {
  readonly body: string;
  /** Android notification channel created client-side. */
  readonly channelId?: string | undefined;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  readonly title: string;
  readonly to: string;
  /**
   * Internal bookkeeping only — the owning user of the token row the message
   * came from, threaded through so send tickets can be recorded for receipt
   * reconciliation. Never serialized into the Expo request body.
   */
  readonly userId?: string | undefined;
}

export interface ExpoPushTicket {
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  readonly id?: string | undefined;
  readonly message?: string | undefined;
  readonly status: "error" | "ok";
}

/** A ticket zipped with the token it was sent to — the pruning input. */
export interface ExpoPushReceipt {
  readonly ticket: ExpoPushTicket;
  readonly to: string;
}

export interface ExpoPushSendResult {
  /** Messages whose chunk POST/parse failed — logged, never retried. */
  readonly failed: ExpoPushMessage[];
  readonly receipts: ExpoPushReceipt[];
  /** Messages never posted — malformed or non-Expo tokens outside dev envs. */
  readonly skipped: ExpoPushMessage[];
}

/** Structured-logger surface chunk failures report through (`serverObservability.logger`). */
export interface ExpoPushFailureLogger {
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface ExpoPushSendDependencies {
  /** `EXPO_ACCESS_TOKEN` — authenticates the Expo push API when set. */
  readonly accessToken?: string | undefined;
  /** `APP_ENV` — non-Expo token strings are only sent when local/test. */
  readonly environment?: string | undefined;
  readonly fetch?: typeof fetch | undefined;
  /** Defaults to the lazily-resolved `serverObservability.logger`. */
  readonly logger?: ExpoPushFailureLogger | undefined;
  /**
   * Records `{id, token, userId}` for every `ok` ticket carrying an Expo
   * ticket id — the input the `push.receipts` job reconciles against the
   * receipts API. Absent → nothing is recorded (bare `sendExpoPush` stays
   * side-effect free; delivery entrypoints inject the repository).
   */
  readonly ticketRepository?: Pick<PushTicketRepository, "record"> | undefined;
}

export interface ExpoPushContent {
  readonly body: string;
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  readonly title: string;
}

export interface PushDeliveryDependencies extends ExpoPushSendDependencies {
  readonly repository?: PushTokenRepository | undefined;
  /** Defaults to the lazily-resolved drizzle push-ticket repository. */
  readonly ticketRepository?: Pick<PushTicketRepository, "record"> | undefined;
}

export interface PushDeliveryResult {
  /** Messages whose chunk POST/parse failed. */
  readonly failed: number;
  /** Tokens deleted after Expo reported `DeviceNotRegistered`. */
  readonly pruned: number;
  readonly receipts: ExpoPushReceipt[];
  readonly sent: number;
  readonly skipped: number;
}

/**
 * Only `ExponentPushToken[...]` values go to the Expo push API. Outside
 * local/test environments anything else — placeholder, dev token, or
 * corrupted row — is skipped instead of bounced off the provider.
 */
export function isSendablePushToken(token: string, environment?: string): boolean {
  if (EXPO_TOKEN_PATTERN.test(token)) {
    return true;
  }
  return DEV_TOKEN_ENVIRONMENTS.has(environment ?? "") && token.trim().length > 0;
}

/**
 * POSTs messages to the Expo push API in chunks of at most
 * {@link EXPO_PUSH_CHUNK_SIZE}, returning per-message tickets zipped with
 * their token. A failed chunk (transport error, non-2xx, malformed payload)
 * is collected in `failed` and logged — it never abandons the remaining
 * chunks, and there is no retry: delivery stays best-effort. When an access
 * token is configured (`EXPO_ACCESS_TOKEN`, overridable per call) every POST
 * carries `Authorization: Bearer <token>` — the token is never logged.
 */
export async function sendExpoPush(
  messages: readonly ExpoPushMessage[],
  dependencies: ExpoPushSendDependencies = {},
): Promise<ExpoPushSendResult> {
  requireMessageList(messages);
  const environment = dependencies.environment ?? serverConfig.app.environment;
  const accessToken = dependencies.accessToken ?? serverConfig.expo.accessToken;
  const post = dependencies.fetch ?? fetch;

  const sendable: ExpoPushMessage[] = [];
  const skipped: ExpoPushMessage[] = [];
  for (const message of messages) {
    if (isSendablePushToken(message.to, environment)) {
      sendable.push(message);
    } else {
      skipped.push(message);
    }
  }

  const receipts: ExpoPushReceipt[] = [];
  const failed: ExpoPushMessage[] = [];
  let failureLogger = dependencies.logger;
  for (let index = 0; index < sendable.length; index += EXPO_PUSH_CHUNK_SIZE) {
    const chunk = sendable.slice(index, index + EXPO_PUSH_CHUNK_SIZE);
    try {
      const response = await post(EXPO_PUSH_ENDPOINT, {
        body: JSON.stringify(
          chunk.map((message) => ({
            ...(message.channelId !== undefined ? { channelId: message.channelId } : {}),
            ...(message.data !== undefined ? { data: message.data } : {}),
            body: message.body,
            title: message.title,
            to: message.to,
          })),
        ),
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Expo push send failed with status ${response.status}.`);
      }
      const payload: unknown = await response.json();
      const tickets = readTicketList(payload);
      tickets.forEach((ticket, ticketIndex) => {
        const message = chunk[ticketIndex];
        if (message !== undefined) {
          receipts.push({ ticket, to: message.to });
        }
      });
      // `ok` tickets carrying an Expo ticket id are receipt handles — record
      // them so the `push.receipts` job can reconcile delivery later. Best
      // effort: a recording failure is logged, never a send failure.
      if (dependencies.ticketRepository !== undefined) {
        const records = tickets.flatMap((ticket, ticketIndex) => {
          const message = chunk[ticketIndex];
          if (ticket.status === "ok" && ticket.id !== undefined && message !== undefined) {
            return [{ id: ticket.id, token: message.to, userId: message.userId ?? null }];
          }
          return [];
        });
        if (records.length > 0) {
          try {
            await dependencies.ticketRepository.record(records);
          } catch (error) {
            failureLogger ??= await defaultPushLogger();
            failureLogger.error("Expo push ticket recording failed.", {
              error: error instanceof Error ? error.message : "unknown",
              tickets: records.length,
            });
          }
        }
      }
    } catch (error) {
      failed.push(...chunk);
      failureLogger ??= await defaultPushLogger();
      failureLogger.error("Expo push chunk delivery failed.", {
        chunkSize: chunk.length,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return { failed, receipts, skipped };
}

/** Sends a push to every device token `userId` has registered. */
export async function sendUserPush(
  userId: string,
  content: ExpoPushContent,
  dependencies: PushDeliveryDependencies = {},
): Promise<PushDeliveryResult> {
  const repository = dependencies.repository ?? (await defaultPushTokenRepository());
  const rows = await repository.listForUser(userId);
  return await deliverToRows(rows, content, dependencies, repository);
}

/** Sends a push to every device token registered under `workspaceId`. */
export async function sendWorkspacePush(
  workspaceId: string,
  content: ExpoPushContent,
  dependencies: PushDeliveryDependencies = {},
): Promise<PushDeliveryResult> {
  const repository = dependencies.repository ?? (await defaultPushTokenRepository());
  const rows = await repository.listForWorkspace(workspaceId);
  return await deliverToRows(rows, content, dependencies, repository);
}

async function deliverToRows(
  rows: readonly DevicePushToken[],
  content: ExpoPushContent,
  dependencies: ExpoPushSendDependencies,
  repository: PushTokenRepository,
): Promise<PushDeliveryResult> {
  const messages: ExpoPushMessage[] = rows.map((row) => ({
    ...(row.platform === "android" ? { channelId: "default" } : {}),
    ...(content.data !== undefined ? { data: content.data } : {}),
    body: content.body,
    title: content.title,
    to: row.token,
    userId: row.userId,
  }));
  const ticketRepository = dependencies.ticketRepository ?? (await defaultPushTicketRepository());
  const { failed, receipts, skipped } = await sendExpoPush(messages, {
    ...dependencies,
    ticketRepository,
  });

  const stale = receipts
    .filter(({ ticket }) => ticket.details?.["error"] === "DeviceNotRegistered")
    .map(({ to }) => to);
  const pruned = stale.length === 0 ? 0 : await repository.removeTokens(stale);

  return {
    failed: failed.length,
    pruned,
    receipts,
    sent: receipts.length,
    skipped: skipped.length,
  };
}

/** Lazy so tests and non-push paths never load the auth/database graph. */
async function defaultPushTokenRepository(): Promise<PushTokenRepository> {
  const { database } = await import("./auth-runtime");
  return createDrizzlePushTokenRepository(database);
}

/** Lazy for the same reason — only delivery paths resolve it. */
async function defaultPushTicketRepository(): Promise<PushTicketRepository> {
  const { database } = await import("./auth-runtime");
  return createDrizzlePushTicketRepository(database);
}

/** Lazy so tests and successful sends never load the observability graph. */
async function defaultPushLogger(): Promise<ExpoPushFailureLogger> {
  const { serverObservability } = await import("./observability-runtime");
  return serverObservability.logger;
}

function requireMessageList(messages: readonly ExpoPushMessage[]): void {
  if (!Array.isArray(messages)) {
    throw new Error("A valid push message list is required.");
  }
  for (const message of messages) {
    const candidate = message as Record<string, unknown> | null;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      typeof candidate["to"] !== "string" ||
      typeof candidate["title"] !== "string" ||
      typeof candidate["body"] !== "string"
    ) {
      throw new Error("A valid push message is required.");
    }
  }
}

function readTicketList(payload: unknown): ExpoPushTicket[] {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    throw new Error("The Expo push response was malformed.");
  }
  return (payload as { data: unknown[] }).data.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return { status: "error" as const };
    }
    const ticket = entry as {
      details?: Record<string, unknown> | undefined;
      id?: unknown;
      message?: unknown;
      status?: unknown;
    };
    return {
      ...(ticket.details !== undefined && typeof ticket.details === "object"
        ? { details: ticket.details }
        : {}),
      ...(typeof ticket.id === "string" ? { id: ticket.id } : {}),
      ...(typeof ticket.message === "string" ? { message: ticket.message } : {}),
      status: ticket.status === "ok" ? ("ok" as const) : ("error" as const),
    };
  });
}
