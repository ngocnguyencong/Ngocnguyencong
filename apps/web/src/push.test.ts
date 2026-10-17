import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PushTokenRepository } from "@supastack/db";

import {
  EXPO_PUSH_CHUNK_SIZE,
  EXPO_PUSH_ENDPOINT,
  isSendablePushToken,
  sendExpoPush,
  sendUserPush,
  sendWorkspacePush,
  type ExpoPushMessage,
} from "./push";

function fakeFetch(ticketList: unknown[], status = 200) {
  const calls: { body: unknown[]; headers: Record<string, string>; url: string }[] = [];
  const transport = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      body: JSON.parse(String(init.body)) as unknown[],
      headers: init.headers as Record<string, string>,
      url,
    });
    return new Response(JSON.stringify({ data: ticketList }), { status });
  }) as unknown as typeof fetch;
  return { calls, transport };
}

// `serverConfig` parses env once at module load — env-dependent cases re-import.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

function expoToken(index: number) {
  return `ExponentPushToken[tok${index}]`;
}

function messages(count: number): ExpoPushMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    body: `body ${index}`,
    title: `title ${index}`,
    to: expoToken(index),
  }));
}

function fakeRepository(rows: { platform: string; token: string; userId?: string }[] = []) {
  const removed: string[][] = [];
  const recorded: { id: string; token: string; userId: string | null }[][] = [];
  const repository: PushTokenRepository = {
    listForUser: async () => rows as never,
    listForUsers: async () => rows as never,
    listForWorkspace: async () => rows as never,
    register: async () => {
      throw new Error("not implemented");
    },
    removeTokens: async (tokens) => {
      removed.push([...tokens]);
      return tokens.length;
    },
    unregister: async () => false,
  };
  const ticketRepository = {
    record: async (tickets: { id: string; token: string; userId: string | null }[]) => {
      recorded.push(tickets.map((ticket) => ({ ...ticket })));
      return tickets.length;
    },
  };
  return { recorded, removed, repository, ticketRepository };
}

describe("isSendablePushToken", () => {
  it("accepts real Expo tokens everywhere", () => {
    expect(isSendablePushToken("ExponentPushToken[abc-123_]", "production")).toBe(true);
    expect(isSendablePushToken("ExponentPushToken[abc-123_]")).toBe(true);
  });

  it("rejects non-Expo tokens outside local/test but allows them there", () => {
    expect(isSendablePushToken("dev-token-1", "production")).toBe(false);
    expect(isSendablePushToken("dev-token-1", "development")).toBe(false);
    expect(isSendablePushToken("dev-token-1", "local")).toBe(true);
    expect(isSendablePushToken("dev-token-1", "test")).toBe(true);
    expect(isSendablePushToken("   ", "test")).toBe(false);
  });
});

