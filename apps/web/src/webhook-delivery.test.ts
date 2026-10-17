import type * as drizzleOrm from "drizzle-orm";
import type * as nodeDns from "node:dns";
import type * as nodeHttps from "node:https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Minimal drizzle chain duck: each select()...where() (or innerJoin().where())
 * pops one queued row-set; update().set() captures the set payload before a
 * terminal where(). where() results are thenable AND expose .limit() because
 * the emit query awaits where() while the deliver/sweep queries chain .limit().
 * The claim UPDATE additionally chains .returning() which pops updateResults —
 * an empty queue means the row was already claimed/lost and the delivery is
 * skipped.
 */
const db = vi.hoisted(() => {
  const insertValues: Record<string, unknown>[] = [];
  const selectResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  const updateSets: Record<string, unknown>[] = [];
  const whereConditions: unknown[] = [];

  const where = (condition: unknown) => {
    whereConditions.push(condition);
    const rows = selectResults.shift() ?? [];
    return Object.assign(Promise.resolve(rows), {
      limit: vi.fn(() => Promise.resolve(rows)),
    });
  };
  const database = {
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        insertValues.push(values);
        return Promise.resolve([]);
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({ where: vi.fn(where) })),
        where: vi.fn(where),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateSets.push(values);
        return {
          where: vi.fn(() =>
            Object.assign(Promise.resolve([]), {
              returning: vi.fn(() => Promise.resolve(updateResults.shift() ?? [])),
            }),
          ),
        };
      }),
    })),
  };
  return { database, insertValues, selectResults, updateResults, updateSets, whereConditions };
});
vi.mock("./auth-runtime", () => ({ database: db.database }));

const observability = vi.hoisted(() => ({
  alert: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: { alert: observability.alert },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof drizzleOrm>();
  return {
    ...actual,
    and: vi.fn(actual.and),
    eq: vi.fn(actual.eq),
    isNull: vi.fn(actual.isNull),
    lte: vi.fn(actual.lte),
    or: vi.fn(actual.or),
  };
});

const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns", async (importOriginal) => {
  const actual = await importOriginal<typeof nodeDns>();
  return { ...actual, promises: { ...actual.promises, lookup: dnsLookup } };
});

const httpsRequest = vi.hoisted(() => vi.fn());
vi.mock("node:https", async (importOriginal) => {
  const actual = await importOriginal<typeof nodeHttps>();
  return { ...actual, request: httpsRequest };
});

const fetchMock = vi.hoisted(() => vi.fn());

import { webhookDelivery } from "@supastack/db";
import { eq, isNull, lte, or } from "drizzle-orm";

import {
  deliverDueWebhookDeliveries,
  deliverWebhookDelivery,
  emitWorkspaceEvent,
} from "./webhook-delivery";

const NOW = new Date("2026-03-04T09:00:00.000Z");

const PENDING_ROW = {
  attempts: 0,
  deliveryId: "whd_1",
  eventType: "ping",
  payload: { id: "whd_1", type: "ping", workspaceId: "ws_1" },
  status: "pending",
  url: "https://hooks.example.com/h",
  secret: "whsec_x",
  workspaceId: "ws_1",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  db.insertValues.length = 0;
  db.selectResults.length = 0;
  db.updateResults.length = 0;
  db.updateSets.length = 0;
  db.whereConditions.length = 0;
  db.database.insert.mockClear();
  db.database.select.mockClear();
  db.database.update.mockClear();
  observability.alert.mockReset();
  dnsLookup.mockReset();
  httpsRequest.mockReset();
  fetchMock.mockReset();
  vi.mocked(eq).mockClear();
  vi.mocked(isNull).mockClear();
  vi.mocked(lte).mockClear();
  vi.mocked(or).mockClear();
});

