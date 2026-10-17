import { describe, expect, it } from "vitest";

import { createOfflineCache, MAX_ENTRY_BYTES, MAX_ENTRY_AGE_MS } from "./cache";
import type { OfflineStorage } from "./storage";

/** In-memory OfflineStorage fake — mirrors the file-backed contract. */
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

describe("createOfflineCache", () => {
  it("round-trips a value through storage with its savedAt timestamp", async () => {
    const { storage } = fakeStorage();
    const cache = createOfflineCache({ now: () => 1000, storage });
    await cache.set("u1:w1", "home", { visits: 3 });
    const hit = await cache.get("u1:w1", "home", identity<{ visits: number }>);
    expect(hit).toEqual({ savedAt: 1000, value: { visits: 3 } });
  });

  it("isolates entries between scopes and keys", async () => {
    const { storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "list", "alice-w1");
    await cache.set("u1:w2", "list", "alice-w2");
    await cache.set("u2:w1", "list", "bob-w1");
    expect((await cache.get("u1:w1", "list", identity<string>))?.value).toBe("alice-w1");
    expect((await cache.get("u1:w2", "list", identity<string>))?.value).toBe("alice-w2");
    expect((await cache.get("u2:w1", "list", identity<string>))?.value).toBe("bob-w1");
    expect(await cache.get("u1:w1", "other", identity)).toBeNull();
    expect(await cache.get("u9:w9", "list", identity)).toBeNull();
  });

  it("returns null and removes entries older than the max age", async () => {
    const { files, storage } = fakeStorage();
    let now = 1000;
    const cache = createOfflineCache({ now: () => now, storage });
    await cache.set("u1:w1", "list", "fresh");
    now = 1000 + MAX_ENTRY_AGE_MS + 1;
    expect(await cache.get("u1:w1", "list", identity)).toBeNull();
    expect(files.size).toBe(0);
  });

  it("keeps entries at the max-age boundary", async () => {
    const { storage } = fakeStorage();
    let now = 1000;
    const cache = createOfflineCache({ now: () => now, storage });
    await cache.set("u1:w1", "list", "edge");
    now = 1000 + MAX_ENTRY_AGE_MS;
    expect((await cache.get("u1:w1", "list", identity<string>))?.value).toBe("edge");
  });

  it("skips writes larger than the entry size cap", async () => {
    const { files, storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "big", "x".repeat(MAX_ENTRY_BYTES));
    expect(files.size).toBe(0);
    expect(await cache.get("u1:w1", "big", identity)).toBeNull();
  });

  it("returns null and removes corrupted files", async () => {
    const { files, storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "list", "ok");
    const [name] = [...files.keys()];
    files.set(name!, "{not json");
    expect(await cache.get("u1:w1", "list", identity)).toBeNull();
    expect(files.has(name!)).toBe(false);
  });

  it("returns null and removes files with a malformed envelope", async () => {
    const { files, storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "list", "ok");
    const [name] = [...files.keys()];
    files.set(name!, JSON.stringify({ savedAt: "yesterday", value: "ok" }));
    expect(await cache.get("u1:w1", "list", identity)).toBeNull();
    expect(files.has(name!)).toBe(false);
  });

  it("returns null and removes entries whose value fails parsing", async () => {
    const { storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "list", "ok");
    const parse = () => {
      throw new Error("bad shape");
    };
    expect(await cache.get("u1:w1", "list", parse)).toBeNull();
    expect((await storage.list()).length).toBe(0);
  });

  it("never puts raw scope or key text into file names", async () => {
    const { files, storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    const scope = "user_demo1:ws_secret-workspace";
    await cache.set(scope, "notifications:list", "data");
    for (const name of files.keys()) {
      expect(name).not.toContain("user_demo1");
      expect(name).not.toContain("ws_secret-workspace");
      expect(name).not.toContain("notifications:list");
      expect(name).toMatch(/^[0-9a-f-]+\.json$/);
    }
  });

  it("clearScope removes only that scope's entries", async () => {
    const { storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "a", 1);
    await cache.set("u1:w1", "b", 2);
    await cache.set("u1:w2", "a", 3);
    await cache.clearScope("u1:w1");
    expect(await cache.get("u1:w1", "a", identity)).toBeNull();
    expect(await cache.get("u1:w1", "b", identity)).toBeNull();
    expect((await cache.get("u1:w2", "a", identity<number>))?.value).toBe(3);
  });

  it("clearAll removes every entry", async () => {
    const { files, storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "a", 1);
    await cache.set("u2:w2", "b", 2);
    await cache.clearAll();
    expect(files.size).toBe(0);
  });

  it("derives scope file names deterministically", async () => {
    const { storage } = fakeStorage();
    const cache = createOfflineCache({ storage });
    await cache.set("u1:w1", "list", "v");
    const [first] = await storage.list();
    const { files: files2, storage: storage2 } = fakeStorage();
    const cache2 = createOfflineCache({ storage: storage2 });
    await cache2.set("u1:w1", "list", "v");
    expect([...files2.keys()][0]).toBe(first);
  });
});
