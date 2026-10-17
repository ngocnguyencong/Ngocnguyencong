import { sdFunnel } from "@supastack/db";
import { eq } from "drizzle-orm";

import { database } from "../../../src/auth-runtime";
import { DashboardFrame } from "../../../src/supadata/web/frame";
import { DeleteFunnelButton, FunnelForm } from "../../../src/supadata/web/forms";
import { funnelResults, resolveRange, type FunnelStepSpec } from "../../../src/supadata/queries";
import { fmtNum, fmtPct } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function FunnelsPage({
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
        const defs = await database.select().from(sdFunnel).where(eq(sdFunnel.siteId, site.id));
        const results = await Promise.all(
          defs.map((f) => funnelResults(site.id, range, JSON.parse(f.steps) as FunnelStepSpec[])),
        );
        return (
          <>
            <FunnelForm siteId={site.id} />
            {defs.map((f, i) => {
              const res = results[i];
              const max = res?.steps[0]?.visitors || 1;
              return (
                <div className={styles.wrap} key={f.id} style={{ marginBottom: 16 }}>
                  <div className={styles.header}>
                    <strong>{f.name}</strong>
                    <span className={styles.hint} style={{ marginLeft: "auto" }}>
                      <DeleteFunnelButton funnelId={f.id} siteId={ctx.site!.id} />
                    </span>
                  </div>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th className={styles.num}>Visitors</th>
                        <th className={styles.num}>Of start</th>
                        <th className={styles.num}>From prev</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {res?.steps.map((s, j) => (
                        <tr key={j}>
                          <td style={{ position: "relative" }}>
                            <span
                              aria-hidden
                              style={{
                                position: "absolute",
                                inset: 0,
                                width: `${(s.visitors / max) * 100}%`,
                                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                                borderRadius: 4,
                              }}
                            />
                            <span style={{ position: "relative" }}>
                              {j + 1}. {s.type === "pageview" ? "Visited" : "Did"}{" "}
                              <code>{s.value}</code>
                            </span>
                          </td>
                          <td className={styles.num}>{fmtNum(s.visitors)}</td>
                          <td className={styles.num}>{fmtPct(s.conversion)}</td>
                          <td className={styles.num}>{fmtPct(s.stepConversion)}</td>
                          <td />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {defs.length === 0 && (
              <p style={{ color: "var(--muted)" }}>No funnels yet — create one above.</p>
            )}
          </>
        );
      }}
    </DashboardFrame>
  );
}
