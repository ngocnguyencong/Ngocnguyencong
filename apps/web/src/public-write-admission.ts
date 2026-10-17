import { rateLimitKeyForRequest, type RateLimiter } from "./rate-limit";

export type PublicWriteAdmissionResult =
  Readonly<{ allowed: true }> | Readonly<{ allowed: false; reason: "client" | "global" }>;

export interface PublicWriteAdmissionDependencies {
  clientLimiter: RateLimiter;
  globalLimiter: RateLimiter;
  trustedProxyCount: number;
}

/**
 * Applies a client quota only when the configured trusted proxy chain yields
 * an IP. Every request then consumes the shared aggregate budget.
 */
export function createPublicWriteAdmission(deps: PublicWriteAdmissionDependencies) {
  return async (headers: Headers): Promise<PublicWriteAdmissionResult> => {
    const clientKey = rateLimitKeyForRequest(headers, {
      prefix: "public-write-client",
      trustedProxyCount: deps.trustedProxyCount,
    });

    if (!clientKey.endsWith(":ip:unknown")) {
      const client = await deps.clientLimiter.check(clientKey);
      if (!client.allowed) {
        return { allowed: false, reason: "client" };
      }
    }

    const global = await deps.globalLimiter.check("all");
    return global.allowed ? { allowed: true } : { allowed: false, reason: "global" };
  };
}
