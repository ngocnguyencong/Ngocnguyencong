import "server-only";

import { sql } from "drizzle-orm";

import { database } from "../auth-runtime";

export interface Range {
  from: Date;
  to: Date;
}

export function resolveRange(
  period: string | null,
  from?: string | null,
  to?: string | null,
): Range {
  const now = new Date();
  const toD = to ? new Date(to) : now;
  const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "12m": 365 }[period ?? ""] ?? 30;
  const fromD = from ? new Date(from) : new Date(toD.getTime() - days * 86400_000);
  return { from: fromD, to: toD };
}

interface Row {
  [k: string]: unknown;
}

async function q<T extends Row>(frag: ReturnType<typeof sql>): Promise<T[]> {
  const res = await database.execute(frag);
  return res as unknown as T[];
}

// ---------- overview ----------

export interface Overview {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgSessionSeconds: number;
  revenueCents: number;
  revenueVisitors: number;
  conversionRate: number;
  events: number;
}

export async function overview(siteId: string, r: Range): Promise<Overview> {
  const [row] = await q<{
    visitors: string;
    pageviews: string;
    events: string;
    sessions: string;
    bounces: string;
    avg_seconds: string | null;
    revenue_cents: string;
    revenue_visitors: string;
  }>(sql`
    SELECT
      (SELECT count(DISTINCT visitor_id) FROM sd_event WHERE site_id = ${siteId} AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()}) AS visitors,
      (SELECT count(*) FROM sd_event WHERE site_id = ${siteId} AND type = 'pageview' AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()}) AS pageviews,
      (SELECT count(*) FROM sd_event WHERE site_id = ${siteId} AND type IN ('custom','goal','external_link') AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()}) AS events,
      (SELECT count(*) FROM sd_session WHERE site_id = ${siteId} AND started_at >= ${r.from.toISOString()} AND started_at < ${r.to.toISOString()}) AS sessions,
      (SELECT count(*) FROM sd_session WHERE site_id = ${siteId} AND is_bounce AND started_at >= ${r.from.toISOString()} AND started_at < ${r.to.toISOString()}) AS bounces,
      (SELECT avg(EXTRACT(EPOCH FROM (last_activity_at - started_at))) FROM sd_session WHERE site_id = ${siteId} AND started_at >= ${r.from.toISOString()} AND started_at < ${r.to.toISOString()}) AS avg_seconds,
      (SELECT coalesce(sum(amount_cents),0) FROM sd_payment WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()} AND status = 'active' AND kind = 'payment') AS revenue_cents,
      (SELECT count(DISTINCT visitor_id) FROM sd_payment WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()} AND status = 'active' AND kind = 'payment' AND visitor_id IS NOT NULL) AS revenue_visitors
  `);
  const visitors = Number(row?.visitors ?? 0);
  const sessions = Number(row?.sessions ?? 0);
  const revenueVisitors = Number(row?.revenue_visitors ?? 0);
  return {
    visitors,
    pageviews: Number(row?.pageviews ?? 0),
    sessions,
    bounceRate: sessions ? Number(row?.bounces ?? 0) / sessions : 0,
    avgSessionSeconds: Number(row?.avg_seconds ?? 0),
    revenueCents: Number(row?.revenue_cents ?? 0),
    revenueVisitors,
    conversionRate: visitors ? revenueVisitors / visitors : 0,
    events: Number(row?.events ?? 0),
  };
}

// ---------- timeseries ----------

export interface TimeseriesPoint {
  date: string;
  visitors: number;
  pageviews: number;
  sessions: number;
  revenueCents: number;
}

