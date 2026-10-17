import type { Metadata } from "next";

import { getHealthSnapshot } from "../../src/health-snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status",
  description: "Live subsystem health for this supastack deployment.",
  alternates: { canonical: "/status" },
};

export default async function StatusPage() {
  const health = await getHealthSnapshot().catch(() => null);

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "720px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Operations</p>
          <h1>System status</h1>
          <p className="header-subtitle">
            Live health of this deployment&apos;s subsystems. Provider entries describe the
            configured adapter, not a remote probe.
          </p>
        </header>

        {health === null ? (
          <p role="alert">Health information is unavailable right now.</p>
        ) : (
          <>
            <p>
              Overall:{" "}
              <span className="status-badge">
                {health.status === "ok" ? "operational" : "degraded"}
              </span>
            </p>
            <h2>Checks</h2>
            <ul className="notification-list" aria-label="Health checks">
              {Object.entries(health.checks ?? {}).map(([name, value]) => (
                <li key={name}>
                  <strong>{name}</strong> <span className="status-badge">{value}</span>
                </li>
              ))}
            </ul>
            <h2>Configured providers</h2>
            <ul className="notification-list" aria-label="Configured providers">
              {Object.entries(health.providers ?? {}).map(([name, value]) => (
                <li key={name}>
                  <strong>{name}</strong> <code>{value}</code>
                </li>
              ))}
            </ul>
            <p className="quiet-note">
              Version {health.version ?? "unknown"} · checked {health.timestamp ?? ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
