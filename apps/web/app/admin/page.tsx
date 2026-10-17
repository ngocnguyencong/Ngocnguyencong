import Link from "next/link";

import { adminOverviewStats, getAdminSession } from "../../src/admin-actions";
import { summarizeAdminCounts } from "../../src/admin";
import { loadSiteAnalyticsSummary, resolveAnalyticsProvider } from "../../src/analytics";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const session = await getAdminSession();
  const counts = summarizeAdminCounts(await adminOverviewStats());
  // The card only exists under ANALYTICS_PROVIDER=local and only queries for
  // a real admin — anonymous traffic stays anonymous even in reporting.
  const siteAnalytics =
    session !== null && resolveAnalyticsProvider() === "local"
      ? await loadSiteAnalyticsSummary(30)
      : null;

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "960px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Admin overview</h1>
          <p className="header-subtitle">
            Signed in as {session?.user.email ?? "admin"}. Platform administration for all
            workspaces.
          </p>
        </header>
        <nav
          className="app-rail-footer"
          style={{ display: "flex", gap: "16px", marginBottom: "24px" }}
        >
          <Link href="/admin">Overview</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/organizations">Organizations</Link>
          <Link href="/admin/flags">Feature flags</Link>
          <Link href="/admin/announcements">Announcements</Link>
          <Link href="/admin/waitlist">Waitlist</Link>
          <Link href="/setup">Setup checklist</Link>
          <Link href="/dashboard">Back to app</Link>
        </nav>
        <div className="summary-grid">
          {counts.map((count) => (
            <div key={count.key} className="summary-card">
              <span className="label">{count.key}</span>
              <strong className="mono-text">{count.value}</strong>
            </div>
          ))}
        </div>
        {siteAnalytics === null ? null : (
          <section aria-labelledby="site-analytics" style={{ marginTop: "32px" }}>
            <h2 id="site-analytics">Site analytics</h2>
            <p className="header-subtitle">
              Anonymous marketing traffic from the local analytics provider — last{" "}
              {siteAnalytics.days} days.
            </p>
            <div className="summary-grid">
              <div className="summary-card">
                <span className="label">pageviews</span>
                <strong className="mono-text">{siteAnalytics.pageviews}</strong>
              </div>
              <div className="summary-card">
                <span className="label">unique visitors</span>
                <strong className="mono-text">{siteAnalytics.uniqueVisitors}</strong>
              </div>
              <div className="summary-card">
                <span className="label">events</span>
                <strong className="mono-text">{siteAnalytics.events}</strong>
              </div>
            </div>
            <h3>Top paths</h3>
            <ul className="notification-list" aria-label="Top pageview paths">
              {siteAnalytics.topPaths.map((row) => (
                <li key={row.path}>
                  <strong>{row.path}</strong>
                  <p className="quiet-note">
                    {row.views} {row.views === 1 ? "view" : "views"}
                  </p>
                </li>
              ))}
              {siteAnalytics.topPaths.length === 0 ? (
                <li className="quiet-note">No pageviews recorded yet.</li>
              ) : null}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
