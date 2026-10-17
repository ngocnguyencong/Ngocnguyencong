import { sdSite } from "@supastack/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { database } from "../../../src/auth-runtime";
import { StatGrid } from "../../../src/kit/blocks/app/stat-grid";
import { BreakdownPanel } from "../../../src/supadata/web/breakdown";
import { TrendChart } from "../../../src/supadata/web/trend-chart";
import { breakdown, overview, resolveRange, timeseries } from "../../../src/supadata/queries";
import { fmtDuration, fmtMoney, fmtNum, fmtPct } from "../../../src/supadata/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const [site] = await database
    .select({ name: sdSite.name })
    .from(sdSite)
    .where(eq(sdSite.shareId, shareId))
    .limit(1);
  return {
    title: site ? `${site.name} — shared analytics` : "Shared analytics",
    // User-generated dashboards: crawlable but kept out of the index.
    robots: { index: false, follow: false },
  };
}

/** Public read-only dashboard for a site's share link. */
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { shareId } = await params;
  const sp = await searchParams;
  const [site] = await database.select().from(sdSite).where(eq(sdSite.shareId, shareId)).limit(1);
  if (!site) notFound();

  const range = resolveRange(sp.period ?? "30d");
  const [ov, series, pages, sources, channels, countries] = await Promise.all([
    overview(site.id, range),
    timeseries(site.id, range),
    breakdown(site.id, range, "page", 10),
    breakdown(site.id, range, "source", 10),
    breakdown(site.id, range, "channel", 10),
    breakdown(site.id, range, "country", 10),
  ]);

  return (
    <div
      className="token-root app-theme"
      style={{ minHeight: "100vh", background: "var(--page)", padding: "32px 20px" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{site.name}</h1>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
              Public analytics · {site.domain}
            </p>
          </div>
          <nav aria-label="Period" style={{ display: "flex", gap: 8 }}>
            {(["24h", "7d", "30d", "90d"] as const).map((p) => (
              <a
                key={p}
                href={`?period=${p}`}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 6,
                  textDecoration: "none",
                  color: (sp.period ?? "30d") === p ? "var(--text)" : "var(--muted)",
                  background: (sp.period ?? "30d") === p ? "var(--section)" : "transparent",
                  fontWeight: (sp.period ?? "30d") === p ? 500 : 400,
                }}
              >
                {p === "24h" ? "Today" : p.toUpperCase()}
              </a>
            ))}
          </nav>
        </header>
        <StatGrid
          items={[
            { label: "Visitors", value: fmtNum(ov.visitors) },
            { label: "Pageviews", value: fmtNum(ov.pageviews) },
            { label: "Bounce rate", value: fmtPct(ov.bounceRate) },
            { label: "Avg. session", value: fmtDuration(ov.avgSessionSeconds) },
            { label: "Revenue", value: fmtMoney(ov.revenueCents) },
          ]}
        />
        <div style={{ marginTop: 16 }}>
          <TrendChart
            points={series.map((p) => ({
              date: p.date,
              visitors: p.visitors,
              pageviews: p.pageviews,
              revenueCents: p.revenueCents,
            }))}
          />
        </div>
        <BreakdownPanel
          groups={[
            { id: "pages", label: "Pages", rows: pages ?? [] },
            { id: "sources", label: "Sources", rows: sources ?? [] },
            { id: "channels", label: "Channels", rows: channels ?? [] },
            { id: "countries", label: "Countries", rows: countries ?? [] },
          ]}
        />
      </div>
    </div>
  );
}