describe("emitWorkspaceEvent", () => {
  it("inserts pending deliveries already due (nextAttemptAt=now) so the sweep can recover", async () => {
    db.selectResults.push([
      {
        events: ["member.joined"],
        id: "whe_1",
        status: "active",
        url: "https://hooks.example.com/h",
      },
      { events: ["invite.accepted"], id: "whe_2", status: "active" },
    ]);
    // Inline attempt: the claim UPDATE returns no row → delivery no-ops.

    await expect(
      emitWorkspaceEvent({
        data: { memberEmail: "a@b.test" },
        eventType: "member.joined",
        workspaceId: "ws_1",
      }),
    ).resolves.toEqual({ deliveries: 1 });

    expect(db.insertValues).toHaveLength(1);
    const row = db.insertValues[0]!;
    expect(row.status).toBe("pending");
    // A NULL nextAttemptAt is invisible to the retry sweep — the insert must
    // stamp it so a crash before/inside the inline attempt is recoverable.
    expect(row.nextAttemptAt).toEqual(row.createdAt);
    expect(row.nextAttemptAt).toEqual(expect.any(Date));
  });

  it("stamps the emit-time correlationId into the stored delivery payload meta", async () => {
    db.selectResults.push([
      {
        events: ["member.joined"],
        id: "whe_1",
        status: "active",
        url: "https://hooks.example.com/h",
      },
    ]);

    await emitWorkspaceEvent({
      correlationId: "corr_emit-1",
      data: { memberEmail: "a@b.test" },
      eventType: "member.joined",
      workspaceId: "ws_1",
    });

    expect(db.insertValues).toHaveLength(1);
    expect(db.insertValues[0]!.payload).toEqual(
      expect.objectContaining({
        correlationId: "corr_emit-1",
        type: "member.joined",
        workspaceId: "ws_1",
      }),
    );
  });

  it("leaves correlationId out of the payload meta when the caller has none", async () => {
    db.selectResults.push([
      {
        events: ["member.joined"],
        id: "whe_1",
        status: "active",
        url: "https://hooks.example.com/h",
      },
    ]);

    await emitWorkspaceEvent({
      data: { memberEmail: "a@b.test" },
      eventType: "member.joined",
      workspaceId: "ws_1",
    });

    expect(db.insertValues[0]!.payload).not.toHaveProperty("correlationId");
  });

  it("drops malformed correlationIds instead of writing them verbatim", async () => {
    const endpoint = {
      events: ["member.joined"],
      id: "whe_1",
      status: "active",
      url: "https://hooks.example.com/h",
    };
    db.selectResults.push([endpoint], [endpoint], [endpoint]);

    for (const correlationId of ["", "   ", "x".repeat(256)]) {
      await emitWorkspaceEvent({
        correlationId,
        data: {},
        eventType: "member.joined",
        workspaceId: "ws_1",
      });
    }

    expect(db.insertValues).toHaveLength(3);
    for (const row of db.insertValues) {
      expect(row.payload).not.toHaveProperty("correlationId");
    }
  });
});

