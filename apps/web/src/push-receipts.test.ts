import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PushTicket } from "@supastack/db";

import {
  EXPO_RECEIPT_CHUNK_SIZE,
  EXPO_RECEIPTS_ENDPOINT,
  reconcilePushReceipts,
} from "./push-receipts";

const NOW = new Date("2026-10-16T12:00:00.000Z");

function ticket(id: string, token = `ExponentPushToken[${id}]`, ageMinutes = 30): PushTicket {
  return {
    createdAt: new Date(NOW.getTime() - ageMinutes * 60_000),
    id,
    token,
    userId: "user_1",
  } as PushTicket;
}

function fakeRepos(due: PushTicket[]) {
  const removedTickets: string[][] = [];
  const removedTokens: string[][] = [];
  let expiredCount = 0;
  const ticketRepository = {
    listDue: vi.fn(async () => due),
    record: vi.fn(async () => due.length),
    remove: vi.fn(async (ids: readonly string[]) => {
      removedTickets.push([...ids]);
      return ids.length;
    }),
    removeOlderThan: vi.fn(async () => {
      expiredCount += 1;
      return 4;
    }),
  };
  const tokenRepository = {
    removeTokens: vi.fn(async (tokens: readonly string[]) => {
      removedTokens.push([...tokens]);
      return tokens.length;
    }),
  };
  return {
    expiredCount: () => expiredCount,
    removedTickets,
    removedTokens,
    ticketRepository,
    tokenRepository,
  };
}

function receiptsFetch(receiptsByCall: Record<string, unknown>[], status = 200) {
  const calls: { body: unknown; headers: Record<string, string>; url: string }[] = [];
  const transport = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      body: JSON.parse(String(init.body)),
      headers: init.headers as Record<string, string>,
      url,
    });
    const receipts = receiptsByCall[calls.length - 1] ?? {};
    return new Response(JSON.stringify({ data: receipts }), { status });
  }) as unknown as typeof fetch;
  return { calls, transport };
}

describe("reconcilePushReceipts", () => {
  it("posts due ticket ids to the Expo receipts endpoint", async () => {
    const due = [ticket("t1"), ticket("t2")];
    const { ticketRepository, tokenRepository } = fakeRepos(due);
    const { calls, transport } = receiptsFetch([{ t1: { status: "ok" }, t2: { status: "ok" } }]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(EXPO_RECEIPTS_ENDPOINT);
    expect(calls[0]?.body).toEqual({ ids: ["t1", "t2"] });
    expect(ticketRepository.listDue).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 15 * 60_000),
      1000,
    );
    expect(result).toEqual({ checked: 2, expired: 4, failedChunks: 0, pruned: 0 });
  });

  it("chunks receipt requests at 300 ids", async () => {
    const count = EXPO_RECEIPT_CHUNK_SIZE * 2 + 50;
    const due = Array.from({ length: count }, (_, i) => ticket(`t${i}`));
    const { ticketRepository, tokenRepository } = fakeRepos(due);
    const { calls, transport } = receiptsFetch([
      Object.fromEntries(due.slice(0, 300).map((t) => [t.id, { status: "ok" }])),
      Object.fromEntries(due.slice(300, 600).map((t) => [t.id, { status: "ok" }])),
      Object.fromEntries(due.slice(600).map((t) => [t.id, { status: "ok" }])),
    ]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(calls).toHaveLength(3);
    expect((calls[0]?.body as { ids: string[] }).ids).toHaveLength(300);
    expect((calls[2]?.body as { ids: string[] }).ids).toHaveLength(50);
    expect(result.checked).toBe(count);
  });

  it("prunes tokens whose receipt reports DeviceNotRegistered", async () => {
    const due = [ticket("t1", "ExponentPushToken[gone]"), ticket("t2")];
    const { removedTokens, ticketRepository, tokenRepository } = fakeRepos(due);
    const { transport } = receiptsFetch([
      {
        t1: { details: { error: "DeviceNotRegistered" }, status: "error" },
        t2: { status: "ok" },
      },
    ]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(removedTokens).toEqual([["ExponentPushToken[gone]"]]);
    expect(result.pruned).toBe(1);
  });

  it("does not prune tokens for other receipt errors but still clears the ticket", async () => {
    const due = [ticket("t1"), ticket("t2")];
    const { removedTickets, removedTokens, ticketRepository, tokenRepository } = fakeRepos(due);
    const { transport } = receiptsFetch([
      {
        t1: { details: { error: "MessageTooBig" }, status: "error" },
        t2: { status: "ok" },
      },
    ]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(removedTokens).toEqual([]);
    expect(removedTickets).toEqual([["t1", "t2"]]);
    expect(result.pruned).toBe(0);
    expect(result.checked).toBe(2);
  });

  it("sweeps tickets older than 24 hours even without receipts", async () => {
    const { ticketRepository, tokenRepository } = fakeRepos([]);
    const { calls, transport } = receiptsFetch([]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(calls).toHaveLength(0);
    expect(ticketRepository.removeOlderThan).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 24 * 60 * 60_000),
    );
    expect(result).toEqual({ checked: 0, expired: 4, failedChunks: 0, pruned: 0 });
  });

  it("isolates a failed chunk — later chunks still run and the failure is logged", async () => {
    const count = EXPO_RECEIPT_CHUNK_SIZE + 5;
    const due = Array.from({ length: count }, (_, i) => ticket(`t${i}`));
    const { ticketRepository, tokenRepository } = fakeRepos(due);
    const logger = { error: vi.fn() };
    let call = 0;
    const transport = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return new Response("oops", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          data: Object.fromEntries(due.slice(300).map((t) => [t.id, { status: "ok" }])),
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const result = await reconcilePushReceipts(
      { fetch: transport, logger, ticketRepository, tokenRepository },
      NOW,
    );

    expect(call).toBe(2);
    expect(result.failedChunks).toBe(1);
    expect(result.checked).toBe(5);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("receipt"),
      expect.objectContaining({ chunkSize: EXPO_RECEIPT_CHUNK_SIZE }),
    );
    // Tokens are never logged.
    for (const [, context] of logger.error.mock.calls) {
      expect(JSON.stringify(context)).not.toContain("ExponentPushToken");
    }
  });

  it("sends Authorization: Bearer when an access token is configured", async () => {
    const { ticketRepository, tokenRepository } = fakeRepos([ticket("t1")]);
    const { calls, transport } = receiptsFetch([{ t1: { status: "ok" } }]);

    await reconcilePushReceipts(
      {
        accessToken: "expo-access-token",
        fetch: transport,
        ticketRepository,
        tokenRepository,
      },
      NOW,
    );

    expect(calls[0]?.headers["Authorization"]).toBe("Bearer expo-access-token");
    expect(calls[0]?.headers["Accept"]).toBe("application/json");
    expect(calls[0]?.headers["Content-Type"]).toBe("application/json");
  });

  it("keeps tickets whose ids were absent from the receipts response", async () => {
    const due = [ticket("t1"), ticket("t2")];
    const { removedTickets, ticketRepository, tokenRepository } = fakeRepos(due);
    const { transport } = receiptsFetch([{ t1: { status: "ok" } }]);

    const result = await reconcilePushReceipts(
      { fetch: transport, ticketRepository, tokenRepository },
      NOW,
    );

    expect(removedTickets).toEqual([["t1"]]);
    expect(result.checked).toBe(1);
  });
});
