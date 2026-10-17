import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as AnalyticsModule from "../../../../src/analytics";

const deps = vi.hoisted(() => ({
  limiterCheck: vi.fn(),
  provider: vi.fn<() => "off" | "local" | "plausible" | "posthog">(),
  record: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../src/auth-runtime", () => ({ database: {} }));
vi.mock("../../../../src/observability-runtime", () => ({
  serverObservability: { captureException: vi.fn() },
}));
vi.mock("../../../../src/rate-limit-runtime", () => ({
  analyticsCollectLimiter: { check: deps.limiterCheck },
  trustedProxyCount: 1,
}));
vi.mock("../../../../src/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsModule>();
  return {
    ...actual,
    recordAnalyticsEvent: deps.record,
    resolveAnalyticsProvider: deps.provider,
  };
});

import { POST } from "./route";
import * as routeModule from "./route";

const collect = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://app.example.test/api/analytics/collect", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.8",
      ...headers,
    },
    method: "POST",
  });

beforeEach(() => {
  vi.clearAllMocks();
  deps.provider.mockReturnValue("local");
  deps.record.mockResolvedValue({});
  deps.limiterCheck.mockResolvedValue({
    allowed: true,
    limit: 600,
    remaining: 599,
    retryAfterSeconds: 0,
  });
});

describe("POST /api/analytics/collect", () => {
  it.each(["off", "plausible", "posthog"] as const)(
    "404s like it does not exist when ANALYTICS_PROVIDER=%s",
    async (provider) => {
      deps.provider.mockReturnValue(provider);
      const response = await POST(collect({ kind: "pageview", path: "/" }));
      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(deps.record).not.toHaveBeenCalled();
    },
  );

  it("exposes only POST — no other method is defined", () => {
    expect((routeModule as Record<string, unknown>).GET).toBeUndefined();
    expect((routeModule as Record<string, unknown>).PUT).toBeUndefined();
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined();
  });

  it.each([
    ["a non-object", "[]"],
    ["invalid JSON", "{"],
    ["a bad kind", { kind: "scroll", path: "/" }],
    ["a pageview without a path", { kind: "pageview" }],
    ["an event without a name", { kind: "event" }],
    ["an absolute-url path", { kind: "pageview", path: "https://evil.test/x?a=1" }],
    ["an over-long name", { kind: "event", name: "n".repeat(121) }],
  ])("400s on %s", async (_label, body) => {
    const response = await POST(collect(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalidBody" } });
    expect(deps.record).not.toHaveBeenCalled();
  });

  it("204s on a pageview and records exactly one event", async () => {
    const response = await POST(
      collect({ kind: "pageview", path: "/pricing", referrerHost: "https://google.com/q" }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(deps.record).toHaveBeenCalledTimes(1);
    expect(deps.record).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "pageview",
        path: "/pricing",
        referrerHost: "google.com",
        requestHeaders: expect.any(Headers),
      }),
    );
    // Nothing identity-shaped leaves the route — the header bag only feeds
    // the salted daily-rotating hash inside recordAnalyticsEvent.
    const [recorded] = deps.record.mock.calls[0]!;
    expect(recorded).not.toHaveProperty("ip");
    expect(recorded).not.toHaveProperty("userAgent");
    expect(recorded.workspaceId ?? null).toBeNull();
  });

  it("204s on a custom event", async () => {
    const response = await POST(collect({ kind: "event", name: "cta_click", path: "/" }));
    expect(response.status).toBe(204);
    expect(deps.record).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "event", name: "cta_click", path: "/" }),
    );
  });

  it("429s when the collect limiter is exhausted", async () => {
    deps.limiterCheck.mockResolvedValue({
      allowed: false,
      limit: 600,
      remaining: 0,
      retryAfterSeconds: 30,
    });
    const response = await POST(collect({ kind: "pageview", path: "/" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(deps.record).not.toHaveBeenCalled();
  });

  it("413s when the body exceeds the collect cap", async () => {
    const response = await POST(
      collect(JSON.stringify({ kind: "event", name: "n".repeat(120), pad: "x".repeat(4096) })),
    );
    expect(response.status).toBe(413);
    expect(deps.record).not.toHaveBeenCalled();
  });

  it("500s without leaking internals when the store write fails", async () => {
    deps.record.mockRejectedValue(new Error("db down"));
    const response = await POST(collect({ kind: "pageview", path: "/" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "internalError" } });
  });
});
