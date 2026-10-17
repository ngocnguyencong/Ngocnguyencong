import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dependencies = vi.hoisted(() => ({
  captureException: vi.fn(),
  limiterCheck: vi.fn(async () => ({
    allowed: true,
    limit: 30,
    remaining: 29,
    retryAfterSeconds: 0,
  })),
  tickScheduler: vi.fn(async () => ({
    claimed: 2,
    failed: 0,
    ran: 2,
    results: [
      { scheduleId: "sch_1", ok: true },
      { scheduleId: "sch_2", ok: true },
    ],
  })),
}));

vi.mock("./observability-runtime", () => ({
  serverObservability: {
    captureException: dependencies.captureException,
    track: vi.fn(),
  },
}));
vi.mock("./scheduler-runtime", () => ({
  tickScheduler: dependencies.tickScheduler,
}));
vi.mock("./rate-limit-runtime", () => ({
  schedulerTickLimiter: { check: dependencies.limiterCheck },
  trustedProxyCount: 0,
}));

const SECRET = "test-tick-secret";

function request(headers: Record<string, string> = {}, body?: string) {
  return new Request("https://app.example.test/api/internal/scheduler-tick", {
    body: body ?? null,
    headers,
    method: "POST",
  });
}

async function importRoute(secret: string | undefined) {
  vi.stubEnv("SCHEDULER_TICK_SECRET", secret ?? "");
  vi.resetModules();
  return import("../app/api/internal/scheduler-tick/route");
}

beforeEach(() => {
  dependencies.captureException.mockReset();
  dependencies.limiterCheck.mockReset();
  dependencies.limiterCheck.mockResolvedValue({
    allowed: true,
    limit: 30,
    remaining: 29,
    retryAfterSeconds: 0,
  });
  dependencies.tickScheduler.mockReset();
  dependencies.tickScheduler.mockResolvedValue({
    claimed: 2,
    failed: 0,
    ran: 2,
    results: [
      { scheduleId: "sch_1", ok: true },
      { scheduleId: "sch_2", ok: true },
    ],
  });
});

describe("POST /api/internal/scheduler-tick", () => {
  it("404s when SCHEDULER_TICK_SECRET is unset — the endpoint stays disabled", async () => {
    const { POST } = await importRoute(undefined);
    const response = await POST(request({ "x-scheduler-key": "anything" }));
    expect(response.status).toBe(404);
    expect(dependencies.tickScheduler).not.toHaveBeenCalled();
    expect(dependencies.limiterCheck).not.toHaveBeenCalled();
  });

  it("401s on a missing or wrong key", async () => {
    const { POST } = await importRoute(SECRET);

    expect((await POST(request())).status).toBe(401);
    expect((await POST(request({ "x-scheduler-key": "wrong" }))).status).toBe(401);
    // Same-prefix wrong-length keys must not throw (timingSafeEqual guard).
    expect((await POST(request({ "x-scheduler-key": `${SECRET}-extra` }))).status).toBe(401);
    expect(dependencies.tickScheduler).not.toHaveBeenCalled();
  });

  it("runs the tick and returns per-schedule results with no-store/noindex headers", async () => {
    const { POST } = await importRoute(SECRET);
    const response = await POST(request({ "x-scheduler-key": SECRET }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      claimed: 2,
      failed: 0,
      ran: 2,
      results: [
        { scheduleId: "sch_1", ok: true },
        { scheduleId: "sch_2", ok: true },
      ],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(dependencies.tickScheduler).toHaveBeenCalledOnce();
    expect(dependencies.tickScheduler).toHaveBeenCalledWith({});
  });

  it("forwards a validated {dryRun, limit} body to the tick", async () => {
    const { POST } = await importRoute(SECRET);
    const response = await POST(
      request({ "x-scheduler-key": SECRET }, JSON.stringify({ dryRun: true, limit: 5 })),
    );

    expect(response.status).toBe(200);
    expect(dependencies.tickScheduler).toHaveBeenCalledWith({ dryRun: true, limit: 5 });
  });

  it("400s on a malformed body or out-of-contract fields", async () => {
    const { POST } = await importRoute(SECRET);
    const authed = { "x-scheduler-key": SECRET };

    for (const body of [
      "not json{",
      JSON.stringify({ dryRun: "yes" }),
      JSON.stringify({ limit: 0 }),
      JSON.stringify({ limit: 101 }),
      JSON.stringify({ limit: 1.5 }),
      JSON.stringify({ limit: "10" }),
      JSON.stringify([]),
    ]) {
      const response = await POST(request(authed, body));
      expect(response.status).toBe(400);
    }
    expect(dependencies.tickScheduler).not.toHaveBeenCalled();
  });

  it("rate-limits the shared anonymous scheduler-tick bucket before auth", async () => {
    dependencies.limiterCheck.mockResolvedValue({
      allowed: false,
      limit: 30,
      remaining: 0,
      retryAfterSeconds: 42,
    });
    const { POST } = await importRoute(SECRET);
    const response = await POST(
      request({ "x-forwarded-for": "203.0.113.9", "x-scheduler-key": SECRET }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(dependencies.limiterCheck).toHaveBeenCalledWith("scheduler-tick:ip:unknown");
    expect(dependencies.tickScheduler).not.toHaveBeenCalled();
  });

  it("maps a tick failure to a generic 500 and captures the error", async () => {
    dependencies.tickScheduler.mockRejectedValue(new Error("postgres://secret"));
    const { POST } = await importRoute(SECRET);
    const response = await POST(request({ "x-scheduler-key": SECRET }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internalError");
    expect(JSON.stringify(body)).not.toContain("postgres://");
    expect(dependencies.captureException).toHaveBeenCalledOnce();
  });
});
