import { toNextJsHandler } from "better-auth/next-js";

import { auth, authjs } from "../../../../src/auth-runtime";
import { authLimiter, trustedProxyCount } from "../../../../src/rate-limit-runtime";
import { createInFlightRequestGate, runRateLimitedRequest } from "../../../../src/rate-limit-route";
import { MAX_JSON_BODY_BYTES, readBoundedRequest } from "../../../../src/request-body";

const betterAuthHandlers = toNextJsHandler(auth);
const handlers =
  authjs === null ? betterAuthHandlers : (authjs.handlers as unknown as typeof betterAuthHandlers);
const unknownAuthRequestGate = createInFlightRequestGate(20);

export async function GET(request: Request) {
  return runRateLimitedRequest(
    request,
    authLimiter,
    "auth",
    (admittedRequest) => handlers.GET(admittedRequest),
    {
      trustedProxyCount,
      unknownIpGate: unknownAuthRequestGate,
    },
  );
}

export async function POST(request: Request) {
  return runRateLimitedRequest(
    request,
    authLimiter,
    "auth",
    async (admittedRequest) => {
      const bounded = await readBoundedRequest(admittedRequest, MAX_JSON_BODY_BYTES);
      if ("response" in bounded) return bounded.response;
      return handlers.POST(bounded.request);
    },
    {
      trustedProxyCount,
      unknownIpGate: unknownAuthRequestGate,
    },
  );
}