export async function timeseries(siteId: string, r: Range): Promise<TimeseriesPoint[]> {
  const spanDays = (r.to.getTime() - r.from.getTime()) / 86400_000;
  const bucket =
    spanDays <= 2 ? sql`date_trunc('hour', created_at)` : sql`date_trunc('day', created_at)`;
  const payBucket =
    spanDays <= 2 ? sql`date_trunc('hour', occurred_at)` : sql`date_trunc('day', occurred_at)`;
  const rows = await q<{
    date: string;
    visitors: string;
    pageviews: string;
    sessions: string;
    revenue_cents: string;
  }>(sql`
    WITH events AS (
      SELECT ${bucket} AS d,
             count(DISTINCT visitor_id) AS visitors,
             count(*) FILTER (WHERE type = 'pageview') AS pageviews,
             count(DISTINCT session_id) AS sessions
      FROM sd_event
      WHERE site_id = ${siteId} AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()}
      GROUP BY 1
    ), pays AS (
      SELECT ${payBucket} AS d, sum(amount_cents) AS revenue_cents
      FROM sd_payment
      WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()} AND status = 'active' AND kind = 'payment'
      GROUP BY 1
    )
    SELECT to_char(e.d, 'YYYY-MM-DD"T"HH24:MI') AS date, e.visitors, e.pageviews, e.sessions,
           coalesce(p.revenue_cents, 0) AS revenue_cents
    FROM events e LEFT JOIN pays p ON p.d = e.d
    ORDER BY e.d
  `);
  return rows.map((r2) => ({
    date: String(r2.date),
    visitors: Number(r2.visitors),
    pageviews: Number(r2.pageviews),
    sessions: Number(r2.sessions),
    revenueCents: Number(r2.revenue_cents),
  }));
}

// ---------- realtime ----------

export async function realtime(siteId: string) {
  const rows = await q<{
    visitor_id: string;
    country: string | null;
    device: string | null;
    browser: string | null;
    page: string | null;
    last: string;
    email: string | null;
    name: string | null;
  }>(sql`
    SELECT e.visitor_id, e.country, e.device, e.browser,
           (array_agg(e.path ORDER BY e.created_at DESC))[1] AS page,
           max(e.created_at) AS last,
           v.email, v.name
    FROM sd_event e JOIN sd_visitor v ON v.id = e.visitor_id
    WHERE e.site_id = ${siteId} AND e.created_at >= now() - interval '5 minutes'
    GROUP BY e.visitor_id, e.country, e.device, e.browser, v.email, v.name
    ORDER BY last DESC
    LIMIT 100
  `);
  return {
    online: rows.length,
    visitors: rows.map((r2) => ({
      visitorId: r2.visitor_id,
      country: r2.country,
      device: r2.device,
      browser: r2.browser,
      page: r2.page,
      lastSeenAt: r2.last,
      email: r2.email,
      name: r2.name,
    })),
  };
}

// ---------- breakdowns ----------

const DIMENSIONS: Record<string, { col: string; where?: string }> = {
  page: { col: "path", where: "type = 'pageview'" },
  referrer: { col: "referrer", where: "type = 'pageview'" },
  source: { col: "source" },
  channel: { col: "channel" },
  medium: { col: "medium" },
  campaign: { col: "campaign" },
  country: { col: "country" },
  region: { col: "region" },
  city: { col: "city" },
  device: { col: "device" },
  browser: { col: "browser" },
  os: { col: "os" },
  hostname: { col: "hostname" },
  event: { col: "name", where: "type IN ('custom','goal','external_link')" },
  goal: { col: "name", where: "type = 'goal'" },
};