describe("webhook.delivery_failed alerting", () => {
  /**
   * Queue one successful claim + row read + the completion write's
   * `status='pending'` transition result. `completion: []` simulates the
   * write losing the transition — the row was already delivered/failed by
   * a concurrent (re-claimed) attempt.
   */
  function claimOnce(
    attempts: number,
    row: Record<string, unknown> = PENDING_ROW,
    completion: unknown[] = [{ id: "whd_1" }],
  ): void {
    db.updateResults.push([{ attempts }]);
    db.selectResults.push([row]);
    db.updateResults.push(completion);
  }

  it("stays silent while a failed attempt still has retries left", async () => {
    claimOnce(1);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    // Retryable failure: the row stays pending with a backoff — retries are
    // normal operation and must not page anyone.
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: expect.any(Date), status: "pending" }),
    );
    expect(observability.alert).not.toHaveBeenCalled();
  });

  it("stays silent one attempt below exhaustion (attempts=4)", async () => {
    claimOnce(4);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: expect.any(Date), status: "pending" }),
    );
    expect(observability.alert).not.toHaveBeenCalled();
  });

  it("alerts once with the emit correlationId when retries are exhausted", async () => {
    claimOnce(5, {
      ...PENDING_ROW,
      payload: { ...PENDING_ROW.payload, correlationId: "corr_emit-1" },
    });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "failed" }),
    );
    expect(observability.alert).toHaveBeenCalledTimes(1);
    expect(observability.alert).toHaveBeenCalledWith({
      context: {
        attempts: 5,
        correlationId: "corr_emit-1",
        deliveryId: "whd_1",
        eventType: "ping",
        responseCode: 500,
        workspaceId: "ws_1",
      },
      // Stable text — never the thrown/provider error message.
      message: "Webhook delivery whd_1 permanently failed for workspace ws_1",
      name: "webhook.delivery_failed",
      severity: "critical",
    });
  });

  it("alerts once on a permanent pre-flight failure — no retry budget burned", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce(1, { ...PENDING_ROW, url: "http://hooks.example.com/h" });

    await deliverWebhookDelivery("whd_1");

    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "failed" }),
    );
    expect(observability.alert).toHaveBeenCalledTimes(1);
    expect(observability.alert).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          attempts: 1,
          deliveryId: "whd_1",
          eventType: "ping",
          responseCode: null,
          workspaceId: "ws_1",
        }),
        name: "webhook.delivery_failed",
        severity: "critical",
      }),
    );
    // No correlationId was stored on the legacy-shaped payload — the alert
    // context carries only keys that exist.
    expect(observability.alert.mock.calls[0]![0].context).not.toHaveProperty("correlationId");
  });

  it("does not alert when the delivery succeeds", async () => {
    claimOnce(1);
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhookDelivery("whd_1");

    expect(db.updateSets[1]).toEqual(expect.objectContaining({ status: "delivered" }));
    expect(observability.alert).not.toHaveBeenCalled();
  });

  it("does not re-alert when the terminal write loses — row already failed", async () => {
    // A stale attempt (lease lapsed mid-flight, row re-claimed and terminal-
    // failed by the newer attempt) finds its completion UPDATE returns
    // nothing: status is no longer 'pending'. It must stay silent — the
    // winning attempt already fired the one alert per row.
    claimOnce(5, PENDING_ROW, []);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    expect(observability.alert).not.toHaveBeenCalled();
  });

  it("keeps a delivered row delivered — a stale attempt's failed write is a silent no-op", async () => {
    // Same lost transition from the other direction: the re-claim delivered
    // while this stale attempt was still in flight; its failed write must
    // not clobber `delivered` → `failed` or alert for a webhook that
    // succeeded.
    claimOnce(5, PENDING_ROW, []);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    expect(observability.alert).not.toHaveBeenCalled();
  });

  it("guards both completion writes on status='pending'", async () => {
    claimOnce(1);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await deliverWebhookDelivery("whd_1");

    // Claim UPDATE + completion UPDATE each carry the guard.
    const statusPendingGuards = vi
      .mocked(eq)
      .mock.calls.filter(([col, val]) => col === webhookDelivery.status && val === "pending");
    expect(statusPendingGuards).toHaveLength(2);
  });

  it.each([
    ["successful", { ok: true, status: 200 }],
    ["failed", { ok: false, status: 500 }],
  ] as const)(
    "does not let a stale %s result overwrite a newer pending claim",
    async (_label, oldResponse) => {
      let resolveOld!: (response: { ok: boolean; status: number }) => void;
      let resolveNew!: (response: { ok: boolean; status: number }) => void;
      fetchMock
        .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
        .mockImplementationOnce(() => new Promise((resolve) => (resolveNew = resolve)));

      db.updateResults.push([{ attempts: 1 }]);
      db.selectResults.push([PENDING_ROW]);
      const oldAttempt = deliverWebhookDelivery("whd_1");
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      db.updateResults.push([{ attempts: 2 }]);
      db.selectResults.push([PENDING_ROW]);
      const newAttempt = deliverWebhookDelivery("whd_1");
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

      // The row remains pending while attempt 2 is in flight. Attempt 1 must
      // lose because its claimed attempt count no longer matches.
      db.updateResults.push([]);
      db.updateResults.push([{ id: "whd_1" }]);
      resolveOld(oldResponse);
      await oldAttempt;
      expect(db.updateSets[2]).toEqual(
        expect.objectContaining({ attempts: 1, status: oldResponse.ok ? "delivered" : "pending" }),
      );
      expect(
        vi
          .mocked(eq)
          .mock.calls.filter(([column]) => column === webhookDelivery.attempts)
          .map(([, value]) => value),
      ).toContain(1);

      resolveNew({ ok: true, status: 200 });
      await newAttempt;
      expect(db.updateSets[3]).toEqual(
        expect.objectContaining({ attempts: 2, status: "delivered" }),
      );
      expect(
        vi
          .mocked(eq)
          .mock.calls.filter(([column]) => column === webhookDelivery.attempts)
          .map(([, value]) => value),
      ).toContain(2);
      expect(observability.alert).not.toHaveBeenCalled();
    },
  );
});

