import "server-only";

import { sdEvent, sdGoal, sdSession, sdSite, sdVisitor } from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "../auth-runtime";
import type { SdSite } from "./auth";
import { classifySource } from "./channels";
import { geoFromHeaders, clientIp } from "./geo";
import { dailyVisitorKey, sdId, sha256 } from "./id";
import { parseUA } from "./ua";

const CLICK_ID_PARAMS = [
  "gclid",
  "gclsrc",
  "fbclid",
  "msclkid",
  "ttclid",
  "twclid",
  "wbraid",
  "gbraid",
  "li_fat_id",
] as const;

const ingestSchema = z.object({
  site_id: z.string().min(1),
  visitor_id: z.string().max(96).nullish(),
  session_id: z.string().max(96).nullish(),
  type: z.enum(["pageview", "custom", "identify", "external_link"]).default("pageview"),
  name: z.string().max(255).nullish(),
  props: z.record(z.string(), z.unknown()).nullish(),
  url: z.string().url(),
  referrer: z.string().nullish(),
  timestamp: z.coerce.date().nullish(),
  language: z.string().max(40).nullish(),
  timezone: z.string().max(80).nullish(),
  utm_source: z.string().max(255).nullish(),
  utm_medium: z.string().max(255).nullish(),
  utm_campaign: z.string().max(255).nullish(),
  utm_term: z.string().max(255).nullish(),
  utm_content: z.string().max(255).nullish(),
  click_ids: z.record(z.string(), z.string()).nullish(),
  user_id: z.string().max(128).nullish(),
  email: z.string().max(255).nullish(),
  visitor_name: z.string().max(255).nullish(),
  visitor_image: z.string().max(2048).nullish(),
});

export type IngestResult =
  { ok: true; deduped?: boolean } | { ok: false; code: number; message: string };

function hostAllowed(site: SdSite, host: string): boolean {
  const normalize = (h: string) => h.toLowerCase().replace(/^www\./, "");
  const target = normalize(host);
  const domain = normalize(site.domain);
  if (target === domain || target.endsWith("." + domain)) return true;
  if (target === "localhost" || target === "127.0.0.1") return true;
  return site.allowedHostnames
    .split(",")
    .map((h) => normalize(h.trim()))
    .filter(Boolean)
    .some((h) => target === h || target.endsWith("." + h));
}

