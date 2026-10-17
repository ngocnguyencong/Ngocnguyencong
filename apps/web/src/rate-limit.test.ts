import { describe, expect, it, vi } from "vitest";

import { createRateLimiter, createStoreRateLimiter, rateLimitKeyForRequest } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit inside a fixed window then blocks", async () => {
    const now = 1_000;
    const limiter = createRateLimiter({ limit: 3, now: () => now, windowMs: 60_000 });

    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(true);
    const third = await limiter.check("k");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = await limiter.check("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await limiter.check("other")).allowed).toBe(true);
  });

  it("resets after the window rolls over", async () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 1, now: () => now, windowMs: 1_000 });
    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(false);
    now = 1_001;
    expect((await limiter.check("k")).allowed).toBe(true);
  });

  it("bounds distinct in-memory keys and reclaims expired buckets", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 1,
      maxBuckets: 2,
      now: () => now,
      windowMs: 1_000,
    });
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
    expect((await limiter.check("c")).allowed).toBe(false);
    expect((await limiter.check("a")).allowed).toBe(false);
    now = 1_001;
    expect((await limiter.check("c")).allowed).toBe(true);
  });

  it("reuses an existing expired key even when the map is at maxBuckets", async () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 1,
      maxBuckets: 2,
      now: () => now,
      windowMs: 1_000,
    });
    await limiter.check("a");
    await limiter.check("b"); // map is now full
    now = 1_001;
    // 'a' already holds a slot — expiry resets it without needing a free one.
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false); // limit still applies
  });

  it("rejects a non-finite maxBuckets instead of silently disabling the cap", () => {
    expect(() =>
      createRateLimiter({ limit: 1, maxBuckets: Number.NaN, windowMs: 1_000 }),
    ).toThrow();
    expect(() =>
      createRateLimiter({ limit: 1, maxBuckets: Number.POSITIVE_INFINITY, windowMs: 1_000 }),
    ).toThrow();
  });
});

describe("createStoreRateLimiter", () => {
  it("maps store hits to rate-limit results", async () => {
    const now = new Date("2026-09-05T12:00:00.000Z");
    const expires = new Date(now.getTime() + 60_000);
    const hits: string[] = [];
    let count = 0;
    const store = {
      hit: vi.fn(async (key: string) => {
        hits.push(key);
        count += 1;
        return { count, expiresAt: expires };
      }),
    };
    const limiter = createStoreRateLimiter({
      limit: 2,
      name: "api-v1",
      now: () => now,
      store,
      windowMs: 60_000,
    });

    expect(await limiter.check("caller")).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      retryAfterSeconds: 0,
    });
    expect((await limiter.check("caller")).remaining).toBe(0);
    const blocked = await limiter.check("caller");
    expect(blocked).toEqual({ allowed: false, limit: 2, remaining: 0, retryAfterSeconds: 60 });
    expect(hits).toEqual(["api-v1:caller", "api-v1:caller", "api-v1:caller"]);
  });

  it("fails open and reports once when the store throws", async () => {
    const failure = new Error("database unreachable");
    const store = {
      hit: vi.fn(async () => {
        throw failure;
      }),
    };
    const onStoreError = vi.fn();
    const limiter = createStoreRateLimiter({
      limit: 2,
      name: "api-v1",
      onStoreError,
      store,
      windowMs: 60_000,
    });

    const result = await limiter.check("caller");
    expect(result).toEqual({ allowed: true, limit: 2, remaining: 2, retryAfterSeconds: 0 });
    expect(onStoreError).toHaveBeenCalledTimes(1);
    expect(onStoreError).toHaveBeenCalledWith(failure);
  });

  it("can fail closed for side-effecting security gates", async () => {
    const failure = new Error("database unreachable");
    const onStoreError = vi.fn();
    const limiter = createStoreRateLimiter({
      failClosed: true,
      limit: 2,
      name: "marketing-lead",
      onStoreError,
      store: {
        hit: async () => {
          throw failure;
        },
      },
      windowMs: 60_000,
    });

    expect(await limiter.check("caller")).toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(onStoreError).toHaveBeenCalledWith(failure);
  });
});

