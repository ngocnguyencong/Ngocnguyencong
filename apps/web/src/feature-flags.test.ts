import { describe, expect, it } from "vitest";

import {
  isAnnouncementActive,
  isValidFlagKey,
  normalizeAnnouncementSeverity,
  resolveFeatureFlag,
} from "./feature-flags";

describe("resolveFeatureFlag", () => {
  it("prefers user override over workspace override over global default", () => {
    expect(
      resolveFeatureFlag({ defaultEnabled: false, userOverride: null, workspaceOverride: null }),
    ).toBe(false);
    expect(
      resolveFeatureFlag({ defaultEnabled: false, userOverride: null, workspaceOverride: true }),
    ).toBe(true);
    expect(
      resolveFeatureFlag({ defaultEnabled: true, userOverride: false, workspaceOverride: true }),
    ).toBe(false);
    expect(
      resolveFeatureFlag({ defaultEnabled: false, userOverride: true, workspaceOverride: false }),
    ).toBe(true);
  });
});

describe("isValidFlagKey", () => {
  it("accepts dotted/slug keys and rejects others", () => {
    expect(isValidFlagKey("chat.streaming")).toBe(true);
    expect(isValidFlagKey("beta-ui_v2")).toBe(true);
    expect(isValidFlagKey("")).toBe(false);
    expect(isValidFlagKey("has space")).toBe(false);
    expect(isValidFlagKey("x".repeat(101))).toBe(false);
  });
});

describe("announcement window", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("is active inside the window and honors an optional end", () => {
    expect(
      isAnnouncementActive({ endsAt: null, startsAt: new Date("2026-09-16T00:00:00.000Z") }, now),
    ).toBe(true);
    expect(
      isAnnouncementActive(
        {
          endsAt: new Date("2026-09-16T13:00:00.000Z"),
          startsAt: new Date("2026-09-16T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isAnnouncementActive({ endsAt: null, startsAt: new Date("2026-09-17T00:00:00.000Z") }, now),
    ).toBe(false);
    expect(
      isAnnouncementActive(
        {
          endsAt: new Date("2026-09-16T11:00:00.000Z"),
          startsAt: new Date("2026-09-16T00:00:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("normalizes severity", () => {
    expect(normalizeAnnouncementSeverity("critical")).toBe("critical");
    expect(normalizeAnnouncementSeverity("warning")).toBe("warning");
    expect(normalizeAnnouncementSeverity("bogus")).toBe("info");
  });
});
