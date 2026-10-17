import { DashboardFrame } from "../../../src/supadata/web/frame";
import { resolveRange, visitors } from "../../../src/supadata/queries";
import { fmtDateTime, fmtMoney, fmtNum } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function VisitorsPage({
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
        const { visitors: list, total } = await visitors(ctx.site.id, range, {
          search: sp.search,
          limit: 100,
        });
        return (
          <div className={styles.wrap}>
            <div className={styles.header}>
              <strong>{fmtNum(total)}</strong> visitors
              <form action="" className={styles.searchForm} method="get">
                <input name="site" type="hidden" value={ctx.site.id} />
                <input name="period" type="hidden" value={sp.period ?? "30d"} />
                <input
                  className={styles.searchInput}
                  defaultValue={sp.search ?? ""}
                  name="search"
                  placeholder="Search email, name, user id…"
                />
              </form>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Visitor</th>
                  <th>Location</th>
                  <th>Device</th>
                  <th>Sessions</th>
                  <th>Revenue</th>
                  <th className={styles.num}>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td className={styles.empty} colSpan={6}>
                      No visitors in this range.
                    </td>
                  </tr>
                )}
                {list.map((v) => (
                  <tr key={String(v.id)}>
                    <td>
                      <a
                        className={styles.visitor}
                        href={`/dashboard/visitors/${v.id}?site=${ctx.site!.id}&period=${sp.period ?? "30d"}`}
                      >
                        {v.name || v.email || String(v.id).slice(0, 8)}
                      </a>
                    </td>
                    <td>{[v.city, v.country].filter(Boolean).join(", ") || "—"}</td>
                    <td>{v.device ?? "—"}</td>
                    <td>{Number(v.sessions)}</td>
                    <td>{Number(v.revenue_cents) ? fmtMoney(Number(v.revenue_cents)) : "—"}</td>
                    <td className={styles.num}>{fmtDateTime(String(v.last_seen))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </DashboardFrame>
  );
}
