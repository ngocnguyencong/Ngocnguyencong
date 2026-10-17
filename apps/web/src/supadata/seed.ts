import "server-only";

import { sdEvent, sdKeyword, sdMention, sdPayment, sdSession, sdVisitor } from "@supastack/db";

import { database } from "../auth-runtime";
import { classifySource } from "./channels";
import { sdId } from "./id";

/**
 * Demo seed — ~520 visitors / ~9k events / ~$3.5k revenue over 90 days.
 * Run: DATABASE_URL=… npx tsx -e "import('...').then(m=>m.seedDemo('sdid_…'))"
 */

const PAGES = [
  ["/", 30],
  ["/pricing", 14],
  ["/features", 10],
  ["/blog", 8],
  ["/blog/launch-week", 6],
  ["/docs", 7],
  ["/docs/api", 5],
  ["/signup", 6],
  ["/login", 4],
  ["/checkout", 3],
  ["/about", 2],
  ["/changelog", 2],
  ["/integrations", 3],
] as const;

const SOURCES: {
  ref: string;
  utm: { source?: string; medium?: string; campaign?: string };
  w: number;
}[] = [
  { ref: "https://google.com/", utm: {}, w: 28 },
  { ref: "https://google.com/", utm: { source: "google", medium: "cpc", campaign: "brand" }, w: 8 },
  { ref: "https://bing.com/", utm: {}, w: 6 },
  { ref: "https://news.ycombinator.com/", utm: {}, w: 10 },
  { ref: "https://x.com/", utm: {}, w: 8 },
  { ref: "https://linkedin.com/", utm: {}, w: 4 },
  { ref: "https://chatgpt.com/", utm: {}, w: 5 },
  { ref: "https://producthunt.com/", utm: {}, w: 4 },
  { ref: "https://dev.to/", utm: {}, w: 3 },
  { ref: "", utm: { source: "newsletter", medium: "email", campaign: "weekly" }, w: 9 },
  { ref: "", utm: { source: "partner", medium: "referral", campaign: "integration" }, w: 5 },
  { ref: "", utm: {}, w: 10 },
];

const COUNTRIES = [
  ["us", "California", "San Francisco", 26],
  ["gb", "England", "London", 12],
  ["de", "Bavaria", "Munich", 10],
  ["fr", "Île-de-France", "Paris", 8],
  ["ca", "Ontario", "Toronto", 7],
  ["in", "Karnataka", "Bengaluru", 9],
  ["br", "São Paulo", "São Paulo", 6],
  ["au", "NSW", "Sydney", 5],
  ["nl", "NH", "Amsterdam", 5],
  ["jp", "Tokyo", "Tokyo", 4],
  ["se", "Stockholm", "Stockholm", 4],
  ["pl", "Mazovia", "Warsaw", 4],
] as const;

const DEVICES = [
  ["desktop", 68],
  ["mobile", 26],
  ["tablet", 6],
] as const;
const BROWSERS = [
  ["Chrome 124", 55],
  ["Safari 17", 22],
  ["Firefox 125", 12],
  ["Edge 124", 11],
] as const;
const OSES = [
  ["Windows 10", 34],
  ["macOS 15", 30],
  ["Android 14", 16],
  ["iOS 17", 14],
  ["Linux", 6],
] as const;
const NAMES = [
  "Ava",
  "Liam",
  "Maya",
  "Noah",
  "Zoe",
  "Ethan",
  "Ivy",
  "Kai",
  "Ruby",
  "Leo",
  "Nora",
  "Omar",
  "Tara",
  "Finn",
  "June",
  "Alex",
  "Sam",
  "Rhea",
  "Jon",
  "Elif",
];
const CUSTOM_EVENTS = [
  ["signup_complete", 3],
  ["purchase_click", 2.2],
  ["demo_request", 1.2],
  ["docs_search", 2.6],
  ["pricing_toggle", 1.6],
  ["invite_sent", 0.8],
] as const;
const KEYWORDS: [string, number, number, number][] = [
  ["web analytics", 620, 9200, 4.2],
  ["privacy friendly analytics", 310, 4100, 3.1],
  ["revenue attribution", 280, 3300, 5.4],
  ["stripe analytics dashboard", 140, 1800, 6.8],
  ["plausible alternative", 190, 2600, 7.2],
  ["mrr tracking tool", 95, 1100, 8.9],
];
const MENTION_TEMPLATES: [string, string][] = [
  ["twitter", "Switched to {app} for analytics — revenue attribution is genuinely useful"],
  ["hackernews", "Show HN: {app} — privacy-friendly analytics with built-in revenue tracking"],
  ["reddit", "Anyone using {app}? The visitor journey view sold me"],
  ["linkedin", "Our team moved off GA4 to {app} last week, zero regrets"],
  ["twitter", "{app} just attributed a $2k enterprise deal to a HN post. Wild."],
  ["bluesky", "daily check: {app} realtime tab is my new favorite dashboard"],
];

function weighted<T>(pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) if ((r -= w) < 0) return v;
  return pairs[0]![0];
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)]!;