export async function breakdown(siteId: string, r: Range, dimension: string, limit = 100) {
  const dim = DIMENSIONS[dimension];
  if (!dim) return null;
  const col = sql.raw(dim.col);
  const whereExtra = dim.where ? sql`AND ${sql.raw(dim.where)}` : sql``;
  // Revenue correlation: attribution dims join on sd_payment's own denormalized
  // columns; geo/device dims join through the paying visitor; page/event dims
  // credit revenue from visitors who touched that value.
  const paymentDims = new Set(["channel", "source", "medium", "campaign", "referrer"]);
  const visitorDims = new Set(["country", "region", "city", "device", "browser", "os"]);
  const touchDims = new Set(["page", "hostname", "event", "goal"]);
  const revenueFrag = paymentDims.has(dimension)
    ? sql`coalesce((
        SELECT sum(p.amount_cents) FROM sd_payment p
        WHERE p.site_id = e.site_id AND p.occurred_at >= ${r.from.toISOString()} AND p.occurred_at < ${r.to.toISOString()}
          AND p.status = 'active' AND p.kind = 'payment'
          AND p.${col} IS NOT DISTINCT FROM e.${col}), 0)`
    : visitorDims.has(dimension)
      ? sql`coalesce((
          SELECT sum(p.amount_cents) FROM sd_payment p JOIN sd_visitor pv ON pv.id = p.visitor_id
          WHERE p.site_id = e.site_id AND p.occurred_at >= ${r.from.toISOString()} AND p.occurred_at < ${r.to.toISOString()}
            AND p.status = 'active' AND p.kind = 'payment'
            AND pv.${col} IS NOT DISTINCT FROM e.${col}), 0)`
      : touchDims.has(dimension)
        ? sql`coalesce((
            SELECT sum(p.amount_cents) FROM sd_payment p
            WHERE p.site_id = e.site_id AND p.occurred_at >= ${r.from.toISOString()} AND p.occurred_at < ${r.to.toISOString()}
              AND p.status = 'active' AND p.kind = 'payment'
              AND p.visitor_id IN (
                SELECT DISTINCT te.visitor_id FROM sd_event te
                WHERE te.site_id = e.site_id AND te.${col} = e.${col}
              )), 0)`
        : sql`0`;
  const rows = await q<{
    value: string | null;
    visitors: string;
    pageviews: string;
    revenue_cents: string;
  }>(sql`
    SELECT ${col} AS value,
           count(DISTINCT e.visitor_id) AS visitors,
           count(*) FILTER (WHERE e.type = 'pageview') AS pageviews,
           ${revenueFrag} AS revenue_cents
    FROM sd_event e
    WHERE e.site_id = ${siteId} AND e.created_at >= ${r.from.toISOString()} AND e.created_at < ${r.to.toISOString()}
      AND ${col} IS NOT NULL ${whereExtra}
    GROUP BY 1, e.site_id
    ORDER BY visitors DESC
    LIMIT ${limit}
  `);
  return rows.map((r2) => ({
    value: r2.value ?? "(none)",
    visitors: Number(r2.visitors),
    pageviews: Number(r2.pageviews),
    revenueCents: Number(r2.revenue_cents),
  }));
}

// ---------- visitors ----------

export async function visitors(
  siteId: string,
  r: Range,
  opts: {
    search?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  } = {},
) {
  const search = opts.search?.trim();
  const searchFrag = search
    ? sql`AND (v.email ILIKE ${"%" + search + "%"} OR v.name ILIKE ${"%" + search + "%"} OR v.user_id ILIKE ${"%" + search + "%"} OR v.id = ${search})`
    : sql``;
  const rows = await q<{
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    country: string | null;
    city: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    last_seen: string;
    first_seen: string;
    sessions: number;
    pageviews: number;
    revenue_cents: number;
    is_customer: boolean;
    source: string | null;
  }>(sql`
    SELECT v.id, v.email, v.name, v.image, v.country, v.city, v.device, v.browser, v.os,
           v.last_seen_at AS last_seen, v.first_seen_at AS first_seen,
           v.session_count AS sessions, v.pageview_count AS pageviews,
           v.revenue_cents, v.is_customer, v.first_utm_source AS source
    FROM sd_visitor v
    WHERE v.site_id = ${siteId} AND v.last_seen_at >= ${r.from.toISOString()} ${searchFrag}
    ORDER BY v.last_seen_at DESC
    LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}
  `);
  const [cnt] = await q<{ n: string }>(sql`
    SELECT count(*) AS n FROM sd_visitor v
    WHERE v.site_id = ${siteId} AND v.last_seen_at >= ${r.from.toISOString()} ${searchFrag}
  `);
  return { total: Number(cnt?.n ?? 0), visitors: rows };
}