describe("deliverDueWebhookDeliveries", () => {
  it("claims pending rows whose nextAttemptAt is NULL or already due", async () => {
    db.selectResults.push([{ id: "whd_1" }, { id: "whd_2" }]); // sweep select
    db.updateResults.push([{ attempts: 1 }]); // whd_1 claim
    db.selectResults.push([]); // whd_1 deliver read
    db.updateResults.push([{ attempts: 1 }]); // whd_2 claim
    db.selectResults.push([]); // whd_2 deliver read

    await expect(deliverDueWebhookDeliveries(NOW)).resolves.toEqual({ attempted: 2 });

    expect(or).toHaveBeenCalled();
    expect(isNull).toHaveBeenCalledWith(webhookDelivery.nextAttemptAt);
    expect(lte).toHaveBeenCalledWith(webhookDelivery.nextAttemptAt, NOW);
  });

  it("skips a row a concurrent pass already claimed — the claim UPDATE returns nothing", async () => {
    db.selectResults.push([{ id: "whd_1" }, { id: "whd_2" }]); // sweep select
    db.updateResults.push([]); // whd_1 loses the claim (already leased)
    db.updateResults.push([{ attempts: 4 }]); // whd_2 claim wins
    db.selectResults.push([]); // whd_2 deliver read

    await expect(deliverDueWebhookDeliveries(NOW)).resolves.toEqual({ attempted: 1 });
  });

  it("leases a claimed row past the in-flight window instead of leaving it due", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      db.selectResults.push([{ id: "whd_1" }]);
      db.updateResults.push([{ attempts: 1 }]);
      db.selectResults.push([]);

      await deliverDueWebhookDeliveries(NOW);

      // The claim bumps attempts and pushes nextAttemptAt to a lease horizon
      // (delivery timeout + margin) — NOT a retry backoff — so an overlapping
      // sweep no longer sees the row as due while a delivery is in flight.
      expect(db.updateSets[0]).toEqual(
        expect.objectContaining({
          nextAttemptAt: new Date(NOW.getTime() + 30_000),
          updatedAt: NOW,
        }),
      );
      expect(db.updateSets[0]).not.toHaveProperty("status");
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-claims a crashed delivery once its lease has expired", async () => {
    db.selectResults.push([{ id: "whd_1" }]);
    db.updateResults.push([{ attempts: 1 }]);
    db.selectResults.push([]);
    await expect(deliverDueWebhookDeliveries(NOW)).resolves.toEqual({ attempted: 1 });

    // A crash before the completion write leaves the row pending under the
    // lease; after expiry it is selected and atomically claimed again.
    const afterLease = new Date(NOW.getTime() + 31_000);
    db.selectResults.push([{ id: "whd_1" }]);
    db.updateResults.push([{ attempts: 2 }]);
    db.selectResults.push([]);
    await expect(deliverDueWebhookDeliveries(afterLease)).resolves.toEqual({ attempted: 1 });

    expect(db.database.update).toHaveBeenCalledTimes(2);
  });
});

