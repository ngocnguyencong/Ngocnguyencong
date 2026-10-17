import { describe, expect, it } from "vitest";

import { MobileApiError } from "../api/client";
import { createOfflineCache } from "./cache";
import { cachedRead } from "./cached-read";
import type { OfflineStorage } from "./storage";

function fakeStorage() {
  const files = new Map<string, string>();
  const storage: OfflineStorage = {
    list: async () => [...files.keys()],
    read: async (name) => files.get(name) ?? null,
    remove: async (name) => {
      files.delete(name);
    },
    write: async (name, text) => {
      files.set(name, text);
    },
  };
  return { files, storage };
}

const identity = <T>(value: unknown): T => value as T;
const scope = "u1:w1";

describe("cachedRead", () => {
  it("returns network data and writes it to the cache", async () => {
    const cache = createOfflineCache({ now: () => 500, storage: fakeStorage().storage });
    const result = await cachedRead(cache, scope, "k", async () => ({ n: 1 }), identity);
    expect(result).toEqual({ source: "network", value: { n: 1 } });
    const hit = await cache.get(scope, "k", identity<{ n: number }>);
    expect(hit).toEqual({ savedAt: 500, value: { n: 1 } });
  });

  it("falls back to the cached value on a fetch TypeError", async () => {
    const cache = createOfflineCache({ now: () => 500, storage: fakeStorage().storage });
    await cache.set(scope, "k", { n: 7 });
    const result = await cachedRead(
      cache,
      scope,
      "k",
      async () => {
        throw new TypeError("Network request failed");
      },
      identity,
    );
    expect(result).toEqual({ savedAt: 500, source: "cache", value: { n: 7 } });
  });

  it("falls back on MobileApiError status 0 (no response)", async () => {
    const cache = createOfflineCache({ now: () => 500, storage: fakeStorage().storage });
    await cache.set(scope, "k", "saved");
    const result = await cachedRead(
      cache,
      scope,
      "k",
      async () => {
        throw new MobileApiError(0, "The request could not be completed.");
      },
      identity,
    );
    expect(result).toEqual({ savedAt: 500, source: "cache", value: "saved" });
  });

  it.each([401, 403, 404] as const)("rethrows %i without serving the cache", async (status) => {
    const cache = createOfflineCache({ storage: fakeStorage().storage });
    await cache.set(scope, "k", "stale");
    await expect(
      cachedRead(
        cache,
        scope,
        "k",
        async () => {
          throw new MobileApiError(status, "denied");
        },
        identity,
      ),
    ).rejects.toMatchObject({ status });
  });

  it("rethrows other HTTP errors without serving the cache", async () => {
    const cache = createOfflineCache({ storage: fakeStorage().storage });
    await cache.set(scope, "k", "stale");
    await expect(
      cachedRead(
        cache,
        scope,
        "k",
        async () => {
          throw new MobileApiError(500, "server exploded");
        },
        identity,
      ),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("rethrows the network error when no cache entry exists", async () => {
    const cache = createOfflineCache({ storage: fakeStorage().storage });
    await expect(
      cachedRead(
        cache,
        scope,
        "missing",
        async () => {
          throw new TypeError("Network request failed");
        },
        identity,
      ),
    ).rejects.toThrow("Network request failed");
  });

  it("rethrows non-network errors without touching the cache", async () => {
    const cache = createOfflineCache({ storage: fakeStorage().storage });
    await cache.set(scope, "k", "stale");
    await expect(
      cachedRead(
        cache,
        scope,
        "k",
        async () => {
          throw new Error("The response was invalid.");
        },
        identity,
      ),
    ).rejects.toThrow("The response was invalid.");
  });
});
