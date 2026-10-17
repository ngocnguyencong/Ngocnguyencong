import "server-only";

import { parseServerConfig } from "@supastack/config";
import { createPostgresRateLimitStore } from "@supastack/db";

import { database } from "./auth-runtime";
import { serverObservability } from "./observability-runtime";
import { createRateLimiter, createStoreRateLimiter, type RateLimiter } from "./rate-limit";

const serverConfig = parseServerConfig();

/**
 * Trusted XFF hops for anonymous bucket keys (`TRUSTED_PROXY_COUNT`, default
 * 0). Must match the number of proxies that append `x-forwarded-for` in front
 * of this app — count only hops you control.
 */
export const trustedProxyCount = serverConfig.rateLimit.trustedProxyCount;

/**
 * Builds a named fixed-window limiter on the configured store: shared Postgres
 * buckets in production (RATE_LIMIT_STORE=postgres), per-process memory
 * otherwise. Store failures fail open and are reported without bucket keys.
 */
export function createNamedRateLimiter(
  name: string,
  limit: number,
  windowMs: number,
  options: { failClosed?: boolean } = {},
): RateLimiter {
  if (serverConfig.rateLimit.store === "postgres") {
    return createStoreRateLimiter({
      ...(options.failClosed === undefined ? {} : { failClosed: options.failClosed }),
      limit,
      name,
      onStoreError: (error) =>
        serverObservability.captureException(error, {
          operation: "rate-limit.store",
          workspaceId: "platform",
        }),
      store: createPostgresRateLimitStore(database),
      windowMs,
    });
  }

  return createRateLimiter({ limit, windowMs });
}

/** Shared limiter instances for the public API surface and auth endpoints. */
export const apiV1Limiter = createNamedRateLimiter("api-v1", 600, 60_000, {
  failClosed: true,
});
export const authLimiter = createNamedRateLimiter("auth", 300, 60_000, { failClosed: true });
/** Global cap for unauthenticated PayPal verification requests. */
export const paypalWebhookLimiter = createNamedRateLimiter("paypal-webhook", 600, 60_000, {
  failClosed: true,
});
/** Connected-account OAuth flow limiters (browser redirects, trusted client IP or shared fallback). */
export const oauthConnectLimiter = createNamedRateLimiter("oauth-connect", 200, 60_000, {
  failClosed: true,
});
export const oauthCallbackLimiter = createNamedRateLimiter("oauth-callback", 300, 60_000, {
  failClosed: true,
});
/** Internal scheduler tick endpoint — trusted client IP or shared fallback. */
export const schedulerTickLimiter = createNamedRateLimiter("scheduler-tick", 30, 60_000);
/** Public lead mail/storage limit: one global volume ceiling. */
export const marketingLeadGlobalLimiter = createNamedRateLimiter(
  "marketing-lead-global",
  100,
  3_600_000,
  { failClosed: true },
);
/**
 * First-party analytics collect endpoint (ANALYTICS_PROVIDER=local). Bounded
 * per trusted client IP; fail-open like other telemetry so a store outage
 * degrades metrics, not the visitor experience.
 */
export const analyticsCollectLimiter = createNamedRateLimiter("analytics-collect", 600, 60_000);
/**
 * Workspace data export downloads — a heavy read bounded per trusted client
 * IP. Fails open like other authenticated-surface limiters so a store outage
 * never blocks an owner's own data.
 */
export const exportDownloadLimiter = createNamedRateLimiter("export-download", 10, 60_000);
/** Shared BFF task gates cover dashboard, REST v1, and MCP submissions. */
export const aiTaskUserLimiter = createNamedRateLimiter("ai-task-user", 20, 60_000, {
  failClosed: true,
});
export const aiTaskWorkspaceLimiter = createNamedRateLimiter("ai-task-workspace", 60, 60_000, {
  failClosed: true,
});