export async function visitorDetail(siteId: string, visitorId: string) {
  const [v] = await q<Row>(sql`
    SELECT v.*, count(DISTINCT p.id) AS payment_count, coalesce(sum(p.amount_cents),0) AS paid_cents
    FROM sd_visitor v LEFT JOIN sd_payment p ON p.visitor_id = v.id AND p.status = 'active'
    WHERE v.site_id = ${siteId} AND v.id = ${visitorId}
    GROUP BY v.id
  `);
  if (!v) return null;
  const events = await q<Row>(sql`
    SELECT id, type, name, path, created_at, source, medium, campaign, country, device, browser, props
    FROM sd_event WHERE site_id = ${siteId} AND visitor_id = ${visitorId}
    ORDER BY created_at DESC LIMIT 200
  `);
  const payments = await q<Row>(sql`
    SELECT id, provider, external_id, amount_cents, currency, product_name, occurred_at, channel, source, status
    FROM sd_payment WHERE site_id = ${siteId} AND visitor_id = ${visitorId}
    ORDER BY occurred_at DESC
  `);
  return { visitor: v, events, payments };
}

// ---------- funnels ----------

export interface FunnelStepSpec {
  type: "pageview" | "event";
  value: string;
}

export async function funnelResults(siteId: string, r: Range, steps: FunnelStepSpec[]) {
  if (steps.length === 0) return { steps: [] };
  // Per prefix i: count visitors who hit steps 0..i with non-decreasing timestamps.
  const stepConds = steps.map((s) =>
    s.type === "pageview"
      ? sql`(type = 'pageview' AND path = ${s.value})`
      : sql`(type IN ('custom','goal') AND name = ${s.value})`,
  );
  const results: { step: number; visitors: number }[] = [];
  for (let i = 0; i < stepConds.length; i++) {
    const ctes = sql.join(
      stepConds.slice(0, i + 1).map(
        (c, j) => sql`
          s${sql.raw(String(j))} AS (
            SELECT visitor_id, min(created_at) AS t
            FROM sd_event
            WHERE site_id = ${siteId} AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()} AND ${c}
            GROUP BY visitor_id
          )`,
      ),
      sql`, `,
    );
    const joins = sql.join(
      Array.from(
        { length: i },
        (_, j) =>
          sql`JOIN ${sql.raw(`s${j + 1}`)} ON ${sql.raw(`s${j + 1}`)}.visitor_id = s0.visitor_id AND ${sql.raw(`s${j + 1}`)}.t >= ${sql.raw(`s${j}`)}.t`,
      ),
      sql` `,
    );
    const [row] = await q<{ n: string }>(sql`
      WITH ${ctes}
      SELECT count(*) AS n FROM s0 ${joins}
    `);
    results.push({ step: i, visitors: Number(row?.n ?? 0) });
  }
  const base = results[0]?.visitors || 1;
  return {
    steps: steps.map((s, i) => ({
      ...s,
      visitors: results[i]?.visitors ?? 0,
      conversion: (results[i]?.visitors ?? 0) / base,
      stepConversion:
        i === 0 ? 1 : (results[i]?.visitors ?? 0) / Math.max(results[i - 1]?.visitors ?? 0, 1),
    })),
  };
}

// ---------- goals ----------

export async function goalStats(siteId: string, r: Range) {
  return q<{ name: string; visitors: string; total: string }>(sql`
    SELECT name, count(DISTINCT visitor_id) AS visitors, count(*) AS total
    FROM sd_event WHERE site_id = ${siteId} AND type = 'goal' AND created_at >= ${r.from.toISOString()} AND created_at < ${r.to.toISOString()}
    GROUP BY name ORDER BY visitors DESC
  `);
}

// ---------- revenue / insights ----------

