import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { classifySource } from "./channels";
import { fmtDuration, fmtMoney, fmtNum, fmtPct, percentChange, previousRange } from "./format";
import { clientIp, geoFromHeaders } from "./geo";
import { dailyVisitorKey, newSiteKey, sdId, sdShareId, sdSiteId, sha256 } from "./id";
import { parseUA } from "./ua";

describe("id helpers", () => {
  it("mints prefixed site and share ids", () => {
    expect(sdSiteId()).toMatch(/^sdid_[0-9a-f]{24}$/);
    expect(sdShareId()).toMatch(/^[0-9a-f]{24}$/);
    expect(sdId()).not.toBe(sdId());
  });

  it("newSiteKey returns a display prefix and sha256 hash, never the plaintext", () => {
    const { key, prefix, hash } = newSiteKey();
    expect(key).toMatch(/^sd_[0-9a-f]{48}$/);
    expect(prefix.startsWith("sd_")).toBe(true);
    expect(key).not.toContain(prefix.slice(-4));
    expect(hash).toBe(sha256(key));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dailyVisitorKey is stable for the same day and rotates across days", () => {
    const day = new Date("2026-01-15T12:00:00Z");
    const a = dailyVisitorKey("s1", "1.2.3.4", "ua", day);
    expect(a).toBe(dailyVisitorKey("s1", "1.2.3.4", "ua", day));
    expect(a).not.toBe(dailyVisitorKey("s1", "1.2.3.4", "ua", new Date("2026-01-16T12:00:00Z")));
    expect(a).not.toBe(dailyVisitorKey("s2", "1.2.3.4", "ua", day));
  });
});

describe("classifySource", () => {
  const own = { hostname: "example.com" };

  it("marks bare traffic direct", () => {
    expect(
      classifySource({ referrer: null, utmSource: null, utmMedium: null, clickId: null, ...own }),
    ).toEqual({ channel: "direct", source: "(direct)", medium: "(none)" });
  });

  it("reads paid search from utm + gclid", () => {
    const utm = classifySource({
      referrer: null,
      utmSource: "google",
      utmMedium: "cpc",
      clickId: null,
      ...own,
    });
    expect(utm.channel).toBe("paid_search");
    const click = classifySource({
      referrer: null,
      utmSource: null,
      utmMedium: null,
      clickId: "gclid_abc",
      ...own,
    });
    expect(click.channel).toBe("paid_search");
    const social = classifySource({
      referrer: null,
      utmSource: null,
      utmMedium: null,
      clickId: "fbclid_x",
      ...own,
    });
    expect(social.channel).toBe("paid_social");
  });

  it("classifies referrer hosts into channels", () => {
    const cases: [string, string][] = [
      ["https://www.google.com/search?q=x", "organic_search"],
      ["https://chatgpt.com/share/abc", "ai"],
      ["https://twitter.com/post/1", "social"],
      ["https://www.youtube.com/watch?v=1", "video"],
      ["https://blog.example.org/post", "referral"],
    ];
    for (const [referrer, channel] of cases) {
      expect(
        classifySource({ referrer, utmSource: null, utmMedium: null, clickId: null, ...own })
          .channel,
      ).toBe(channel);
    }
  });

  it("ignores self-referrals and prefers utm medium buckets", () => {
    expect(
      classifySource({
        referrer: "https://example.com/pricing",
        utmSource: null,
        utmMedium: null,
        clickId: null,
        ...own,
      }).channel,
    ).toBe("direct");
    expect(
      classifySource({
        referrer: null,
        utmSource: "newsletter",
        utmMedium: "email",
        clickId: null,
        ...own,
      }).channel,
    ).toBe("email");
  });
});

describe("parseUA", () => {
  it("parses desktop chrome on windows", () => {
    const ua = parseUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    expect(ua).toMatchObject({
      device: "desktop",
      browser: "Chrome 124",
      os: "Windows 10",
      isBot: false,
    });
  });

  it("parses mobile safari on iOS", () => {
    const ua = parseUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    );
    expect(ua.device).toBe("mobile");
    expect(ua.browser).toBe("Safari 17");
    expect(ua.os).toBe("iOS 17");
  });

  it("flags bots, crawlers, and empty agents", () => {
    expect(parseUA("Mozilla/5.0 (compatible; Googlebot/2.1)").isBot).toBe(true);
    expect(parseUA("curl/8.8.0").device).toBe("bot");
    expect(parseUA(null).isBot).toBe(true);
    expect(parseUA("").isBot).toBe(true);
  });
});

describe("formatters", () => {
  it("formats counts, money, percents, and durations", () => {
    expect(fmtNum(999)).toBe("999");
    expect(fmtNum(1500)).toBe("1.5k");
    expect(fmtNum(24000)).toBe("24k");
    expect(fmtMoney(241200)).toBe("$2,412");
    expect(fmtMoney(12995)).toBe("$129.95");
    expect(fmtPct(0.443)).toBe("44.3%");
    expect(fmtPct(1)).toBe("100%");
    expect(fmtDuration(458)).toBe("7m 38s");
    expect(fmtDuration(30)).toBe("30s");
  });
});

describe("range helpers", () => {
  it("previousRange returns the equal-length window immediately before", () => {
    const range = {
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-10-31T00:00:00Z"),
    };
    const prev = previousRange(range);
    expect(prev.to).toEqual(range.from);
    expect(prev.from.getTime()).toBe(range.from.getTime() - 30 * 86400_000);
  });

  it("percentChange is the fractional delta, null when previous is zero or non-finite", () => {
    expect(percentChange(112, 100)).toBeCloseTo(0.12);
    expect(percentChange(90, 100)).toBeCloseTo(-0.1);
    expect(percentChange(100, 100)).toBe(0);
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
    expect(percentChange(Number.NaN, 100)).toBeNull();
  });
});

describe("request geo/ip helpers", () => {
  it("reads geo headers emitted by the edge layer", () => {
    const h = new Headers({
      "x-vercel-ip-country": "US",
      "x-vercel-ip-country-region": "CA",
      "x-vercel-ip-city": "San%20Francisco",
    });
    expect(geoFromHeaders(h)).toEqual({ country: "us", region: "CA", city: "San Francisco" });
  });

  it("ignores client-supplied XFF without a trusted proxy hop", () => {
    // Local dev runs with zero trusted proxies: forwarded chains are
    // attacker-controlled input and never become the client ip.
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("unknown");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
