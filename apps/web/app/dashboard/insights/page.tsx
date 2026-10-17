import { StatGrid } from "../../../src/kit/blocks/app/stat-grid";
import { DashboardFrame } from "../../../src/supadata/web/frame";
import { BreakdownPanel } from "../../../src/supadata/web/breakdown";
import {
  mrrSeries,
  payments,
  resolveRange,
  revenueAttribution,
  revenueSummary,
} from "../../../src/supadata/queries";
import { fmtDateTime, fmtMoney, fmtNum, text } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";
import dashStyles from "../../../src/supadata/web/dashboard.module.css";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) return <p>No site selected.</p>;
        const site = ctx.site;
        const range = resolveRange(sp.period ?? "30d");
        const [summary, byChannel, bySource, byCampaign, mrr, payList] = await Promise.all([
          revenueSummary(site.id, range),
          revenueAttribution(ctx.site.id, range, "channel"),
          revenueAttribution(ctx.site.id, range, "source"),
          revenueAttribution(ctx.site.id, range, "campaign"),
          mrrSeries(ctx.site.id, range),
          payments(ctx.site.id, range, 100),
        ]);
        const toRows = (
          rows: { value: string | null; revenue_cents: string; customers: string }[],
        ) =>
          rows.map((r) => ({
            value: r.value ?? "(direct)",
            visitors: Number(r.customers),
            pageviews: 0,
            revenueCents: Number(r.revenue_cents),
          }));
        return (
          <>
            <StatGrid
              items={[
                {
                  label: "Revenue",
                  value: fmtMoney(summary.revenueCents),
                  hint: `${summary.payments} payments`,
                },
                { label: "MRR", value: fmtMoney(summary.mrrCents) },
                { label: "Customers", value: fmtNum(summary.customers) },
                {
                  label: "LTV",
                  value: fmtMoney(
                    summary.customers ? Math.round(summary.revenueCents / summary.customers) : 0,
                  ),
                },
                { label: "Avg. order", value: fmtMoney(summary.avgOrderCents) },
                { label: "Refunds", value: fmtMoney(summary.refundsCents) },
              ]}
            />
            <div className={dashStyles.panels}>
              <BreakdownPanel
                groups={[
                  { id: "channel", label: "Channels", rows: toRows(byChannel) },
                  { id: "source", label: "Sources", rows: toRows(bySource) },
                  { id: "campaign", label: "Campaigns", rows: toRows(byCampaign) },
                ]}
                showRevenue={true}
              />
              <div className={styles.wrap}>
                <div className={styles.header}>
                  <strong>Recent payments</strong>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Attributed to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payList.length === 0 && (
                      <tr>
                        <td className={styles.empty} colSpan={4}>
                          No payments in this range.
                        </td>
                      </tr>
                    )}
                    {payList.slice(0, 25).map((p) => (
                      <tr key={String(p.id)}>
                        <td>{fmtDateTime(String(p.occurred_at))}</td>
                        <td>
                          {p.visitor_id ? (
                            <a
                              className={styles.visitor}
                              href={`/dashboard/visitors/${text(p.visitor_id)}?site=${site.id}`}
                            >
                              {text(p.visitor_email, "visitor")}
                            </a>
                          ) : (
                            text(p.visitor_email)
                          )}
                        </td>
                        <td>
                          {fmtMoney(Number(p.amount_cents), text(p.currency, "usd"))}
                          {p.kind === "refund" ? " (refund)" : ""}
                        </td>
                        <td style={{ color: "var(--muted)" }}>{text(p.channel ?? p.source)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {mrr.length > 1 && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                MRR grew {fmtMoney(Number(mrr[0]?.mrr_cents ?? 0))} →{" "}
                {fmtMoney(Number(mrr[mrr.length - 1]?.mrr_cents ?? 0))} over this range.
              </p>
            )}
          </>
        );
      }}
    </DashboardFrame>
  );
}
