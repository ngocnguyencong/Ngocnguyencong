import type { OfflineStorage } from "./storage";

/**
 * Workspace-scoped offline read cache. Entries are JSON files keyed by a
 * hash of `${scope}:${key}` — scope is `${userId}:${workspaceId}`, so raw
 * user/workspace identifiers never appear in file paths and data never
 * leaks across users or workspaces. Entries older than seven days and
 * serialized values over 256 KB are refused/removed; corrupted files are
 * deleted on read. Everything is best-effort: a broken file must never
 * break a screen.
 */

export const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ENTRY_BYTES = 256 * 1024;

export interface OfflineCacheEntry<T> {
  savedAt: number;
  value: T;
}

export interface OfflineCache {
  clearAll(): Promise<void>;
  clearScope(scope: string): Promise<void>;
  get<T>(
    scope: string,
    key: string,
    parse: (value: unknown) => T,
  ): Promise<OfflineCacheEntry<T> | null>;
  set(scope: string, key: string, value: unknown): Promise<void>;
}

/** FNV-1a — deterministic, dependency-free hash for file names (not crypto). */
function hashText(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fileName(scope: string, key: string): string {
  return `${hashText(scope)}-${hashText(`${scope}:${key}`)}.json`;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

interface StoredEnvelope {
  savedAt: number;
  value: unknown;
}

function isEnvelope(value: unknown): value is StoredEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { savedAt?: unknown }).savedAt === "number" &&
    Number.isFinite((value as { savedAt: number }).savedAt) &&
    "value" in value
  );
}

export function createOfflineCache({
  now = () => Date.now(),
  storage,
}: {
  now?: () => number;
  storage: OfflineStorage;
}): OfflineCache {
  return {
    async clearAll() {
      const names = await storage.list();
      await Promise.all(names.map((name) => storage.remove(name)));
    },

    async clearScope(scope) {
      const prefix = `${hashText(scope)}-`;
      const names = await storage.list();
      await Promise.all(
        names.filter((name) => name.startsWith(prefix)).map((name) => storage.remove(name)),
      );
    },

    async get<T>(
      scope: string,
      key: string,
      parse: (value: unknown) => T,
    ): Promise<OfflineCacheEntry<T> | null> {
      const name = fileName(scope, key);
      const text = await storage.read(name);
      if (text === null) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        await storage.remove(name);
        return null;
      }
      if (!isEnvelope(parsed) || now() - parsed.savedAt > MAX_ENTRY_AGE_MS) {
        await storage.remove(name);
        return null;
      }
      try {
        return { savedAt: parsed.savedAt, value: parse(parsed.value) };
      } catch {
        await storage.remove(name);
        return null;
      }
    },

    async set(scope: string, key: string, value: unknown) {
      const text = JSON.stringify({ savedAt: now(), value } satisfies StoredEnvelope);
      if (utf8Length(text) > MAX_ENTRY_BYTES) return;
      await storage.write(fileName(scope, key), text);
    },
  };
}
