import Link from "next/link";

import { adminDeleteOrganizationAction, listAdminOrganizations } from "../../../src/admin-actions";

export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, string> = {
  "confirm-mismatch": "Type the exact organization name to confirm deletion.",
  "credits-failed": "The credit grant could not be applied.",
  "credits-granted": "Credits granted.",
  "credits-invalid": "Enter a whole credit amount of at least 1.",
  deleted: "Organization deleted.",
  forbidden: "Admin access required.",
};

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const organizations = await listAdminOrganizations();
  const message = status ? STATUS_MESSAGES[status] : undefined;

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "1100px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Organizations</h1>
          <p className="header-subtitle">All organization workspaces and their members.</p>
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
        </nav>
        {message ? <p className="quiet-note">{message}</p> : null}
        <ul className="settings-list">
          {organizations.map((org) => (
            <li key={org.id} className="delivery-card">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong>{org.name}</strong>{" "}
                  <span className="status-badge status-badge-neutral">
                    {org.memberCount} members
                  </span>
                  <p className="quiet-note mono-text" style={{ margin: "4px 0 0" }}>
                    {org.slug} · {org.id} · created {org.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <details>
                    <summary className="button button-secondary" style={{ cursor: "pointer" }}>
                      Grant credits…
                    </summary>
                    <form action="/api/admin/credits" method="post" style={{ marginTop: 8 }}>
                      <input type="hidden" name="workspaceId" value={org.id} />
                      <label className="label" htmlFor={`amount-${org.id}`}>
                        Credit amount
                      </label>
                      <input
                        id={`amount-${org.id}`}
                        name="amount"
                        type="number"
                        min="1"
                        step="1"
                        required
                        autoComplete="off"
                      />
                      <label className="label" htmlFor={`reason-${org.id}`}>
                        Reason (optional)
                      </label>
                      <input
                        id={`reason-${org.id}`}
                        name="reason"
                        type="text"
                        maxLength={255}
                        autoComplete="off"
                      />
                      <button className="button button-secondary" type="submit">
                        Grant credits
                      </button>
                    </form>
                  </details>
                  <details>
                    <summary className="button button-secondary" style={{ cursor: "pointer" }}>
                      Delete…
                    </summary>
                    <form action={adminDeleteOrganizationAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="workspaceId" value={org.id} />
                      <label className="label" htmlFor={`confirm-${org.id}`}>
                        Type {org.name} to confirm
                      </label>
                      <input
                        id={`confirm-${org.id}`}
                        name="confirm"
                        type="text"
                        autoComplete="off"
                      />
                      <button className="button button-secondary" type="submit">
                        Delete organization
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            </li>
          ))}
          {organizations.length === 0 ? (
            <li className="empty-card">No organization workspaces yet.</li>
          ) : null}
        </ul>
      </main>
    </div>
  );
}