describe("sendExpoPush", () => {
  it("chunks sends at 100 messages per request", async () => {
    const count = EXPO_PUSH_CHUNK_SIZE * 2 + 50;
    const { calls, transport } = fakeFetch([]);
    await sendExpoPush(messages(count), { fetch: transport });

    expect(calls).toHaveLength(3);
    expect(calls[0]?.body).toHaveLength(100);
    expect(calls[1]?.body).toHaveLength(100);
    expect(calls[2]?.body).toHaveLength(50);
    expect(calls[0]?.url).toBe(EXPO_PUSH_ENDPOINT);
    expect(calls[0]?.body[0]).toEqual({
      body: "body 0",
      title: "title 0",
      to: expoToken(0),
    });
  });

  it("returns tickets zipped with the token they were sent to", async () => {
    const { transport } = fakeFetch([
      { id: "receipt-1", status: "ok" },
      { details: { error: "DeviceNotRegistered" }, status: "error" },
    ]);
    const result = await sendExpoPush(messages(2), { fetch: transport });

    expect(result.receipts).toEqual([
      { ticket: { id: "receipt-1", status: "ok" }, to: expoToken(0) },
      {
        ticket: { details: { error: "DeviceNotRegistered" }, status: "error" },
        to: expoToken(1),
      },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("skips non-Expo tokens outside dev environments without a request", async () => {
    const { calls, transport } = fakeFetch([]);
    const result = await sendExpoPush(
      [
        { body: "b", title: "t", to: "not-an-expo-token" },
        { body: "b", title: "t", to: expoToken(0) },
      ],
      { environment: "production", fetch: transport },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.body).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.to).toBe("not-an-expo-token");
  });

  it("forwards data payloads and android channel ids", async () => {
    const { calls, transport } = fakeFetch([{ status: "ok" }]);
    await sendExpoPush(
      [
        {
          body: "b",
          channelId: "default",
          data: { href: "/alerts" },
          title: "t",
          to: expoToken(0),
        },
      ],
      { fetch: transport },
    );
    expect(calls[0]?.body[0]).toEqual({
      body: "b",
      channelId: "default",
      data: { href: "/alerts" },
      title: "t",
      to: expoToken(0),
    });
  });

  it("collects a failed chunk and keeps sending the rest", async () => {
    const count = EXPO_PUSH_CHUNK_SIZE * 3;
    const calls: number[] = [];
    const transport = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as unknown[];
      calls.push(body.length);
      if (calls.length === 2) {
        return new Response("{}", { status: 500 });
      }
      return new Response(JSON.stringify({ data: body.map(() => ({ status: "ok" })) }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    const logger = { error: vi.fn() };

    const result = await sendExpoPush(messages(count), { fetch: transport, logger });

    expect(calls).toEqual([100, 100, 100]);
    expect(result.receipts).toHaveLength(EXPO_PUSH_CHUNK_SIZE * 2);
    expect(result.failed.map((message) => message.to)).toEqual(
      messages(count)
        .slice(100, 200)
        .map((message) => message.to),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Expo push chunk delivery failed.",
      expect.objectContaining({ chunkSize: EXPO_PUSH_CHUNK_SIZE }),
    );
  });

  it("collects a malformed-payload chunk as failed instead of throwing", async () => {
    const badPayload = vi.fn(async () => new Response("{}", { status: 200 })) as never;
    const logger = { error: vi.fn() };

    const result = await sendExpoPush(messages(2), { fetch: badPayload, logger });

    expect(result.receipts).toEqual([]);
    expect(result.failed).toHaveLength(2);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("still rejects an invalid message list before sending", async () => {
    const badPayload = vi.fn(async () => new Response("{}", { status: 200 })) as never;
    await expect(sendExpoPush(null as never, { fetch: badPayload })).rejects.toThrow();
  });

  it("sends Authorization: Bearer when an access token is injected", async () => {
    const { calls, transport } = fakeFetch([{ status: "ok" }]);
    await sendExpoPush(messages(1), { accessToken: "expo-access-token", fetch: transport });

    expect(calls[0]?.headers["Authorization"]).toBe("Bearer expo-access-token");
  });

  it("defaults the Authorization token to the configured EXPO_ACCESS_TOKEN", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", "configured-expo-token");
    vi.resetModules();
    const { sendExpoPush: send } = await import("./push");

    const { calls, transport } = fakeFetch([{ status: "ok" }]);
    await send(messages(1), { fetch: transport });

    expect(calls[0]?.headers["Authorization"]).toBe("Bearer configured-expo-token");
  });

  it("omits the Authorization header when no access token is configured", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", undefined);
    vi.resetModules();
    const { sendExpoPush: send } = await import("./push");

    const { calls, transport } = fakeFetch([{ status: "ok" }]);
    await send(messages(1), { fetch: transport });

    expect(calls[0]?.headers).not.toHaveProperty("Authorization");
  });

  it("records ok tickets with their token and userId for receipt reconciliation", async () => {
    const { ticketRepository } = fakeRepository();
    const recorded: { id: string; token: string; userId: string | null }[][] = [];
    ticketRepository.record = async (tickets) => {
      recorded.push(tickets.map((ticket) => ({ ...ticket })));
      return tickets.length;
    };
    const { transport } = fakeFetch([
      { id: "receipt-1", status: "ok" },
      { status: "ok" }, // no ticket id — nothing to reconcile
      { details: { error: "DeviceNotRegistered" }, status: "error" },
    ]);
    const withUser: ExpoPushMessage[] = [
      { body: "b", title: "t", to: expoToken(0), userId: "user_a" },
      { body: "b", title: "t", to: expoToken(1) },
      { body: "b", title: "t", to: expoToken(2), userId: "user_a" },
    ];

    await sendExpoPush(withUser, { fetch: transport, ticketRepository });

    expect(recorded).toEqual([[{ id: "receipt-1", token: expoToken(0), userId: "user_a" }]]);
  });

  it("never serializes the internal userId field to Expo", async () => {
    const { calls, transport } = fakeFetch([{ id: "r1", status: "ok" }]);
    await sendExpoPush([{ body: "b", title: "t", to: expoToken(0), userId: "user_a" }], {
      fetch: transport,
    });

    expect(calls[0]?.body[0]).toEqual({ body: "b", title: "t", to: expoToken(0) });
    expect(JSON.stringify(calls[0]?.body)).not.toContain("user_a");
  });

  it("logs but does not fail the send when ticket recording fails", async () => {
    const logger = { error: vi.fn() };
    const { transport } = fakeFetch([{ id: "r1", status: "ok" }]);
    const ticketRepository = {
      record: async () => {
        throw new Error("db down");
      },
    };

    const result = await sendExpoPush(messages(1), {
      fetch: transport,
      logger,
      ticketRepository,
    });

    expect(result.receipts).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Expo push ticket recording failed.",
      expect.objectContaining({ tickets: 1 }),
    );
  });
});

describe("sendUserPush / sendWorkspacePush", () => {
  it("sends to every token the repository resolves and prunes DeviceNotRegistered", async () => {
    const rows = [
      { platform: "ios", token: expoToken(0) },
      { platform: "android", token: expoToken(1) },
      { platform: "ios", token: expoToken(2) },
    ];
    const { removed, repository, ticketRepository } = fakeRepository(rows);
    const { calls, transport } = fakeFetch([
      { status: "ok" },
      { details: { error: "DeviceNotRegistered" }, status: "error" },
      { details: { error: "MessageTooBig" }, status: "error" },
    ]);

    const result = await sendUserPush(
      "user_1",
      { body: "Hello", data: { href: "/alerts" }, title: "Hi" },
      { fetch: transport, repository, ticketRepository },
    );

    expect(calls[0]?.body.map((m) => (m as { to: string }).to)).toEqual([
      expoToken(0),
      expoToken(1),
      expoToken(2),
    ]);
    // Android rows get the default channel; iOS rows don't.
    expect(calls[0]?.body[1]).toEqual(expect.objectContaining({ channelId: "default" }));
    expect(calls[0]?.body[0]).not.toHaveProperty("channelId");
    expect(removed).toEqual([[expoToken(1)]]);
    expect(result).toEqual(expect.objectContaining({ failed: 0, pruned: 1, sent: 3, skipped: 0 }));
  });

  it("reports failed chunks in the delivery result", async () => {
    const { repository, ticketRepository } = fakeRepository([
      { platform: "ios", token: expoToken(0) },
    ]);
    const logger = { error: vi.fn() };
    const transport = vi.fn(
      async () => new Response("{}", { status: 502 }),
    ) as unknown as typeof fetch;

    const result = await sendUserPush(
      "user_1",
      { body: "b", title: "t" },
      { fetch: transport, logger, repository, ticketRepository },
    );

    expect(result).toEqual(expect.objectContaining({ failed: 1, sent: 0 }));
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("scopes workspace sends to listForWorkspace and prunes nothing on clean tickets", async () => {
    const rows = [{ platform: "web", token: expoToken(9) }];
    const { removed, repository, ticketRepository } = fakeRepository(rows);
    const { transport } = fakeFetch([{ status: "ok" }]);

    const result = await sendWorkspacePush(
      "ws_1",
      { body: "b", title: "t" },
      { fetch: transport, repository, ticketRepository },
    );

    expect(result.sent).toBe(1);
    expect(result.pruned).toBe(0);
    expect(removed).toEqual([]);
  });
});
