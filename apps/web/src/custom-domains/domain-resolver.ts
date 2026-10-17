/**
 * Host → workspace brand resolution for white-label custom domains. Lookups
 * hit the database through `lookupActiveDomain`; results (including misses)
 * are cached in-memory for `ttlMs` so hot paths never query per request.
 */

export interface ResolvedDomainBrand {
  logoObjectKey: string | null;
  name: string;
  workspaceId: string;
}

export interface DomainResolverDeps {
  lookupActiveDomain: (host: string) => Promise<ResolvedDomainBrand | null>;
  maxCacheEntries?: number;
  maxInflightLookups?: number;
  negativeTtlMs?: number;
  now?: () => number;
  ttlMs?: number;
}

export const DOMAIN_RESOLVER_TTL_MS = 60_000;
export const DOMAIN_RESOLVER_NEGATIVE_TTL_MS = 5_000;
export const DOMAIN_RESOLVER_MAX_CACHE_ENTRIES = 1_000;
export const DOMAIN_RESOLVER_MAX_INFLIGHT_LOOKUPS = 64;
const MAX_REQUEST_HOST_LENGTH = 253;

export function normalizeRequestHost(host: string): string {
  const trimmed = host.trim().toLowerCase().replace(/\.$/, "");
  // Host headers may carry a port (dev, proxies) — never part of a hostname.
  const bracketed = trimmed.match(/^\[(.*)\](?::\d+)?$/);
  if (bracketed) return `[${bracketed[1]}]`;
  return trimmed.replace(/:\d+$/, "");
}

export function createDomainResolver(deps: DomainResolverDeps): {
  invalidate: (host?: string) => void;
  resolve: (host: string) => Promise<ResolvedDomainBrand | null>;
} {
  const now = deps.now ?? Date.now;
  const ttlMs = positiveInteger(deps.ttlMs, DOMAIN_RESOLVER_TTL_MS);
  const negativeTtlMs = Math.min(
    ttlMs,
    positiveInteger(deps.negativeTtlMs, DOMAIN_RESOLVER_NEGATIVE_TTL_MS),
  );
  const maxCacheEntries = positiveInteger(deps.maxCacheEntries, DOMAIN_RESOLVER_MAX_CACHE_ENTRIES);
  const maxInflightLookups = positiveInteger(
    deps.maxInflightLookups,
    DOMAIN_RESOLVER_MAX_INFLIGHT_LOOKUPS,
  );
  const cache = new Map<string, { expiresAt: number; value: ResolvedDomainBrand | null }>();
  const inflight = new Map<string, Promise<ResolvedDomainBrand | null>>();
  const invalidatedLookups = new WeakSet<Promise<ResolvedDomainBrand | null>>();

  async function resolve(host: string): Promise<ResolvedDomainBrand | null> {
    const key = normalizeRequestHost(host);
    if (key.length === 0 || key.length > MAX_REQUEST_HOST_LENGTH) {
      return null;
    }
    const nowMs = now();
    pruneExpired(nowMs);
    const cached = cache.get(key);
    if (cached !== undefined && cached.expiresAt > nowMs) {
      // Map insertion order provides a small, simple LRU.
      cache.delete(key);
      cache.set(key, cached);
      return cached.value;
    }
    const pending = inflight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    // Avoid turning arbitrary Host headers into an unbounded promise map or
    // a burst of unique database lookups. Saturated unknown hosts resolve
    // unbranded and are not cached.
    if (inflight.size >= maxInflightLookups) {
      return null;
    }
    const lookup: Promise<ResolvedDomainBrand | null> = deps
      .lookupActiveDomain(key)
      .then((value) => {
        // An invalidation may land while the DB query is in flight. Discard
        // that stale result and resolve again against the current source.
        // Keep it counted as in-flight until it settles so invalidation
        // cannot be used to exceed the concurrent database lookup cap.
        if (invalidatedLookups.has(lookup)) {
          invalidatedLookups.delete(lookup);
          if (inflight.get(key) === lookup) {
            inflight.delete(key);
          }
          return resolve(key);
        }
        const resolvedAt = now();
        pruneExpired(resolvedAt);
        cache.delete(key);
        cache.set(key, {
          expiresAt: resolvedAt + (value === null ? negativeTtlMs : ttlMs),
          value,
        });
        while (cache.size > maxCacheEntries) {
          const leastRecentlyUsed = cache.keys().next().value;
          if (leastRecentlyUsed === undefined) break;
          cache.delete(leastRecentlyUsed);
        }
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === lookup) {
          inflight.delete(key);
        }
      });
    inflight.set(key, lookup);
    return lookup;
  }

  function invalidate(host?: string): void {
    if (host === undefined) {
      cache.clear();
      for (const lookup of inflight.values()) {
        invalidatedLookups.add(lookup);
      }
      return;
    }
    const key = normalizeRequestHost(host);
    cache.delete(key);
    const pending = inflight.get(key);
    if (pending !== undefined) {
      invalidatedLookups.add(pending);
    }
  }

  function pruneExpired(nowMs: number): void {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= nowMs) {
        cache.delete(key);
      }
    }
  }

  return { invalidate, resolve };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Domain resolver limits must be positive integers.");
  }
  return value;
}
