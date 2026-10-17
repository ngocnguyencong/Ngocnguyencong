import { sdGoal } from "@supastack/db";
import { eq } from "drizzle-orm";

import { database } from "../../../src/auth-runtime";
import { DashboardFrame } from "../../../src/supadata/web/frame";
import { DeleteGoalButton, GoalForm } from "../../../src/supadata/web/forms";
import { goalStats, resolveRange } from "../../../src/supadata/queries";
import { fmtNum, fmtPct } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) return <p>No site selected.</p>;
        const range = resolveRange(sp.period ?? "30d");
        const [defs, stats] = await Promise.all([
          database.select().from(sdGoal).where(eq(sdGoal.siteId, ctx.site.id)),
          goalStats(ctx.site.id, range),
        ]);
        const statMap = new Map(stats.map((s) => [s.name, s]));
        const totalVisitors = stats.reduce((s, r) => s + Number(r.visitors), 0) || 1;
        return (
          <div className={styles.wrap}>
            <div className={styles.header}>
              <strong>Goals</strong> — conversions from pageviews &amp; custom events
            </div>
            <div style={{ padding: 16 }}>
              <GoalForm siteId={ctx.site.id} />
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Type</th>
                  <th>Matches</th>
                  <th className={styles.num}>Conversions</th>
                  <th className={styles.num}>Visitors</th>
                  <th className={styles.num}>Rate</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {defs.length === 0 && (
                  <tr>
                    <td className={styles.empty} colSpan={7}>
                      No goals yet — add one above.
                    </td>
                  </tr>
                )}
                {defs.map((g) => {
                  const s = statMap.get(g.name);
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.name}</strong>
                      </td>
                      <td>{g.type}</td>
                      <td>
                        <code>{g.value}</code>
                      </td>
                      <td className={styles.num}>{fmtNum(Number(s?.total ?? 0))}</td>
                      <td className={styles.num}>{fmtNum(Number(s?.visitors ?? 0))}</td>
                      <td className={styles.num}>
                        {fmtPct(Number(s?.visitors ?? 0) / totalVisitors)}
                      </td>
                      <td className={styles.num}>
                        <DeleteGoalButton goalId={g.id} siteId={ctx.site!.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }}
    </DashboardFrame>
  );
}