export async function revenueAttribution(
  siteId: string,
  r: Range,
  by: "channel" | "source" | "campaign" = "channel",
) {
  return q<{ value: string | null; revenue_cents: string; customers: string }>(sql`
    SELECT ${sql.raw(by)} AS value, sum(amount_cents) AS revenue_cents, count(DISTINCT visitor_id) AS customers
    FROM sd_payment
    WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()}
      AND status = 'active' AND kind = 'payment'
    GROUP BY 1 ORDER BY revenue_cents DESC
  `);
}

export async function mrrSeries(siteId: string, r: Range) {
  return q<{ d: string; mrr_cents: string }>(sql`
    SELECT d, sum(mrr_cents) OVER (ORDER BY d) AS mrr_cents
    FROM (
      SELECT to_char(date_trunc('day', occurred_at), 'YYYY-MM-DD') AS d,
             sum(mrr_cents) AS mrr_cents
      FROM sd_payment
      WHERE site_id = ${siteId} AND status = 'active' AND kind = 'payment'
        AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()}
      GROUP BY 1
    ) t
    ORDER BY d
  `);
}

export async function revenueSummary(siteId: string, r: Range) {
  const [row] = await q<{
    revenue_cents: string;
    payments: string;
    customers: string;
    mrr_cents: string;
    refunds_cents: string;
    avg_order: string | null;
  }>(sql`
    SELECT
      sum(amount_cents) FILTER (WHERE kind = 'payment' AND status = 'active') AS revenue_cents,
      count(*) FILTER (WHERE kind = 'payment' AND status = 'active') AS payments,
      count(DISTINCT visitor_id) FILTER (WHERE kind = 'payment' AND status = 'active') AS customers,
      sum(mrr_cents) FILTER (WHERE kind = 'payment' AND status = 'active') AS mrr_cents,
      sum(amount_cents) FILTER (WHERE kind = 'refund') AS refunds_cents,
      avg(amount_cents) FILTER (WHERE kind = 'payment' AND status = 'active') AS avg_order
    FROM sd_payment
    WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()}
  `);
  return {
    revenueCents: Number(row?.revenue_cents ?? 0),
    payments: Number(row?.payments ?? 0),
    customers: Number(row?.customers ?? 0),
    mrrCents: Number(row?.mrr_cents ?? 0),
    refundsCents: Number(row?.refunds_cents ?? 0),
    avgOrderCents: Math.round(Number(row?.avg_order ?? 0)),
  };
}

export async function payments(siteId: string, r: Range, limit = 100) {
  return q<Row>(sql`
    SELECT p.id, p.provider, p.external_id, p.kind, p.amount_cents, p.currency, p.interval,
           p.mrr_cents, p.product_name, p.status, p.channel, p.source, p.campaign,
           p.occurred_at, v.email AS visitor_email, v.id AS visitor_id
    FROM sd_payment p LEFT JOIN sd_visitor v ON v.id = p.visitor_id
    WHERE p.site_id = ${siteId} AND p.occurred_at >= ${r.from.toISOString()} AND p.occurred_at < ${r.to.toISOString()}
    ORDER BY p.occurred_at DESC LIMIT ${limit}
  `);
}

// ---------- mentions / keywords / alerts ----------

export async function mentions(siteId: string, r: Range) {
  return q<Row>(sql`
    SELECT id, platform, author, text, url, occurred_at
    FROM sd_mention WHERE site_id = ${siteId} AND occurred_at >= ${r.from.toISOString()} AND occurred_at < ${r.to.toISOString()}
    ORDER BY occurred_at DESC LIMIT 100
  `);
}

export async function keywords(siteId: string, r: Range) {
  return q<Row>(sql`
    SELECT query, sum(clicks) AS clicks, sum(impressions) AS impressions,
           avg(position) AS position
    FROM sd_keyword WHERE site_id = ${siteId} AND date >= ${r.from.toISOString()} AND date < ${r.to.toISOString()}
    GROUP BY query ORDER BY clicks DESC LIMIT 200
  `);
}
