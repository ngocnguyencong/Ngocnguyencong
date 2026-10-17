import { sdAlert, sdAlertEvent } from "@supastack/db";
import { desc, eq, inArray } from "drizzle-orm";

import { database } from "../../../src/auth-runtime";
import { DashboardFrame } from "../../../src/supadata/web/frame";
import { AlertForm, AlertRowActions } from "../../../src/supadata/web/forms";
import { fmtDateTime, fmtNum } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) return <p>No site selected.</p>;
        const alerts = await database.select().from(sdAlert).where(eq(sdAlert.siteId, ctx.site.id));
        const history = alerts.length
          ? await database
              .select()
              .from(sdAlertEvent)
              .where(
                inArray(
                  sdAlertEvent.alertId,
                  alerts.map((a) => a.id),
                ),
              )
              .orderBy(desc(sdAlertEvent.createdAt))
              .limit(30)
          : [];
        const nameOf = new Map(alerts.map((a) => [a.id, a.name]));
        return (
          <>
            <div className={styles.wrap} style={{ marginBottom: 16 }}>
              <div className={styles.header}>
                <strong>Alerts</strong> — get notified when metrics cross thresholds
              </div>
              <div style={{ padding: 16 }}>
                <AlertForm siteId={ctx.site.id} />
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rule</th>
                    <th>Status</th>
                    <th className={styles.num}>Last fired</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {alerts.length === 0 && (
                    <tr>
                      <td className={styles.empty} colSpan={5}>
                        No alerts yet.
                      </td>
                    </tr>
                  )}
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                      </td>
                      <td>
                        {a.metric} {a.condition === "gt" ? ">" : "<"} {fmtNum(a.threshold)} /{" "}
                        {a.period}
                        {a.target ? ` (${a.target})` : ""}
                      </td>
                      <td>{a.active ? "active" : "paused"}</td>
                      <td className={styles.num}>
                        {a.lastFiredAt ? fmtDateTime(a.lastFiredAt) : "never"}
                      </td>
                      <td className={styles.num}>
                        <AlertRowActions active={a.active} alertId={a.id} siteId={ctx.site!.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {history.length > 0 && (
              <div className={styles.wrap}>
                <div className={styles.header}>
                  <strong>History</strong>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Alert</th>
                      <th>Value</th>
                      <th className={styles.num}>Fired at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{nameOf.get(h.alertId) ?? h.alertId}</td>
                        <td>{fmtNum(h.value)}</td>
                        <td className={styles.num}>{fmtDateTime(h.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }}
    </DashboardFrame>
  );
}