export async function seedDemo(siteId: string, days = 90) {
  const now = Date.now();
  const visitors: (typeof sdVisitor.$inferSelect)[] = [];
  const sessions: (typeof sdSession.$inferSelect)[] = [];
  const events: (typeof sdEvent.$inferSelect)[] = [];
  const payments: (typeof sdPayment.$inferSelect)[] = [];

  const VISITOR_COUNT = 520;
  for (let i = 0; i < VISITOR_COUNT; i++) {
    const src = weighted(SOURCES.map((s) => [s, s.w] as const));
    const [country, region, city] = weighted(COUNTRIES.map((c) => [c, c[3]] as const));
    const device = weighted(DEVICES);
    const browser = weighted(BROWSERS);
    const os = weighted(OSES);
    const cls = classifySource({
      referrer: src.ref || null,
      utmSource: src.utm.source ?? null,
      utmMedium: src.utm.medium ?? null,
      clickId: src.utm.medium === "cpc" ? "gclid_" + i : null,
      hostname: "localhost",
    });

    // Growth curve: more visitors in recent weeks.
    const t = Math.pow(Math.random(), 1.6);
    const firstSeen = new Date(now - t * days * 86400_000);
    const sessionCount = Math.random() < 0.72 ? randInt(1, 3) : randInt(4, 12);
    const identified = Math.random() < 0.3;
    const name = identified ? pick(NAMES) : null;
    const email = identified ? `${name!.toLowerCase()}${randInt(1, 99)}@example.com` : null;

    const visitorId = sdId();
    const visitor: typeof sdVisitor.$inferInsert = {
      id: visitorId,
      siteId,
      visitorKey: `seed_v_${i}`,
      userId: identified ? `user_${i}` : null,
      email,
      name,
      firstSeenAt: firstSeen,
      lastSeenAt: firstSeen,
      sessionCount,
      pageviewCount: 0,
      firstReferrer: src.ref || null,
      firstUtmSource: src.utm.source ?? null,
      firstUtmMedium: src.utm.medium ?? null,
      firstUtmCampaign: src.utm.campaign ?? null,
      firstClickId: cls.source === "Google" && src.utm.medium === "cpc" ? `gclid_${i}` : null,
      entryPage: null,
      lastReferrer: src.ref || null,
      lastUtmSource: src.utm.source ?? null,
      lastUtmMedium: src.utm.medium ?? null,
      lastUtmCampaign: src.utm.campaign ?? null,
      lastClickId: null,
      country,
      region,
      city,
      device,
      browser,
      os,
      language: "en-US",
      timezone: "UTC",
      isCustomer: false,
      revenueCents: 0,
      predictionScore: Math.round(Math.random() * 100) / 100,
    };

    let lastEvent = firstSeen.getTime();
    for (let s = 0; s < sessionCount; s++) {
      const start = new Date(Math.min(lastEvent + randInt(1, 96) * 3600_000, now - 60_000));
      const pvs = Math.random() < 0.45 ? 1 : randInt(2, 9);
      const session: typeof sdSession.$inferInsert = {
        id: sdId(),
        siteId,
        visitorId,
        sessionKey: `seed_s_${i}_${s}`,
        startedAt: start,
        lastActivityAt: start,
        entryPage: weighted(PAGES),
        referrer: src.ref || null,
        utmSource: src.utm.source ?? null,
        utmMedium: src.utm.medium ?? null,
        utmCampaign: src.utm.campaign ?? null,
        clickId: null,
        channel: cls.channel,
        source: cls.source,
        medium: cls.medium,
        campaign: src.utm.campaign ?? null,
        country,
        region,
        city,
        device,
        browser,
        os,
        pageviews: pvs,
        isBounce: pvs <= 1,
      };
      sessions.push(session as (typeof sessions)[number]);

      let ts = start.getTime();
      for (let p = 0; p < pvs; p++) {
        const page = p === 0 ? session.entryPage! : weighted(PAGES);
        ts += randInt(5_000, 240_000);
        const at = new Date(Math.min(ts, now - 30_000));
        events.push({
          id: sdId(),
          siteId,
          visitorId,
          sessionId: session.id,
          type: "pageview",
          name: null,
          path: page,
          hostname: "localhost",
          referrer: p === 0 ? src.ref || null : null,
          utmSource: src.utm.source ?? null,
          utmMedium: src.utm.medium ?? null,
          utmCampaign: src.utm.campaign ?? null,
          channel: cls.channel,
          source: cls.source,
          medium: cls.medium,
          campaign: src.utm.campaign ?? null,
          country,
          region,
          city,
          device,
          browser,
          os,
          createdAt: at,
        } as (typeof events)[number]);
        visitor.pageviewCount!++;
        if (Math.random() < 0.18) {
          const [evName] = weighted(CUSTOM_EVENTS.map((c) => [c[0], c[1]] as const));
          ts += randInt(3_000, 60_000);
          events.push({
            id: sdId(),
            siteId,
            visitorId,
            sessionId: session.id,
            type: "custom",
            name: evName,
            path: page,
            hostname: "localhost",
            referrer: null,
            channel: cls.channel,
            source: cls.source,
            medium: cls.medium,
            campaign: src.utm.campaign ?? null,
            country,
            region,
            city,
            device,
            browser,
            os,
            createdAt: new Date(Math.min(ts, now - 20_000)),
          } as (typeof events)[number]);
          if (
            evName !== undefined &&
            ["signup_complete", "purchase_click", "demo_request"].includes(evName)
          ) {
            events.push({
              ...(events[events.length - 1] as object),
              id: sdId(),
              type: "goal",
              name: evName,
            } as (typeof events)[number]);
          }
        }
      }
      session.lastActivityAt = new Date(ts);
      lastEvent = ts;
    }
    visitor.lastSeenAt = new Date(lastEvent);
    visitor.entryPage = sessions.find((s) => s.visitorId === visitorId)?.entryPage ?? "/";

    // ~11% convert to paying customers.
    if (Math.random() < 0.11) {
      const sub = Math.random() < 0.6;
      const amount = sub ? pick([2900, 4900, 9900]) : pick([1900, 4900, 14900, 29900]);
      const payAt = new Date(Math.min(lastEvent + randInt(1, 48) * 3600_000, now));
      payments.push({
        id: sdId(),
        siteId,
        visitorId,
        email,
        provider: pick(["stripe", "stripe", "lemonsqueezy", "polar"]),
        externalId: `seed_pay_${i}`,
        kind: "payment",
        amountCents: amount,
        currency: "usd",
        interval: sub ? "month" : "once",
        mrrCents: sub ? amount : 0,
        productName: sub ? "Pro monthly" : "Lifetime",
        status: Math.random() < 0.94 ? "active" : "refunded",
        channel: cls.channel,
        source: cls.source,
        medium: cls.medium,
        campaign: src.utm.campaign ?? null,
        referrer: src.ref || null,
        occurredAt: payAt,
      } as (typeof payments)[number]);
      visitor.isCustomer = true;
      visitor.revenueCents = amount;
    }
    visitors.push(visitor as (typeof visitors)[number]);
  }

  // A few realtime visitors in the last 5 minutes.
  for (let i = 0; i < 9; i++) {
    const v = visitors[randInt(0, visitors.length - 1)]!;
    events.push({
      id: sdId(),
      siteId,
      visitorId: v.id,
      sessionId: null,
      type: "pageview",
      name: null,
      path: pick(PAGES)[0],
      hostname: "localhost",
      referrer: null,
      channel: v.lastUtmSource ? "referral" : "direct",
      source: v.firstUtmSource,
      medium: v.firstUtmMedium,
      country: v.country,
      region: v.region,
      city: v.city,
      device: v.device,
      browser: v.browser,
      os: v.os,
      createdAt: new Date(now - randInt(10_000, 290_000)),
    } as (typeof events)[number]);
    v.lastSeenAt = new Date(now - randInt(5_000, 60_000));
  }

  const CHUNK = 400;
  for (let i = 0; i < visitors.length; i += CHUNK)
    await database.insert(sdVisitor).values(visitors.slice(i, i + CHUNK));
  for (let i = 0; i < sessions.length; i += CHUNK)
    await database.insert(sdSession).values(sessions.slice(i, i + CHUNK));
  for (let i = 0; i < events.length; i += CHUNK)
    await database.insert(sdEvent).values(events.slice(i, i + CHUNK));
  for (let i = 0; i < payments.length; i += CHUNK)
    await database.insert(sdPayment).values(payments.slice(i, i + CHUNK));

  const kw: (typeof sdKeyword.$inferInsert)[] = [];
  for (let d = 0; d < 28; d++) {
    for (const [query, clicks, impressions, position] of KEYWORDS) {
      kw.push({
        id: sdId(),
        siteId,
        query,
        clicks: Math.round(clicks / 28 + rand(-6, 6)),
        impressions: Math.round(impressions / 28 + rand(-40, 40)),
        position: position + rand(-0.4, 0.4),
        date: new Date(now - d * 86400_000),
      });
    }
  }
  await database.insert(sdKeyword).values(kw);

  const mentions: (typeof sdMention.$inferInsert)[] = [];
  for (let i = 0; i < 14; i++) {
    const [platform, tpl] = pick(MENTION_TEMPLATES);
    mentions.push({
      id: sdId(),
      siteId,
      platform,
      author: `@${pick(NAMES).toLowerCase()}${randInt(1, 99)}`,
      text: tpl.replace("{app}", "this analytics tool"),
      url: `https://example.com/mention/${i}`,
      occurredAt: new Date(now - randInt(1, days) * 86400_000),
    });
  }
  await database.insert(sdMention).values(mentions);

  return {
    visitors: visitors.length,
    sessions: sessions.length,
    events: events.length,
    payments: payments.length,
    revenueCents: payments.reduce((s, p) => s + (p.amountCents ?? 0), 0),
  };
}
