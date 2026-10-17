import { Globe } from "lucide-react";
import { redirect } from "next/navigation";

import { firstSearchParam, taskRecoveryHref } from "../../src/ai-task-recovery";
import { EmptyState } from "../../src/kit/blocks/app/empty-state";
import { StatGrid, type StatItem } from "../../src/kit/blocks/app/stat-grid";
import { DashboardFrame } from "../../src/supadata/web/frame";
import { BreakdownPanel } from "../../src/supadata/web/breakdown";
import { TrendChart } from "../../src/supadata/web/trend-chart";
import { CreateSiteForm } from "../../src/supadata/web/forms";
import {
  breakdown,
  overview,
  realtime,
  resolveRange,
  timeseries,
} from "../../src/supadata/queries";
import {
  fmtDuration,
  fmtMoney,
  fmtNum,
  fmtPct,
  percentChange,
  previousRange,
} from "../../src/supadata/format";
import styles from "../../src/supadata/web/dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The AI task console moved to /ai; keep previously shared
  // /dashboard?taskId|submissionKey recovery links landing on it.
  const query = (await searchParams) ?? {};
  const recovery = taskRecoveryHref(query);
  if (recovery !== null) {
    redirect(recovery);
  }

  const sp = { site: firstSearchParam(query.site), period: firstSearchParam(query.period) };
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) {
          return (
            <div className={styles.emptyWrap}>
              <EmptyState
                icon={<Globe />}
                text="Track visitors, referrers, and revenue for your product."
                title="Add your first site"
              />
              <ol className={styles.emptySteps}>
                <li>Add a site with its domain.</li>
                <li>Paste the tracking snippet before the closing head tag.</li>
                <li>Watch visitors arrive — the Live tab shows them in real time.</li>
              </ol>
              <CreateSiteForm />
            </div>
          );
        }
        const range = resolveRange(sp.period ?? "30d");
        const prevRange = previousRange(range);
        const [
          ov,
          prevOv,
          live,
          series,
          pages,
          sources,
          channels,
          countries,
          devices,
          browsers,
          oses,
        ] = await Promise.all([
          overview(ctx.site.id, range),
          overview(ctx.site.id, prevRange),
          realtime(ctx.site.id),
          timeseries(ctx.site.id, range),
          breakdown(ctx.site.id, range, "page", 12),
          breakdown(ctx.site.id, range, "source", 12),
          breakdown(ctx.site.id, range, "channel", 12),
          breakdown(ctx.site.id, range, "country", 12),
          breakdown(ctx.site.id, range, "device", 6),
          breakdown(ctx.site.id, range, "browser", 8),
          breakdown(ctx.site.id, range, "os", 8),
        ]);
        const delta = (
          current: number,
          previous: number,
          goodWhen: "up" | "down" = "up",
        ): StatItem["delta"] => ({ change: percentChange(current, previous), goodWhen });
        return (
          <>
            <header className={styles.pageHead}>
              <h1 className={styles.title}>Overview</h1>
              <span className={styles.domain}>{ctx.site.domain}</span>
              <a className={styles.livePill} href={`/dashboard/live?site=${ctx.site.id}`}>
                <span aria-hidden="true" className={styles.liveDot} />
                {live.online} online
              </a>
            </header>
            <StatGrid
              items={[
                {
                  delta: delta(ov.visitors, prevOv.visitors),
                  label: "Visitors",
                  value: fmtNum(ov.visitors),
                },
                {
                  delta: delta(ov.pageviews, prevOv.pageviews),
                  label: "Pageviews",
                  value: fmtNum(ov.pageviews),
                },
                {
                  delta: delta(ov.bounceRate, prevOv.bounceRate, "down"),
                  label: "Bounce rate",
                  value: fmtPct(ov.bounceRate),
                },
                {
                  delta: delta(ov.avgSessionSeconds, prevOv.avgSessionSeconds),
                  label: "Avg. session",
                  value: fmtDuration(ov.avgSessionSeconds),
                },
                {
                  delta: delta(ov.revenueCents, prevOv.revenueCents),
                  label: "Revenue",
                  value: fmtMoney(ov.revenueCents),
                },
                {
                  delta: delta(ov.conversionRate, prevOv.conversionRate),
                  hint: `${ov.revenueVisitors} paying`,
                  label: "Conversion",
                  value: fmtPct(ov.conversionRate),
                },
              ]}
            />
            <TrendChart
              points={series.map((p) => ({
                date: p.date,
                visitors: p.visitors,
                pageviews: p.pageviews,
                revenueCents: p.revenueCents,
              }))}
            />
            <div className={styles.panels}>
              <BreakdownPanel
                groups={[
                  { id: "pages", label: "Pages", rows: pages ?? [] },
                  { id: "sources", label: "Sources", rows: sources ?? [] },
                  { id: "channels", label: "Channels", rows: channels ?? [] },
                ]}
              />
              <BreakdownPanel
                groups={[
                  { id: "countries", label: "Countries", rows: countries ?? [] },
                  { id: "devices", label: "Devices", rows: devices ?? [] },
                  { id: "browsers", label: "Browsers", rows: browsers ?? [] },
                  { id: "os", label: "OS", rows: oses ?? [] },
                ]}
              />
            </div>
          </>
        );
      }}
    </DashboardFrame>
  );
}
