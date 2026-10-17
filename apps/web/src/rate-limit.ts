export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/**
 * In-memory fixed-window limiter. Suitable for a single-process deployment or
 * local development; horizontally scaled deployments should use
 * `createStoreRateLimiter` with a shared store behind the same interface.
 */
export function createRateLimiter(options: {
  limit: number;
  maxBuckets?: number;
  now?: () => number;
  windowMs: number;
}): RateLimiter {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();
  const configuredMaxBuckets = options.maxBuckets ?? 10_000;
  if (!Number.isFinite(configuredMaxBuckets)) {
    // NaN/Infinity would silently disable the cap (size >= NaN is never true).
    throw new Error("Rate limiter maxBuckets must be a finite number.");
  }
  const maxBuckets = Math.min(10_000, Math.max(1, Math.floor(configuredMaxBuckets)));
  let earliestExpiry = Number.POSITIVE_INFINITY;

  async function check(key: string): Promise<RateLimitResult> {
    const current = now();
    const bucket = buckets.get(key);
    if (bucket === undefined || current - bucket.windowStart >= options.windowMs) {
      if (bucket === undefined && buckets.size >= maxBuckets) {
        if (current >= earliestExpiry) {
          earliestExpiry = Number.POSITIVE_INFINITY;
          for (const [candidateKey, candidate] of buckets) {
            const expiresAt = candidate.windowStart + options.windowMs;
            if (current >= expiresAt) {
              buckets.delete(candidateKey);
            } else {
              earliestExpiry = Math.min(earliestExpiry, expiresAt);
            }
          }
        }
        if (buckets.size >= maxBuckets) {
          return {
            allowed: false,
            limit: options.limit,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil((earliestExpiry - current) / 1000)),
          };
        }
      }
      buckets.set(key, { count: 1, windowStart: current });
      earliestExpiry = Math.min(earliestExpiry, current + options.windowMs);
      return {
        allowed: true,
        limit: options.limit,
        remaining: options.limit - 1,
        retryAfterSeconds: 0,
      };
    }
    if (bucket.count < options.limit) {
      bucket.count += 1;
      return {
        allowed: true,
        limit: options.limit,
        remaining: options.limit - bucket.count,
        retryAfterSeconds: 0,
      };
    }
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.windowStart + options.windowMs - current) / 1000),
      ),
    };
  }

  return Object.freeze({ check });
}

export interface RateLimitStore {
  hit(
    key: string,
    windowMs: number,
    now: Date,
  ): Promise<Readonly<{ count: number; expiresAt: Date }>>;
}

/**
 * Fixed-window limiter on a shared store (see `createPostgresRateLimitStore`).
 * Keys are namespaced per limiter (`${name}:${key}`). Store failures fail open
 * by default for availability; side-effecting security gates can opt into
 * fail-closed behavior. Failures are reported once per check.
 */
export function createStoreRateLimiter(options: {
  failClosed?: boolean;
  limit: number;
  name: string;
  now?: () => Date;
  onStoreError?: (error: Error) => void;
  store: RateLimitStore;
  windowMs: number;
}): RateLimiter {
  const now = options.now ?? (() => new Date());

  async function check(key: string): Promise<RateLimitResult> {
    const current = now();
    try {
      const hit = await options.store.hit(`${options.name}:${key}`, options.windowMs, current);
      const allowed = hit.count <= options.limit;
      return {
        allowed,
        limit: options.limit,
        remaining: Math.max(0, options.limit - hit.count),
        retryAfterSeconds: allowed
          ? 0
          : Math.max(1, Math.ceil((hit.expiresAt.getTime() - current.getTime()) / 1000)),
      };
    } catch (error) {
      options.onStoreError?.(error instanceof Error ? error : new Error("Rate-limit store failed"));
      return {
        allowed: options.failClosed !== true,
        limit: options.limit,
        remaining: options.failClosed === true ? 0 : options.limit,
        retryAfterSeconds:
          options.failClosed === true ? Math.max(1, Math.ceil(options.windowMs / 1000)) : 0,
      };
    }
  }

  return Object.freeze({ check });
}

/** IPv4/IPv6-ish tokens only — never let request bytes leak into bucket keys. */
const FORWARDED_TOKEN_PATTERN = /^[\dA-Fa-f.:]{1,45}$/;
/** Some proxies append `ip:port`; a rotating source port must not rotate keys. */
const IPV4_WITH_PORT_PATTERN = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;

function normalizeForwardedEntry(raw: string | undefined): string | undefined {
  const token = raw?.trim() ?? "";
  if (!FORWARDED_TOKEN_PATTERN.test(token)) {
    return undefined;
  }
  return IPV4_WITH_PORT_PATTERN.exec(token)?.[1] ?? token;
}

/**
 * The client IP as observed by the outermost trusted proxy — the same XFF
 * tail-entry rule `rateLimitKeyForRequest` uses for anonymous bucket keys.
 * Returns "unknown" when no trustworthy forwarding chain exists; callers must
 * never treat the result as a verified identity, only as a coarse signal.
 */
export function clientIpForRequest(headers: Headers, trustedProxyCount = 0): string {
  const trusted = Math.max(0, Math.floor(trustedProxyCount));
  const entries = headers.get("x-forwarded-for")?.split(",") ?? [];
  return normalizeForwardedEntry(entries[entries.length - trusted]) ?? "unknown";
}

/**
 * Deterministic bucket key: caller identity first, then the client IP as
 * observed by the outermost trusted proxy. XFF semantics: every proxy appends
 * the peer IP it received the connection from, so only the LAST
 * `trustedProxyCount` entries are written by infrastructure we control —
 * leading entries are attacker-controlled and must never move the key.
 * Direct deployments default to 0 trusted hops and ignore XFF entirely;
 * deployments behind N controlled proxies set TRUSTED_PROXY_COUNT=N. Missing,
 * short, or malformed chains fall back to the shared `unknown` bucket, which
 * still bounds volume globally.
 */
export function rateLimitKeyForRequest(
  headers: Headers,
  options: Readonly<{
    prefix: string;
    trustedProxyCount?: number;
    userId?: string;
    workspaceId?: string;
  }>,
): string {
  if (options.workspaceId !== undefined) {
    return `${options.prefix}:workspace:${options.workspaceId}`;
  }
  if (options.userId !== undefined) {
    return `${options.prefix}:user:${options.userId}`;
  }
  const source = clientIpForRequest(headers, options.trustedProxyCount);
  return `${options.prefix}:ip:${source}`;
}
