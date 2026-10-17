import { describe, expect, it } from "vitest";

import { applyContentAccess, isContentLocked } from "./content-access";

const now = new Date("2026-09-27T12:00:00Z");

const row = (over = {}) => ({
  body: "full report body",
  excerpt: "teaser",
  id: "con_1",
  publishedAt: now,
  requiredEntitlement: "pro" as string | null,
  slug: "q3-report",
  title: "Q3 report",
  type: "report",
  ...over,
});

describe("isContentLocked", () => {
  it("never locks free entries", () => {
    expect(isContentLocked(null, [], now)).toBe(false);
    expect(isContentLocked(null, [{ key: "pro", status: "active", expiresAt: null }], now)).toBe(
      false,
    );
  });

  it("locks gated entries without a matching active entitlement", () => {
    expect(isContentLocked("pro", [], now)).toBe(true);
    expect(isContentLocked("pro", [{ key: "other", status: "active", expiresAt: null }], now)).toBe(
      true,
    );
    expect(isContentLocked("pro", [{ key: "pro", status: "past_due", expiresAt: null }], now)).toBe(
      true,
    );
    expect(
      isContentLocked(
        "pro",
        [{ key: "pro", status: "active", expiresAt: new Date("2026-09-01") }],
        now,
      ),
    ).toBe(true);
  });

  it("unlocks with a matching active/trialing entitlement that has not expired", () => {
    expect(isContentLocked("pro", [{ key: "pro", status: "active", expiresAt: null }], now)).toBe(
      false,
    );
    expect(
      isContentLocked(
        "pro",
        [{ key: "pro", status: "trialing", expiresAt: new Date("2026-10-01") }],
        now,
      ),
    ).toBe(false);
  });
});

describe("applyContentAccess", () => {
  it("strips body and marks locked rows while keeping teaser metadata", () => {
    const [locked] = applyContentAccess([row()], [], now);
    expect(locked).toMatchObject({
      body: "",
      excerpt: "teaser",
      locked: true,
      requiredEntitlement: "pro",
      title: "Q3 report",
    });
  });

  it("passes rows through with intact body when entitled or ungated", () => {
    const entitlements = [{ key: "pro", status: "active" as const, expiresAt: null }];
    expect(applyContentAccess([row()], entitlements, now)[0]).toMatchObject({
      body: "full report body",
      locked: false,
    });
    expect(applyContentAccess([row({ requiredEntitlement: null })], [], now)[0]).toMatchObject({
      body: "full report body",
      locked: false,
      requiredEntitlement: null,
    });
  });
});