describe("rateLimitKeyForRequest", () => {
  it("prefers workspace/user identity over forwarding headers", () => {
    expect(rateLimitKeyForRequest(new Headers(), { prefix: "api", userId: "u_1" })).toBe(
      "api:user:u_1",
    );
    expect(rateLimitKeyForRequest(new Headers(), { prefix: "api", workspaceId: "w_1" })).toBe(
      "api:workspace:w_1",
    );
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "9.9.9.9" }), {
        prefix: "api",
        userId: "u_1",
      }),
    ).toBe("api:user:u_1");
  });

  it("keys anonymous requests by the last forwarding entry when one proxy is trusted", () => {
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "8.8.8.8" }), {
        prefix: "api",
        trustedProxyCount: 1,
      }),
    ).toBe("api:ip:8.8.8.8");
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "2001:db8::1" }), {
        prefix: "api",
        trustedProxyCount: 1,
      }),
    ).toBe("api:ip:2001:db8::1");
  });

  it("does not let spoofed leading entries move the derived key", () => {
    const first = rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "1.1.1.1, 9.9.9.9" }), {
      prefix: "api",
      trustedProxyCount: 1,
    });
    const rotated = rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "2.2.2.2, 9.9.9.9" }), {
      prefix: "api",
      trustedProxyCount: 1,
    });
    const longer = rateLimitKeyForRequest(
      new Headers({ "x-forwarded-for": "7.7.7.7, 3.3.3.3, 9.9.9.9" }),
      { prefix: "api", trustedProxyCount: 1 },
    );
    expect(first).toBe("api:ip:9.9.9.9");
    expect(rotated).toBe("api:ip:9.9.9.9");
    expect(longer).toBe("api:ip:9.9.9.9");
  });

  it("honors a multi-proxy trusted count", () => {
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "1.1.1.1, 9.9.9.9, 10.0.0.1" }), {
        prefix: "api",
        trustedProxyCount: 2,
      }),
    ).toBe("api:ip:9.9.9.9");
    // A shorter chain than the deployment expects means the request skipped a
    // trusted hop — fall back to the shared unknown bucket.
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "9.9.9.9" }), {
        prefix: "api",
        trustedProxyCount: 2,
      }),
    ).toBe("api:ip:unknown");
  });

  it("falls back to the shared unknown bucket when no trustworthy entry exists", () => {
    expect(rateLimitKeyForRequest(new Headers(), { prefix: "api" })).toBe("api:ip:unknown");
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "1.1.1.1" }), { prefix: "api" }),
    ).toBe("api:ip:unknown");
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "2.2.2.2" }), { prefix: "api" }),
    ).toBe("api:ip:unknown");
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "   " }), { prefix: "api" }),
    ).toBe("api:ip:unknown");
    // Zero trusted proxies (direct exposure): no XFF entry is trustworthy.
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "9.9.9.9" }), {
        prefix: "api",
        trustedProxyCount: 0,
      }),
    ).toBe("api:ip:unknown");
  });

  it("rejects non-IP tokens at the trusted position", () => {
    for (const value of ["not-an-ip", "9.9.9.9 evil", "x".repeat(60)]) {
      expect(
        rateLimitKeyForRequest(new Headers({ "x-forwarded-for": value }), {
          prefix: "api",
          trustedProxyCount: 1,
        }),
      ).toBe("api:ip:unknown");
    }
    // Garbage in attacker-controlled leading entries never matters.
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "garbage, 9.9.9.9" }), {
        prefix: "api",
        trustedProxyCount: 1,
      }),
    ).toBe("api:ip:9.9.9.9");
  });

  it("normalizes a trailing source port off IPv4 tokens", () => {
    // Proxies that append `ip:port` (e.g. IIS/ARR) would otherwise rotate the
    // key per connection and silently disable per-IP limits.
    expect(
      rateLimitKeyForRequest(new Headers({ "x-forwarded-for": "9.9.9.9:8080" }), {
        prefix: "api",
        trustedProxyCount: 1,
      }),
    ).toBe("api:ip:9.9.9.9");
  });
});
