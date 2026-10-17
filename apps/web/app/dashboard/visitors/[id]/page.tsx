import { DashboardFrame } from "../../../../src/supadata/web/frame";
import { visitorDetail } from "../../../../src/supadata/queries";
import { fmtDateTime, fmtMoney, text } from "../../../../src/supadata/format";
import styles from "../../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function VisitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) return <p>No site selected.</p>;
        const detail = await visitorDetail(ctx.site.id, id);
        if (!detail) return <p>Visitor not found.</p>;
        const v = detail.visitor as Record<string, unknown>;
        return (
          <>
            <div className={styles.wrap} style={{ marginBottom: 16, padding: 16 }}>
              <h2 style={{ marginTop: 0 }}>
                {text(v.name, "") || text(v.email, "Anonymous visitor")}
              </h2>
              <p style={{ color: "var(--muted)", margin: 0 }}>
                {[v.city, v.country].filter(Boolean).join(", ") || "Unknown location"} ·{" "}
                {text(v.device, "?")} · {text(v.browser, "?")} · {text(v.os, "?")}
              </p>
              <p style={{ color: "var(--muted)" }}>
                First seen {fmtDateTime(String(v.first_seen_at))} · {String(v.session_count)}{" "}
                sessions · {Number(v.pageview_count)} pageviews
                {Number(v.revenue_cents) > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {fmtMoney(Number(v.revenue_cents))}
                    </strong>{" "}
                    lifetime
                  </>
                )}
              </p>
              {Boolean(v.first_utm_source || v.first_referrer) && (
                <p style={{ color: "var(--muted)" }}>
                  Acquired via {text(v.first_utm_source, "") || text(v.first_referrer)}
                  {v.first_utm_campaign ? ` · campaign ${text(v.first_utm_campaign)}` : ""}
                </p>
              )}
            </div>

            {detail.payments.length > 0 && (
              <div className={styles.wrap} style={{ marginBottom: 16 }}>
                <div className={styles.header}>
                  <strong>Payments</strong>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Provider</th>
                      <th>Channel</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((p) => (
                      <tr key={String(p.id)}>
                        <td>{fmtDateTime(String(p.occurred_at))}</td>
                        <td>{fmtMoney(Number(p.amount_cents), String(p.currency))}</td>
                        <td>{String(p.provider)}</td>
                        <td>{text(p.channel ?? p.source)}</td>
                        <td>{String(p.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className={styles.wrap}>
              <div className={styles.header}>
                <strong>Journey</strong> — {detail.events.length} events
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Page</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.events.map((e) => (
                    <tr key={String(e.id)}>
                      <td className={styles.num} style={{ textAlign: "left" }}>
                        {fmtDateTime(String(e.created_at))}
                      </td>
                      <td>
                        {e.type === "goal" ? (
                          <strong>★ {String(e.name)}</strong>
                        ) : e.type === "pageview" ? (
                          "pageview"
                        ) : (
                          String(e.name ?? e.type)
                        )}
                      </td>
                      <td className={styles.page}>{text(e.path, "")}</td>
                      <td style={{ color: "var(--muted)" }}>{text(e.source ?? e.campaign, "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        );
      }}
    </DashboardFrame>
  );
}
