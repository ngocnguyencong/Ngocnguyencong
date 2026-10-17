import "server-only";

import { randomUUID } from "node:crypto";

import { rateLimitKeyForRequest, type RateLimitResult, type RateLimiter } from "./rate-limit";
import { trustedProxyCount } from "./rate-limit-runtime";

/**
 * Returns a 429 response when the bucket is exhausted, otherwise null so the
 * route continues. Anonymous callers are keyed by the client IP the outermost
 * trusted proxy observed; requests without a trustworthy forwarding chain
 * share the bounded `unknown` bucket.
 */
export async function rateLimitResponse(
  headers: Headers,
  limiter: RateLimiter,
  prefix: string,
): Promise<Response | null> {
  const result = await limiter.check(
    rateLimitKeyForRequest(headers, { prefix, trustedProxyCount }),
  );
  if (result.allowed) {
    return null;
  }
  return Response.json(
    {
      error: {
        code: "rateLimited",
        message: "Too many requests. Try again shortly.",
        requestId: randomUUID(),
      },
    },
    {
      headers: {
        "retry-after": String(result.retryAfterSeconds),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
      },
      status: 429,
    },
  );
}

export const TRUSTED_CLIENT_IP_HEADER = "x-authenticated-client-ip";

export function createInFlightRequestGate(maxInFlight: number) {
  if (!Number.isFinite(maxInFlight) || maxInFlight < 1) {
    throw new Error("In-flight request limit must be a positive finite number.");
  }
  const limit = Math.floor(maxInFlight);
  let inFlight = 0;

  return Object.freeze({
    limit,
    tryAcquire(): (() => void) | null {
      if (inFlight >= limit) return null;
      inFlight += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        inFlight -= 1;
      };
    },
  });
}

function rateLimitedResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: {
        code: "rateLimited",
        message: "Too many requests. Try again shortly.",
        requestId: randomUUID(),
      },
    },
    {
      headers: {
        "retry-after": String(Math.max(1, result.retryAfterSeconds)),
        "x-ratelimit-limit": String(result.limit),
        "x-ratelimit-remaining": "0",
      },
      status: 429,
    },
  );
}

function withTrustedClientHeader(request: Request, clientIp: string | null): Request {
  const headers = new Headers(request.headers);
  headers.delete(TRUSTED_CLIENT_IP_HEADER);
  if (clientIp !== null) headers.set(TRUSTED_CLIENT_IP_HEADER, clientIp);
  const init: RequestInit = {
    headers,
    method: request.method,
    signal: request.signal,
  };
  if (request.body !== null) Object.assign(init, { body: request.body, duplex: "half" });
  return new Request(request.url, init);
}

export async function runRateLimitedRequest(
  request: Request,
  limiter: RateLimiter,
  prefix: string,
  handler: (request: Request) => Promise<Response>,
  options: Readonly<{
    trustedProxyCount?: number;
    unknownIpGate: ReturnType<typeof createInFlightRequestGate>;
  }>,
): Promise<Response> {
  const bucketKey = rateLimitKeyForRequest(request.headers, {
    prefix,
    trustedProxyCount: options.trustedProxyCount ?? trustedProxyCount,
  });
  const trustedPrefix = `${prefix}:ip:`;
  const clientIp = bucketKey.startsWith(trustedPrefix)
    ? bucketKey.slice(trustedPrefix.length)
    : "unknown";
  if (clientIp !== "unknown") {
    const result = await limiter.check(bucketKey);
    if (!result.allowed) return rateLimitedResponse(result);
    return handler(withTrustedClientHeader(request, clientIp));
  }

  const release = options.unknownIpGate.tryAcquire();
  if (release === null) {
    return rateLimitedResponse({
      allowed: false,
      limit: options.unknownIpGate.limit,
      remaining: 0,
      retryAfterSeconds: 1,
    });
  }
  try {
    return await handler(withTrustedClientHeader(request, null));
  } finally {
    release();
  }
}
