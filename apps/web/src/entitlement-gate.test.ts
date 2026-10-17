import { describe, expect, it } from "vitest";

import { hasActiveEntitlement } from "./entitlement-check";

describe("hasActiveEntitlement", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("grants active/trialing entitlements that have not expired", () => {
    expect(
      hasActiveEntitlement(
        [
          { key: "pro", status: "active", expiresAt: null },
          { key: "other", status: "inactive", expiresAt: null },
        ],
        "pro",
        now,
      ),
    ).toBe(true);
    expect(
      hasActiveEntitlement(
        [{ key: "pro", status: "trialing", expiresAt: new Date("2026-10-01") }],
        "pro",
        now,
      ),
    ).toBe(true);
  });

  it("denies missing, expired, or non-active statuses", () => {
    expect(hasActiveEntitlement([], "pro", now)).toBe(false);
    expect(
      hasActiveEntitlement([{ key: "pro", status: "past_due", expiresAt: null }], "pro", now),
    ).toBe(false);
    expect(
      hasActiveEntitlement(
        [{ key: "pro", status: "active", expiresAt: new Date("2026-09-01") }],
        "pro",
        now,
      ),
    ).toBe(false);
    expect(
      hasActiveEntitlement([{ key: "other", status: "active", expiresAt: null }], "pro", now),
    ).toBe(false);
  });
});
