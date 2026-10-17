import { describe, expect, it } from "vitest";

import {
  buildEarlyAccessUrl,
  buildWaitlistShareUrl,
  earlyAccessCodeStatus,
  generateInviteCode,
  generateReferralCode,
  isSelfReferral,
  normalizeWaitlistEmail,
  parseWaitlistJoin,
  sanitizeGrowthParam,
  waitlistStatusMessage,
  type EarlyAccessCodeLike,
} from "./waitlist";

describe("normalizeWaitlistEmail", () => {
  it("trims, lowercases, and rejects invalid input", () => {
    expect(normalizeWaitlistEmail("  Pat@Example.COM ")).toBe("pat@example.com");
    expect(normalizeWaitlistEmail("nope")).toBeNull();
    expect(normalizeWaitlistEmail("a@b")).toBeNull();
    expect(normalizeWaitlistEmail("")).toBeNull();
  });
});

describe("parseWaitlistJoin", () => {
  it("returns the normalized email or invalid-email", () => {
    expect(parseWaitlistJoin({ email: " Pat@Example.com " })).toEqual({
      ok: true,
      email: "pat@example.com",
    });
    expect(parseWaitlistJoin({ email: "bad" })).toEqual({ ok: false, error: "invalid-email" });
  });
});

describe("code generation", () => {
  it("produces unique url-safe referral codes", () => {
    const a = generateReferralCode();
    const b = generateReferralCode();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]{10}$/);
  });

  it("produces unique url-safe invite codes", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[a-z0-9]{12}$/);
    expect(generateInviteCode()).not.toBe(code);
  });
});

describe("sanitizeGrowthParam", () => {
  it("keeps plausible codes and rejects junk", () => {
    expect(sanitizeGrowthParam(" abc-DEF_123 ")).toBe("abc-def_123");
    expect(sanitizeGrowthParam("")).toBeNull();
    expect(sanitizeGrowthParam("has space")).toBeNull();
    expect(sanitizeGrowthParam("<script>")).toBeNull();
    expect(sanitizeGrowthParam("x".repeat(65))).toBeNull();
  });
});

describe("earlyAccessCodeStatus", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const base: EarlyAccessCodeLike = {
    code: "abc",
    email: null,
    redeemedAt: null,
    expiresAt: null,
  };

  it("accepts an unbound, unexpired, unredeemed code", () => {
    expect(earlyAccessCodeStatus(base, { email: "any@x.test", now })).toBe("valid");
  });

  it("accepts an email-bound code only for that email", () => {
    const bound = { ...base, email: "pat@x.test" };
    expect(earlyAccessCodeStatus(bound, { email: "pat@x.test", now })).toBe("valid");
    expect(earlyAccessCodeStatus(bound, { email: "PAT@x.test", now })).toBe("valid");
    expect(earlyAccessCodeStatus(bound, { email: "other@x.test", now })).toBe("email-mismatch");
  });

  it("rejects redeemed, expired, and unknown codes", () => {
    expect(earlyAccessCodeStatus({ ...base, redeemedAt: now }, { email: "a@x.test", now })).toBe(
      "redeemed",
    );
    expect(
      earlyAccessCodeStatus(
        { ...base, expiresAt: new Date("2025-01-01T00:00:00Z") },
        { email: "a@x.test", now },
      ),
    ).toBe("expired");
    expect(earlyAccessCodeStatus(null, { email: "a@x.test", now })).toBe("unknown");
  });
});

describe("urls", () => {
  it("builds the early-access signup url carrying ?invite=", () => {
    expect(buildEarlyAccessUrl("https://app.test", "code123")).toBe(
      "https://app.test/auth?invite=code123",
    );
    expect(buildEarlyAccessUrl("https://app.test/", "code123")).toBe(
      "https://app.test/auth?invite=code123",
    );
  });

  it("builds the waitlist share url carrying ?ref=", () => {
    expect(buildWaitlistShareUrl("https://app.test", "ref42")).toBe("https://app.test/?ref=ref42");
  });
});

describe("isSelfReferral", () => {
  it("blocks crediting a waitlist entry for referring itself", () => {
    expect(isSelfReferral("a@x.test", "a@x.test")).toBe(true);
    expect(isSelfReferral("A@x.test", "a@x.test")).toBe(true);
    expect(isSelfReferral("a@x.test", "b@x.test")).toBe(false);
    expect(isSelfReferral(null, "b@x.test")).toBe(false);
  });
});

describe("waitlistStatusMessage", () => {
  it("maps redirect statuses to copy", () => {
    expect(waitlistStatusMessage("joined", { position: 12, referralCode: "abc" })).toContain("#12");
    expect(waitlistStatusMessage("joined", { position: 12, referralCode: "abc" })).toContain("abc");
    expect(waitlistStatusMessage("duplicate", {})).toBeTruthy();
    expect(waitlistStatusMessage("invalid-email", {})).toBeTruthy();
    expect(waitlistStatusMessage("captcha", {})).toBeTruthy();
    expect(waitlistStatusMessage("nonsense", {})).toBeNull();
    expect(waitlistStatusMessage(undefined, {})).toBeNull();
  });
});
