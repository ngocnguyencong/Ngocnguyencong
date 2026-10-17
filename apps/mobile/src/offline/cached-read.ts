import { MobileApiError } from "../api/client";
import type { OfflineCache } from "./cache";

/**
 * Read-through cache: try the network, persist the fresh value, and only
 * fall back to the cached copy when the failure means there is no
 * connectivity (fetch `TypeError` / `MobileApiError` status 0 — the
 * transport never produced a response). HTTP failures — including 401,
 * 403, and 404 — rethrow: a denied or missing resource must not silently
 * serve stale data, and a 401 must not extend a dead session's access.
 */

export type CachedReadResult<T> =
  { source: "network"; value: T } | { savedAt: number; source: "cache"; value: T };

export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof MobileApiError && error.status === 0;
}

export async function cachedRead<T>(
  cache: OfflineCache,
  scope: string,
  key: string,
  fetcher: () => Promise<T>,
  parse: (value: unknown) => T,
): Promise<CachedReadResult<T>> {
  try {
    const value = await fetcher();
    await cache.set(scope, key, value);
    return { source: "network", value };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const hit = await cache.get(scope, key, parse);
    if (hit === null) throw error;
    return { savedAt: hit.savedAt, source: "cache", value: hit.value };
  }
}

/**
 * Screen-facing convenience: when no workspace scope is available yet
 * (signed out / workspace list still loading) the read goes straight to
 * the network instead of touching the cache.
 */
export async function readCachedOrFetch<T>(
  cache: OfflineCache,
  scope: string | null,
  key: string,
  fetcher: () => Promise<T>,
  parse: (value: unknown) => T,
): Promise<CachedReadResult<T>> {
  if (scope === null) {
    const value = await fetcher();
    return { source: "network", value };
  }
  return cachedRead(cache, scope, key, fetcher, parse);
}