export async function processEvent(raw: unknown, requestHeaders: Headers): Promise<IngestResult> {
  const parsed = ingestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 400, message: "Invalid payload" };
  const body = parsed.data;

  const [site] = await database.select().from(sdSite).where(eq(sdSite.id, body.site_id)).limit(1);
  if (!site) return { ok: false, code: 404, message: "Unknown site" };

  const page = new URL(body.url);
  if (!hostAllowed(site, page.hostname)) {
    return { ok: false, code: 403, message: "Hostname not allowed" };
  }

  const ua = parseUA(requestHeaders.get("user-agent"));
  if (ua.isBot) return { ok: true, deduped: true };

  const now = body.timestamp ?? new Date();
  const geo = geoFromHeaders(requestHeaders);
  const ip = clientIp(requestHeaders);

  // UTMs may arrive on the URL rather than as fields — URL wins for click ids.
  const q = page.searchParams;
  const utmSource = body.utm_source ?? q.get("utm_source");
  const utmMedium = body.utm_medium ?? q.get("utm_medium");
  const utmCampaign = body.utm_campaign ?? q.get("utm_campaign");
  const utmTerm = body.utm_term ?? q.get("utm_term");
  const utmContent = body.utm_content ?? q.get("utm_content");
  const clickIds: Record<string, string> = { ...(body.click_ids ?? {}) };
  for (const p of CLICK_ID_PARAMS) {
    const v = q.get(p);
    if (v) clickIds[p] = v;
  }
  const primaryClickId = clickIds.gclid ?? clickIds.fbclid ?? clickIds.msclkid ?? null;

  const { channel, source, medium } = classifySource({
    referrer: body.referrer,
    utmSource,
    utmMedium,
    clickId: primaryClickId,
    hostname: page.hostname,
  });

  const path = page.pathname;
  const hostname = page.hostname;

  // ---- visitor ----
  const visitorKey = site.cookieless
    ? dailyVisitorKey(site.id, ip, requestHeaders.get("user-agent") ?? "", now)
    : body.visitor_id ||
      sha256(`${site.id}|anon|${ip}|${requestHeaders.get("user-agent") ?? ""}`).slice(0, 32);

  const [existingVisitor] = await database
    .select()
    .from(sdVisitor)
    .where(and(eq(sdVisitor.siteId, site.id), eq(sdVisitor.visitorKey, visitorKey)))
    .limit(1);

  let visitor = existingVisitor;
  if (!visitor) {
    const [created] = await database
      .insert(sdVisitor)
      .values({
        id: sdId(),
        siteId: site.id,
        visitorKey,
        firstSeenAt: now,
        lastSeenAt: now,
        firstReferrer: body.referrer ?? null,
        firstUtmSource: utmSource,
        firstUtmMedium: utmMedium,
        firstUtmCampaign: utmCampaign,
        firstUtmTerm: utmTerm,
        firstUtmContent: utmContent,
        firstClickId: primaryClickId,
        entryPage: path,
        lastReferrer: body.referrer ?? null,
        lastUtmSource: utmSource,
        lastUtmMedium: utmMedium,
        lastUtmCampaign: utmCampaign,
        lastClickId: primaryClickId,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        language: body.language ?? null,
        timezone: body.timezone ?? null,
      })
      .returning();
    if (!created) return { ok: false, code: 500, message: "Failed to create visitor" };
    visitor = created;
  } else {
    const updates: Partial<typeof sdVisitor.$inferInsert> = {
      lastSeenAt: now,
      lastReferrer: body.referrer ?? visitor.lastReferrer,
      lastUtmSource: utmSource ?? visitor.lastUtmSource,
      lastUtmMedium: utmMedium ?? visitor.lastUtmMedium,
      lastUtmCampaign: utmCampaign ?? visitor.lastUtmCampaign,
      lastClickId: primaryClickId ?? visitor.lastClickId,
      updatedAt: now,
    };
    if (body.type === "identify") {
      if (body.user_id) updates.userId = body.user_id;
      if (body.email) updates.email = body.email;
      if (body.visitor_name) updates.name = body.visitor_name;
      if (body.visitor_image) updates.image = body.visitor_image;
    }
    await database.update(sdVisitor).set(updates).where(eq(sdVisitor.id, visitor.id));
    visitor = { ...visitor, ...updates } as typeof visitor;
  }

  // ---- session (30-min inactivity window, keyed by tracker session_id) ----
  const sessionKey = body.session_id || `auto-${visitorKey}-${now.toISOString().slice(0, 13)}`;
  const SESSION_WINDOW_MS = 30 * 60 * 1000;
  const [existingSession] = await database
    .select()
    .from(sdSession)
    .where(and(eq(sdSession.siteId, site.id), eq(sdSession.sessionKey, sessionKey)))
    .limit(1);

  const sessionIsNew =
    !existingSession ||
    now.getTime() - existingSession.lastActivityAt.getTime() > SESSION_WINDOW_MS;

  let session: typeof sdSession.$inferSelect | null | undefined = existingSession;
  if (sessionIsNew) {
    const [created] = await database
      .insert(sdSession)
      .values({
        id: sdId(),
        siteId: site.id,
        visitorId: visitor.id,
        sessionKey,
        startedAt: now,
        lastActivityAt: now,
        entryPage: path,
        referrer: body.referrer ?? null,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        clickId: primaryClickId,
        channel,
        source,
        medium,
        campaign: utmCampaign,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
      })
      .onConflictDoNothing()
      .returning();
    session = created ?? existingSession ?? null;
    if (session) {
      await database
        .update(sdVisitor)
        .set({ sessionCount: visitor.sessionCount + 1 })
        .where(eq(sdVisitor.id, visitor.id));
    }
  }
  if (!session) {
    const [row] = await database
      .select()
      .from(sdSession)
      .where(and(eq(sdSession.siteId, site.id), eq(sdSession.sessionKey, sessionKey)))
      .limit(1);
    session = row ?? null;
  }

  // ---- event ----
  const eventType = body.type;
  const goals = await database.select().from(sdGoal).where(eq(sdGoal.siteId, site.id));
  const matchingGoals = goals.filter((g) => {
    if (g.type === "pageview" && body.type === "pageview") {
      return g.value === path || (g.value.endsWith("*") && path.startsWith(g.value.slice(0, -1)));
    }
    if (g.type === "event" && body.type === "custom") return g.value === body.name;
    return false;
  });

  const base = {
    id: sdId(),
    siteId: site.id,
    visitorId: visitor.id,
    sessionId: session?.id ?? null,
    name: body.name ?? null,
    path,
    hostname,
    referrer: body.referrer ?? null,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    clickIds: Object.keys(clickIds).length ? JSON.stringify(clickIds) : null,
    props: body.props ? JSON.stringify(body.props) : null,
    channel,
    source,
    medium,
    campaign: utmCampaign,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    createdAt: now,
  };

  await database.insert(sdEvent).values({ ...base, type: eventType });
  for (const goal of matchingGoals) {
    await database.insert(sdEvent).values({ ...base, id: sdId(), type: "goal", name: goal.name });
  }

  // ---- session aggregates ----
  if (session && body.type === "pageview") {
    await database
      .update(sdSession)
      .set({
        lastActivityAt: now,
        pageviews: session.pageviews + 1,
        isBounce: session.pageviews + 1 <= 1,
      })
      .where(eq(sdSession.id, session.id));
    await database
      .update(sdVisitor)
      .set({ pageviewCount: visitor.pageviewCount + 1 })
      .where(eq(sdVisitor.id, visitor.id));
  } else if (session) {
    await database
      .update(sdSession)
      .set({ lastActivityAt: now })
      .where(eq(sdSession.id, session.id));
  }

  return { ok: true };
}
