import { describe, expect, it } from "vitest";

import { createDomainResolver } from "./domain-resolver";

const brand = {
  logoObjectKey: "ws_1/logo/logo.png",
  name: "Acme",
  workspaceId: "ws_1",
};

describe("createDomainResolver", () => {
  it("resolves an active host and caches positive lookups", async () => {
    let calls = 0;
    const resolver = createDomainResolver({
      lookupActiveDomain: async (host) => {
        calls += 1;
        return host === "portal.acme.test" ? brand : null;
      },
    });

    expect(await resolver.resolve("portal.acme.test")).toEqual(brand);
    expect(await resolver.resolve("portal.acme.test")).toEqual(brand);
    expect(calls).toBe(1);
  });

  it("negative-caches misses until the TTL passes or the host is invalidated", async () => {
    let calls = 0;
    let now = 1_000;
    const resolver = createDomainResolver({
      lookupActiveDomain: async () => {
        calls += 1;
        return null;
      },
      now: () => now,
      ttlMs: 60_000,
    });

    expect(await resolver.resolve("gone.test")).toBeNull();
    expect(await resolver.resolve("gone.test")).toBeNull();
    expect(calls).toBe(1);

    now += 61_000;
    expect(await resolver.resolve("gone.test")).toBeNull();
    expect(calls).toBe(2);

    resolver.invalidate("gone.test");
    expect(await resolver.resolve("gone.test")).toBeNull();
    expect(calls).toBe(3);

    resolver.invalidate();
    calls = 0;
    expect(await resolver.resolve("gone.test")).toBeNull();
    expect(calls).toBe(1);
  });

  it("normalizes the host before lookup (case, trailing dot, port)", async () => {
    const seen: string[] = [];
    const resolver = createDomainResolver({
      lookupActiveDomain: async (host) => {
        seen.push(host);
        return null;
      },
    });
    await resolver.resolve("Portal.Acme.TEST.");
    await resolver.resolve("portal.acme.test:443");
    expect(seen).toEqual(["portal.acme.test"]);
  });

  it("uses a shorter negative TTL and evicts the least-recently-used cache entry", async () => {
    let now = 1_000;
    const lookedUp: string[] = [];
    const resolver = createDomainResolver({
      lookupActiveDomain: async (host) => {
        lookedUp.push(host);
        return null;
      },
      maxCacheEntries: 2,
      negativeTtlMs: 10,
      now: () => now,
      ttlMs: 60_000,
    });

    await resolver.resolve("a.example.test");
    await resolver.resolve("b.example.test");
    await resolver.resolve("a.example.test"); // refresh LRU order
    await resolver.resolve("c.example.test"); // evicts b
    await resolver.resolve("a.example.test"); // still cached
    await resolver.resolve("b.example.test"); // misses after eviction
    expect(lookedUp).toEqual([
      "a.example.test",
      "b.example.test",
      "c.example.test",
      "b.example.test",
    ]);

    now += 11;
    await resolver.resolve("b.example.test");
    expect(lookedUp.at(-1)).toBe("b.example.test");
    expect(lookedUp).toHaveLength(5);
  });

  it("prunes expired entries and does not look up overlong host keys", async () => {
    let now = 1_000;
    let calls = 0;
    const resolver = createDomainResolver({
      lookupActiveDomain: async () => {
        calls += 1;
        return null;
      },
      maxCacheEntries: 2,
      negativeTtlMs: 5,
      now: () => now,
      ttlMs: 50,
    });

    await resolver.resolve("gone.example.test");
    now += 6;
    await resolver.resolve("gone.example.test");
    await resolver.resolve("a.example.test");
    await resolver.resolve("b.example.test");
    await resolver.resolve("z".repeat(254));

    expect(calls).toBe(4);
  });

  it("caps concurrent distinct lookups", async () => {
    const pending = new Map<string, (value: typeof brand | null) => void>();
    const lookedUp: string[] = [];
    const resolver = createDomainResolver({
      lookupActiveDomain: (host) =>
        new Promise((resolve) => {
          lookedUp.push(host);
          pending.set(host, resolve);
        }),
      maxInflightLookups: 2,
    });

    const first = resolver.resolve("first.example.test");
    const second = resolver.resolve("second.example.test");
    await expect(resolver.resolve("third.example.test")).resolves.toBeNull();
    expect(lookedUp).toEqual(["first.example.test", "second.example.test"]);

    pending.get("first.example.test")!(brand);
    pending.get("second.example.test")!(null);
    await expect(first).resolves.toEqual(brand);
    await expect(second).resolves.toBeNull();
  });

  it("rechecks a host when its in-flight lookup finishes after invalidation", async () => {
    let finishFirst: ((value: typeof brand | null) => void) | undefined;
    let calls = 0;
    const resolver = createDomainResolver({
      lookupActiveDomain: () => {
        calls += 1;
        if (calls === 1) {
          return new Promise((resolve) => {
            finishFirst = resolve;
          });
        }
        return Promise.resolve(null);
      },
    });

    const first = resolver.resolve("portal.example.test");
    resolver.invalidate("portal.example.test");
    const current = resolver.resolve("portal.example.test");
    finishFirst!(brand);

    await expect(current).resolves.toBeNull();
    await expect(first).resolves.toBeNull();
    await expect(resolver.resolve("portal.example.test")).resolves.toBeNull();
    expect(calls).toBe(2);
  });

  it("keeps invalidated database work inside the in-flight lookup cap", async () => {
    let finishFirst: ((value: typeof brand | null) => void) | undefined;
    let calls = 0;
    const lookedUp: string[] = [];
    const resolver = createDomainResolver({
      lookupActiveDomain: (host) => {
        calls += 1;
        lookedUp.push(host);
        if (calls === 1) {
          return new Promise((resolve) => {
            finishFirst = resolve;
          });
        }
        return Promise.resolve(null);
      },
      maxInflightLookups: 1,
    });

    const first = resolver.resolve("first.example.test");
    resolver.invalidate("first.example.test");
    await expect(resolver.resolve("second.example.test")).resolves.toBeNull();
    expect(lookedUp).toEqual(["first.example.test"]);

    finishFirst!(brand);
    await expect(first).resolves.toBeNull();
    expect(lookedUp).toEqual(["first.example.test", "first.example.test"]);
  });
});
