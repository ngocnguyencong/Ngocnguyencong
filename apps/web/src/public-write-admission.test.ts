import { describe, expect, it, vi } from "vitest";

import { createPublicWriteAdmission } from "./public-write-admission";

function allowedLimiter(allowed = true) {
  return {
    check: vi.fn(async () => ({
      allowed,
      limit: 5,
      remaining: allowed ? 4 : 0,
      retryAfterSeconds: allowed ? 0 : 3600,
    })),
  };
}

describe("createPublicWriteAdmission", () => {
  it("uses only the trusted proxy identity, then checks the shared global budget", async () => {
    const clientLimiter = allowedLimiter();
    const globalLimiter = allowedLimiter();
    const admission = createPublicWriteAdmission({
      clientLimiter,
      globalLimiter,
      trustedProxyCount: 1,
    });

    await expect(
      admission(new Headers({ "x-forwarded-for": "198.51.100.77, 203.0.113.8" })),
    ).resolves.toEqual({ allowed: true });
    expect(clientLimiter.check).toHaveBeenCalledWith("public-write-client:ip:203.0.113.8");
    expect(globalLimiter.check).toHaveBeenCalledWith("all");
  });

  it("does not spend global capacity after a known client is denied", async () => {
    const clientLimiter = allowedLimiter(false);
    const globalLimiter = allowedLimiter();
    const admission = createPublicWriteAdmission({
      clientLimiter,
      globalLimiter,
      trustedProxyCount: 1,
    });

    await expect(admission(new Headers({ "x-forwarded-for": "203.0.113.8" }))).resolves.toEqual({
      allowed: false,
      reason: "client",
    });
    expect(globalLimiter.check).not.toHaveBeenCalled();
  });

  it("skips the per-client bucket when proxy identity is unknown and still applies global cap", async () => {
    const clientLimiter = allowedLimiter();
    const globalLimiter = allowedLimiter(false);
    const admission = createPublicWriteAdmission({
      clientLimiter,
      globalLimiter,
      trustedProxyCount: 0,
    });

    await expect(
      admission(new Headers({ "x-forwarded-for": "198.51.100.77", "x-real-ip": "203.0.113.9" })),
    ).resolves.toEqual({ allowed: false, reason: "global" });
    expect(clientLimiter.check).not.toHaveBeenCalled();
    expect(globalLimiter.check).toHaveBeenCalledWith("all");
  });
});
