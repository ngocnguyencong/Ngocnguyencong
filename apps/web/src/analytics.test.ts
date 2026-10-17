import { createHmac } from "node:crypto";

import type { AnalyticsEventRecord } from "@supastack/db";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));
vi.mock("./rate-limit-runtime", () => ({ trustedProxyCount: 1 }));

import {
  hashVisitorIdentity,
  loadSiteAnalyticsSummary,
  parseAnalyticsCollectBody,
  recordAnalyticsEvent,
  resolveAnalyticsProvider,
} from "./analytics";

const HEADERS = new Headers({
  "user-agent": "Mozilla/5.0 (Test)",
  "x-forwarded-for": "198.51.100.4, 203.0.113.8",
});

function fakeRepository() {
  const inserted: AnalyticsEventRecord[] = [];
  return {
    inserted,
    repository: {
      record: vi.fn(async (row: AnalyticsEventRecord) => {
        inserted.push(row);
      }),
      summarizeSiteTraffic: vi.fn(async () => ({
        events: 1,
        pageviews: 3,
        topPaths: [{ path: "/", views: 3 }],
        uniqueVisitors: 2,
      })),
    },
  };
}

describe("resolveAnalyticsProvider", () => {
  it("returns a configured provider kind", () => {
    expect(["off", "local", "plausible", "posthog"]).toContain(resolveAnalyticsProvider());
  });
});

describe("hashVisitorIdentity", () => {
  const base = {
    date: "2026-10-10",
    ip: "203.0.113.8",
    secret: "test-auth-secret",
    userAgent: "Mozilla/5.0 (Test)",
  };

  it("returns a deterministic 64-hex digest", () => {
    const hash = hashVisitorIdentity(base);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVisitorIdentity(base)).toBe(hash);
    expect(hash).not.toBe(base.ip);
    expect(JSON.stringify(hash)).not.toContain(base.ip);
    expect(JSON.stringify(hash)).not.toContain("Mozilla");
  });

  it("is an HMAC over the field array — fields can never blur together", () => {
    const expected = createHmac("sha256", base.secret)
      .update(JSON.stringify([base.ip, base.userAgent, base.date]))
      .digest("hex");
    expect(hashVisitorIdentity(base)).toBe(expected);
    // Adjacent fields that would collide under naive concatenation stay split.
    expect(
      hashVisitorIdentity({ ...base, ip: "203.0.113.", userAgent: "8Mozilla/5.0 (Test)" }),
    ).not.toBe(hashVisitorIdentity(base));
  });

  it("rotates daily through the UTC date and rekeys through the salt", () => {
    const hash = hashVisitorIdentity(base);
    expect(hashVisitorIdentity({ ...base, date: "2026-10-11" })).not.toBe(hash);
    expect(hashVisitorIdentity({ ...base, secret: "rotated-secret" })).not.toBe(hash);
    expect(hashVisitorIdentity({ ...base, ip: "203.0.113.9" })).not.toBe(hash);
    expect(hashVisitorIdentity({ ...base, userAgent: "Other/1.0" })).not.toBe(hash);
  });
});

describe("parseAnalyticsCollectBody", () => {
  it("accepts a pageview and normalizes the referrer to its host", () => {
    expect(
      parseAnalyticsCollectBody({
        kind: "pageview",
        path: "/pricing",
        referrerHost: "https://www.google.com/search?q=demo&utm=1",
      }),
    ).toEqual({
      event: {
        kind: "pageview",
        path: "/pricing",
        referrerHost: "www.google.com",
      },
      ok: true,
    });
  });

  it("accepts a bare hostname referrer", () => {
    expect(
      parseAnalyticsCollectBody({ kind: "pageview", path: "/", referrerHost: "news.example.test" }),
    ).toEqual({
      event: { kind: "pageview", path: "/", referrerHost: "news.example.test" },
      ok: true,
    });
  });

  it("accepts a custom event with a name and page context", () => {
    expect(parseAnalyticsCollectBody({ kind: "event", name: "cta_click", path: "/" })).toEqual({
      event: { kind: "event", name: "cta_click", path: "/" },
      ok: true,
    });
  });

  it("rejects malformed bodies", () => {
    for (const body of [
      null,
      "pageview",
      [],
      {},
      { kind: "scroll", path: "/" },
      { kind: "pageview" }, // pageview requires a path
      { kind: "event" }, // event requires a name
      { kind: "pageview", path: "https://evil.test/x?a=b" }, // paths stay site-relative
      { kind: "pageview", path: "/" + "p".repeat(512) },
      { kind: "pageview", path: "/", name: 42 },
      { kind: "event", name: "" },
      { kind: "event", name: "n".repeat(121) },
      { kind: "pageview", path: "/", referrerHost: "r".repeat(256) },
      { kind: "pageview", path: "/", referrerHost: "not a host !!>" },
      { kind: "pageview", path: "/", referrerHost: 12 },
      // Control characters (Postgres varchar rejects NUL → would 500).
      { kind: "pageview", path: "/\x00bad" },
      { kind: "pageview", path: "/ok\x7F" },
      { kind: "event", name: "bad\x1Fname" },
      { kind: "pageview", path: "/", referrerHost: "evil\x00.test" },
      { kind: "pageview", path: "/", referrerHost: "https://evil.test/\x00" },
    ]) {
      expect(parseAnalyticsCollectBody(body), JSON.stringify(body)).toEqual({ ok: false });
    }
  });
});

