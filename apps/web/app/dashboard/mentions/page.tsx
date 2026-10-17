import { DashboardFrame } from "../../../src/supadata/web/frame";
import { keywords, mentions, resolveRange } from "../../../src/supadata/queries";
import { fmtDateTime, fmtNum, text } from "../../../src/supadata/format";
import styles from "../../../src/supadata/web/live-view.module.css";

export const dynamic = "force-dynamic";

export default async function MentionsPage({
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
        const [list, kw] = await Promise.all([
          mentions(ctx.site.id, range),
          keywords(ctx.site.id, range),
        ]);
        return (
          <>
            <div className={`${styles.wrap} ${styles.panelGap}`}>
              <div className={styles.header}>
                <strong>Mentions</strong> — social &amp; community references
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Author</th>
                    <th>Mention</th>
                    <th className={styles.num}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr>
                      <td className={styles.empty} colSpan={4}>
                        No mentions recorded in this range.
                      </td>
                    </tr>
                  )}
                  {list.map((m) => (
                    <tr key={String(m.id)}>
                      <td>{text(m.platform)}</td>
                      <td>{text(m.author)}</td>
                      <td className={styles.mentionCell} title={text(m.text, "")}>
                        {m.url ? (
                          <a className={styles.visitor} href={text(m.url)}>
                            {text(m.text, "").slice(0, 140)}
                          </a>
                        ) : (
                          text(m.text, "").slice(0, 140)
                        )}
                      </td>
                      <td className={styles.num}>{fmtDateTime(String(m.occurred_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.wrap}>
              <div className={styles.header}>
                <strong>Search keywords</strong> — Google Search Console
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Query</th>
                    <th className={styles.num}>Clicks</th>
                    <th className={styles.num}>Impressions</th>
                    <th className={styles.num}>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {kw.length === 0 && (
                    <tr>
                      <td className={styles.empty} colSpan={4}>
                        Connect Search Console under Settings → Integrations.
                      </td>
                    </tr>
                  )}
                  {kw.map((k) => (
                    <tr key={String(k.query)}>
                      <td>{String(k.query)}</td>
                      <td className={styles.num}>{fmtNum(Number(k.clicks))}</td>
                      <td className={styles.num}>{fmtNum(Number(k.impressions))}</td>
                      <td className={styles.num}>{Number(k.position).toFixed(1)}</td>
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