describe("deliverWebhookDelivery — production DNS re-validation", () => {
  function mockHttpsResponse(statusCode: number): {
    end: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  } {
    const end = vi.fn();
    const resume = vi.fn();
    httpsRequest.mockImplementation((_url, _options, onResponse) => {
      onResponse({ resume, statusCode });
      return { end, on: vi.fn() };
    });
    return { end, resume };
  }

  /** Queue one successful claim + row read + completion-write win per attempt. */
  function claimOnce(attempts = 1, row: Record<string, unknown> = PENDING_ROW): void {
    db.updateResults.push([{ attempts }]);
    db.selectResults.push([row]);
    db.updateResults.push([{ id: "whd_1" }]); // completion write wins transition
  }

  it("times out an unresolved DNS lookup and never posts if it resolves late", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    let resolveDns!: (answers: { address: string; family: number }[]) => void;
    dnsLookup.mockReturnValue(new Promise((resolve) => (resolveDns = resolve)));

    const outcome = deliverWebhookDelivery("whd_1").then(
      () => "settled",
      () => "rejected",
    );
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await Promise.race([outcome, Promise.resolve("pending")])).toBe("settled");
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ attempts: 1, nextAttemptAt: expect.any(Date), status: "pending" }),
    );

    resolveDns([{ address: "93.184.216.34", family: 4 }]);
    await Promise.resolve();
    await Promise.resolve();
    expect(httpsRequest).not.toHaveBeenCalled();
  });

  it("shares the 10s deadline between DNS and pinned HTTPS", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 8_000),
        ),
    );

    let requestSignal!: AbortSignal;
    httpsRequest.mockImplementation((_url, options) => {
      requestSignal = (options as { signal: AbortSignal }).signal;
      let onError: ((error: Error) => void) | undefined;
      requestSignal.addEventListener("abort", () => onError?.(new Error("request timed out")));
      return {
        end: vi.fn(),
        on: vi.fn((event: string, handler: (error: Error) => void) => {
          if (event === "error") onError = handler;
        }),
      };
    });

    const outcome = deliverWebhookDelivery("whd_1").then(
      () => "settled",
      () => "rejected",
    );
    await vi.advanceTimersByTimeAsync(8_000);
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(db.updateSets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await Promise.race([outcome, Promise.resolve("pending")])).toBe("settled");
    expect(requestSignal.aborted).toBe(true);
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ attempts: 1, nextAttemptAt: expect.any(Date), status: "pending" }),
    );
  });

  it("fails permanently — no fetch, no retry — when the host resolves private", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

    await deliverWebhookDelivery("whd_1");

    expect(dnsLookup).toHaveBeenCalledWith("hooks.example.com", {
      all: true,
      verbatim: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ attempts: 1, nextAttemptAt: null, status: "failed" }),
    );
  });

  it("fails permanently when ANY resolved address is private", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.9", family: 4 },
    ]);

    await deliverWebhookDelivery("whd_1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "failed" }),
    );
  });

  it("keeps DNS lookup errors retryable instead of permanently failing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockRejectedValue(new Error("getaddrinfo ENOTFOUND hooks.example.com"));

    await deliverWebhookDelivery("whd_1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({
        attempts: 1,
        nextAttemptAt: expect.any(Date),
        status: "pending",
      }),
    );
  });

  it("delivers publicly-resolved endpoints in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const { end, resume } = mockHttpsResponse(200);

    await deliverWebhookDelivery("whd_1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(httpsRequest).toHaveBeenCalledWith(
      new URL(PENDING_ROW.url),
      expect.objectContaining({
        agent: false,
        family: 4,
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
      expect.any(Function),
    );
    // Response body is drained so the socket frees; the signed headers ride
    // on the pinned request options.
    expect(resume).toHaveBeenCalledTimes(1);
    const options = httpsRequest.mock.calls[0]![1] as {
      headers: Record<string, string>;
      lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void;
    };
    expect(options.headers).toEqual(
      expect.objectContaining({
        "content-type": "application/json",
        "x-webhook-id": "whd_1",
        "x-webhook-signature": expect.stringMatching(/^t=\d+,v1=[0-9a-f]{64}$/),
        "x-webhook-timestamp": expect.any(String),
      }),
    );
    expect(end).toHaveBeenCalledWith(JSON.stringify(PENDING_ROW.payload));
    const callback = vi.fn();
    options.lookup("hooks.example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "delivered" }),
    );
  });

  it("pins the socket to the preflight answer — no second DNS resolution can rebind", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    // Rebinding: the preflight answer is public, but a second resolution
    // inside the transport would hand back private space — prove the
    // connection can only ever use the first, validated answer.
    dnsLookup
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    mockHttpsResponse(200);

    await deliverWebhookDelivery("whd_1");

    expect(dnsLookup).toHaveBeenCalledTimes(1);
    const options = httpsRequest.mock.calls[0]![1] as {
      lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void;
    };
    // The pinned lookup replays the validated address for the validated host.
    const pinned = vi.fn();
    options.lookup("hooks.example.com", { family: 4, hints: 0 }, pinned);
    expect(pinned).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    // A different hostname is refused outright, still without touching DNS.
    const foreign = vi.fn();
    options.lookup("internal.example.com", {}, foreign);
    expect(foreign.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(dnsLookup).toHaveBeenCalledTimes(1);
    expect(db.updateSets[1]).toEqual(expect.objectContaining({ status: "delivered" }));
  });

  it("rotates the pinned target across the validated answers on each retry", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const answers = [
      { address: "93.184.216.34", family: 4 },
      { address: "8.8.8.8", family: 4 },
    ];
    dnsLookup.mockResolvedValue(answers);

    // Attempt 1 pins resolved[0]; the socket error keeps the row retryable.
    claimOnce(1);
    httpsRequest.mockImplementation(() => ({
      end: vi.fn(),
      on: vi.fn((event: string, handler: (error: Error) => void) => {
        if (event === "error") handler(new Error("connect ECONNREFUSED"));
      }),
    }));
    await deliverWebhookDelivery("whd_1");
    const firstOptions = httpsRequest.mock.calls[0]![1] as {
      lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void;
    };
    const first = vi.fn();
    firstOptions.lookup("hooks.example.com", {}, first);
    expect(first).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(db.updateSets.at(-1)).toEqual(expect.objectContaining({ status: "pending" }));

    // Attempt 2 pins resolved[1] — a dead edge no longer eats the whole
    // retry budget.
    claimOnce(2);
    mockHttpsResponse(200);
    await deliverWebhookDelivery("whd_1");
    const secondOptions = httpsRequest.mock.calls[1]![1] as {
      lookup: (host: string, options: object, callback: (...args: unknown[]) => void) => void;
    };
    const second = vi.fn();
    secondOptions.lookup("hooks.example.com", {}, second);
    expect(second).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    expect(db.updateSets.at(-1)).toEqual(expect.objectContaining({ status: "delivered" }));
  });

  it("strips IPv6 brackets before dns.lookup so public v6 endpoints deliver", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce(1, { ...PENDING_ROW, url: "https://[2606:4700::1]/h" });
    dnsLookup.mockResolvedValue([{ address: "2606:4700::1", family: 6 }]);
    mockHttpsResponse(200);

    await deliverWebhookDelivery("whd_1");

    // URL hostnames keep IPv6 brackets; dns.lookup rejects them.
    expect(dnsLookup).toHaveBeenCalledWith("2606:4700::1", {
      all: true,
      verbatim: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(httpsRequest).toHaveBeenCalledWith(
      new URL("https://[2606:4700::1]/h"),
      expect.objectContaining({ method: "POST" }),
      expect.any(Function),
    );
    expect(db.updateSets[1]).toEqual(expect.objectContaining({ status: "delivered" }));
  });

  it("rejects a stored insecure URL before resolving or connecting", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce(1, { ...PENDING_ROW, url: "http://hooks.example.com/h" });

    await deliverWebhookDelivery("whd_1");

    expect(dnsLookup).not.toHaveBeenCalled();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "failed" }),
    );
  });

  it("rejects an empty DNS answer before connecting", async () => {
    vi.stubEnv("NODE_ENV", "production");
    claimOnce();
    dnsLookup.mockResolvedValue([]);

    await deliverWebhookDelivery("whd_1");

    expect(httpsRequest).not.toHaveBeenCalled();
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({ nextAttemptAt: null, status: "failed" }),
    );
  });

  it("never follows redirects — a 3xx records its code instead of replaying the signed body", async () => {
    claimOnce(); // NODE_ENV=test → DNS guard off
    fetchMock.mockResolvedValue({ ok: false, status: 307 });

    await deliverWebhookDelivery("whd_1");

    // A public endpoint answering `Location: http://169.254.169.254/` must
    // not have undici replay the POST + signature headers to that target.
    expect(fetchMock).toHaveBeenCalledWith(
      PENDING_ROW.url,
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(db.updateSets[1]).toEqual(
      expect.objectContaining({
        lastError: "HTTP 307",
        responseCode: 307,
        status: "pending",
      }),
    );
  });

  it("skips the DNS guard outside production (localhost receivers stay deliverable)", async () => {
    claimOnce(1, { ...PENDING_ROW, url: "http://localhost:4000/hook" });
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await deliverWebhookDelivery("whd_1");

    expect(dnsLookup).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalled();
  });
});
