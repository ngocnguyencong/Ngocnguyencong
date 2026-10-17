import Link from "next/link";

import {
  adminBanUserAction,
  adminDeleteUserAction,
  adminImpersonateUserAction,
  adminRevokeUserSessionsAction,
  adminSetUserRoleAction,
  adminUnbanUserAction,
  getAdminSession,
  listAdminUsers,
} from "../../../src/admin-actions";
import { filterAdminUsersBySearch, isAdminRole } from "../../../src/admin";

export const dynamic = "force-dynamic";

const STATUS_MESSAGES: Record<string, string> = {
  banned: "User banned.",
  "confirm-mismatch": "Type the exact email to confirm deletion.",
  deleted: "User deleted.",
  forbidden: "Admin access required.",
  invalid: "Invalid user action.",
  "impersonation-ended": "Impersonation ended.",
  "role-updated": "Role updated.",
  "sessions-revoked": "All sessions revoked for that user.",
  unbanned: "User unbanned.",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const session = await getAdminSession();
  const users = filterAdminUsersBySearch(await listAdminUsers(q ?? ""), q ?? "");
  const message = status ? STATUS_MESSAGES[status] : undefined;

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "1100px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Users</h1>
          <p className="header-subtitle">
            Manage accounts, roles, sessions, bans, and impersonation.
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
        </nav>
        {message ? <p className="quiet-note">{message}</p> : null}
        <form method="get" action="/admin/users" className="task-form" style={{ marginBottom: 24 }}>
          <label className="label" htmlFor="q">
            Search by email or name
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="user@example.com"
          />
          <button className="button button-secondary" type="submit">
            Search
          </button>
        </form>
        <ul className="settings-list">
          {users.map((row) => (
            <li key={row.id} className="delivery-card">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <strong>{row.name || row.email}</strong>{" "}
                  <span className="mono-text">{row.email}</span>{" "}
                  <span
                    className={`status-badge ${row.banned ? "status-badge-signal" : "status-badge-neutral"}`}
                  >
                    {row.banned ? "banned" : row.role}
                  </span>
                  <p className="quiet-note mono-text" style={{ margin: "4px 0 0" }}>
                    {row.id} · joined {row.createdAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {row.id !== session?.user.id ? (
                    <>
                      <form action={adminSetUserRoleAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <input
                          type="hidden"
                          name="role"
                          value={isAdminRole(row.role) ? "user" : "admin"}
                        />
                        <button className="button button-secondary" type="submit">
                          {isAdminRole(row.role) ? "Remove admin" : "Make admin"}
                        </button>
                      </form>
                      {row.banned ? (
                        <form action={adminUnbanUserAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <button className="button button-secondary" type="submit">
                            Unban
                          </button>
                        </form>
                      ) : (
                        <form action={adminBanUserAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <button className="button button-secondary" type="submit">
                            Ban
                          </button>
                        </form>
                      )}
                      <form action={adminRevokeUserSessionsAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <button className="button button-secondary" type="submit">
                          Revoke sessions
                        </button>
                      </form>
                      <form action={adminImpersonateUserAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <button className="button button-secondary" type="submit">
                          Impersonate
                        </button>
                      </form>
                      <details>
                        <summary className="button button-secondary" style={{ cursor: "pointer" }}>
                          Delete…
                        </summary>
                        <form action={adminDeleteUserAction} style={{ marginTop: 8 }}>
                          <input type="hidden" name="userId" value={row.id} />
                          <label className="label" htmlFor={`confirm-${row.id}`}>
                            Type {row.email} to confirm
                          </label>
                          <input
                            id={`confirm-${row.id}`}
                            name="confirm"
                            type="text"
                            autoComplete="off"
                          />
                          <button className="button button-secondary" type="submit">
                            Delete user
                          </button>
                        </form>
                      </details>
                    </>
                  ) : (
                    <span className="status-badge status-badge-telemetry">you</span>
                  )}
                </div>
              </div>
            </li>
          ))}
          {users.length === 0 ? <li className="empty-card">No users match.</li> : null}
        </ul>
      </main>
    </div>
  );
}
