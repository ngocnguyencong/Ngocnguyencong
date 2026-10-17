import "server-only";

import {
  createNamedRateLimiter,
  marketingLeadGlobalLimiter,
  trustedProxyCount,
} from "./rate-limit-runtime";
import { createPublicWriteAdmission } from "./public-write-admission";

const publicWriteClientLimiter = createNamedRateLimiter("marketing-public-client", 5, 3_600_000, {
  failClosed: true,
});

const admission = createPublicWriteAdmission({
  clientLimiter: publicWriteClientLimiter,
  globalLimiter: marketingLeadGlobalLimiter,
  trustedProxyCount,
});

/** Shared gate for anonymous lead and waitlist writes. */
export async function marketingPublicWriteAllowed(headers: Headers): Promise<boolean> {
  return (await admission(headers)).allowed;
}