describe("recordAnalyticsEvent", () => {
  const deps = () => ({
    now: () => new Date("2026-10-10T12:00:00.000Z"),
    secret: "test-auth-secret",
    trustedProxyCount: 1,
  });

  it("inserts exactly one row with a hashed visitor — never raw ip or user-agent", async () => {
    const { inserted, repository } = fakeRepository();
    await recordAnalyticsEvent(
      { kind: "pageview", path: "/", referrerHost: "www.google.com", requestHeaders: HEADERS },
      { ...deps(), repository },
    );

    expect(repository.record).toHaveBeenCalledTimes(1);
    const row = inserted[0]!;
    expect(row).toMatchObject({
      kind: "pageview",
      path: "/",
      referrerHost: "www.google.com",
      workspaceId: null,
    });
    expect(row.id).toEqual(expect.any(String));
    expect(row.visitorHash).toMatch(/^[0-9a-f]{64}$/);
    // The last trusted XFF entry (203.0.113.8) feeds the hash input only.
    expect(row.visitorHash).not.toBe("203.0.113.8");
    expect(Object.keys(row)).not.toContain("ip");
    expect(Object.keys(row)).not.toContain("userAgent");
    expect(JSON.stringify(row)).not.toContain("203.0.113.8");
    expect(JSON.stringify(row)).not.toContain("Mozilla");
  });

  it("rejects an invalid event before inserting", async () => {
    const { repository } = fakeRepository();
    await expect(
      recordAnalyticsEvent(
        { kind: "scroll" as never, requestHeaders: HEADERS },
        { ...deps(), repository },
      ),
    ).rejects.toThrow();
    expect(repository.record).not.toHaveBeenCalled();
  });

  it("derives the same visitor for the same ip+ua+date and rotates the next day", async () => {
    const { inserted, repository } = fakeRepository();
    const input = { kind: "pageview", path: "/", requestHeaders: HEADERS } as const;
    await recordAnalyticsEvent(input, { ...deps(), repository });
    await recordAnalyticsEvent(input, { ...deps(), repository });
    expect(inserted[0]!.visitorHash).toBe(inserted[1]!.visitorHash);

    await recordAnalyticsEvent(input, {
      ...deps(),
      now: () => new Date("2026-10-11T00:30:00.000Z"),
      repository,
    });
    expect(inserted[2]!.visitorHash).not.toBe(inserted[0]!.visitorHash);
  });
});

describe("loadSiteAnalyticsSummary", () => {
  it("summarizes the last N days through the repository", async () => {
    const { repository } = fakeRepository();
    const summary = await loadSiteAnalyticsSummary(30, {
      now: () => new Date("2026-10-10T00:00:00.000Z"),
      repository,
    });

    expect(repository.summarizeSiteTraffic).toHaveBeenCalledWith({
      limit: 10,
      since: new Date("2026-09-10T00:00:00.000Z"),
    });
    expect(summary).toEqual({
      days: 30,
      events: 1,
      pageviews: 3,
      topPaths: [{ path: "/", views: 3 }],
      uniqueVisitors: 2,
    });
  });

  it("bounds the window to 1..365 days", async () => {
    const { repository } = fakeRepository();
    await loadSiteAnalyticsSummary(0, {
      now: () => new Date("2026-10-10T00:00:00.000Z"),
      repository,
    });
    expect(repository.summarizeSiteTraffic).toHaveBeenLastCalledWith({
      limit: 10,
      since: new Date("2026-10-09T00:00:00.000Z"),
    });
  });
});
