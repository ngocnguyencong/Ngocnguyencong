import "server-only";

import { sdFunnel, sdSite } from "@supastack/db";
import { eq } from "drizzle-orm";

import { database } from "./auth-runtime";
import {
  breakdown,
  funnelResults,
  overview,
  realtime,
  resolveRange,
  timeseries,
} from "./supadata/queries";

/** Share id of the site whose live data powers the landing vignettes. */
const DEMO_SHARE_ID = "demo";

export interface LandingPreview {
  siteName: string;
  shareUrl: string;
  overview: {
    visitors: number;
    pageviews: number;
    bounceRate: number;
    avgSessionSeconds: number;
    revenueCents: number;
    conversionRate: number;
  };
  trend: { date: string; visitors: number; pageviews: number; revenueCents: number }[];
  topPages: { value: string; visitors: number; revenueCents: number }[];
  channels: { value: string; visitors: number; revenueCents: number }[];
  live: {
    online: number;
    visitors: { page: string | null; country: string | null; device: string | null }[];
  };
  funnel: { name: string; steps: { label: string; visitors: number; conversion: number }[] } | null;
}

/**
 * Loads real analytics for the landing's product vignettes. Returns null when
 * no demo site exists (fresh install) so the page degrades to copy alone —
 * callers must never let this throw into the public render path.
 */
export async function loadLandingPreview(): Promise<LandingPreview | null> {
  try {
    const [site] = await database
      .select()
      .from(sdSite)
      .where(eq(sdSite.shareId, DEMO_SHARE_ID))
      .limit(1);
    if (!site) return null;

    const range = resolveRange("30d");
    const [ov, series, pages, channels, live, funnels] = await Promise.all([
      overview(site.id, range),
      timeseries(site.id, range),
      breakdown(site.id, range, "page", 5),
      breakdown(site.id, range, "channel", 6),
      realtime(site.id),
      database.select().from(sdFunnel).where(eq(sdFunnel.siteId, site.id)).limit(1),
    ]);

    const funnelRow = funnels[0];
    const funnelSteps = funnelRow
      ? (JSON.parse(funnelRow.steps) as { type: "pageview" | "event"; value: string }[])
      : null;
    const funnel =
      funnelRow && funnelSteps
        ? await funnelResults(site.id, range, funnelSteps).then((res) => ({
            name: funnelRow.name,
            steps: res.steps.map((s) => ({
              label: s.type === "pageview" ? s.value : `event: ${s.value}`,
              visitors: s.visitors,
              conversion: s.conversion,
            })),
          }))
        : null;

    return {
      siteName: site.name,
      shareUrl: `/share/${site.shareId}`,
      overview: {
        visitors: ov.visitors,
        pageviews: ov.pageviews,
        bounceRate: ov.bounceRate,
        avgSessionSeconds: ov.avgSessionSeconds,
        revenueCents: ov.revenueCents,
        conversionRate: ov.conversionRate,
      },
      trend: series,
      topPages: (pages ?? []).map((r) => ({
        value: r.value,
        visitors: r.visitors,
        revenueCents: r.revenueCents,
      })),
      channels: (channels ?? []).map((r) => ({
        value: r.value,
        visitors: r.visitors,
        revenueCents: r.revenueCents,
      })),
      live: {
        online: live.online,
        visitors: live.visitors.slice(0, 5).map((v) => ({
          page: v.page,
          country: v.country,
          device: v.device,
        })),
      },
      funnel,
    };
  } catch {
    return null;
  }
}
