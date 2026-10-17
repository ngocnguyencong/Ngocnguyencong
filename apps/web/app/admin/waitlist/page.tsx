import Link from "next/link";

import {
  createEarlyAccessCodeAction,
  inviteWaitlistBatchAction,
  inviteWaitlistEntryAction,
  removeWaitlistEntryAction,
} from "../../../src/growth/waitlist-actions";
import { listWaitlistEntries } from "../../../src/growth/waitlist-queries";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<{
    status?: string;
    code?: string;
    invited?: string;
    failed?: string;
  }>;
}>;

const STATUS_COPY: Record<string, string> = {
  invited: "Invite sent.",
  "invite-failed": "Code created, but the invite email failed to send.",
  "invite-partial": "Some invites failed to send — see the list for who is still waiting.",
  removed: "Waitlist entry removed.",
  "code-created": "Early-access code created.",
  "missing-entry": "That waitlist entry no longer exists.",
  "already-joined": "That member already joined — no invite needed.",
  "invalid-email": "Enter a valid email to bind the code.",
  forbidden: "Platform admin role required.",
};

export default async function AdminWaitlistPage({ searchParams }: PageProps) {
  const { status, code, invited, failed } = await searchParams;
  const entries = await listWaitlistEntries(500);
  const waiting = entries.filter((entry) => entry.status === "waiting").length;

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "960px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Waitlist</h1>
          <p className="header-subtitle">
            Public landing-page waitlist. Invites mint email-bound early-access codes and send them
            transactionally; referrals climb the invite order.
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
          <Link href="/dashboard">Back to app</Link>
        </nav>

        {status ? (
          <p role="status">
            {STATUS_COPY[status] ?? status}
            {invited ? ` Invited: ${invited}.` : ""}
            {failed && failed !== "0" ? ` Failed: ${failed}.` : ""}
          </p>
        ) : null}
        {code ? (
          <p role="status">
            Code: <code className="mono-text">{code}</code>
          </p>
        ) : null}

        <div className="summary-grid" style={{ marginBottom: "24px" }}>
          <div className="summary-card">
            <span className="label">waiting</span>
            <strong className="mono-text">{waiting}</strong>
          </div>
          <div className="summary-card">
            <span className="label">invited</span>
            <strong className="mono-text">
              {entries.filter((e) => e.status === "invited").length}
            </strong>
          </div>
          <div className="summary-card">
            <span className="label">joined</span>
            <strong className="mono-text">
              {entries.filter((e) => e.status === "joined").length}
            </strong>
          </div>
        </div>

        <h2>Batch invite</h2>
        <form action={inviteWaitlistBatchAction} className="auth-form" style={{ maxWidth: 480 }}>
          <label htmlFor="invite-count">How many (referral count first, then oldest)</label>
          <input id="invite-count" name="count" type="number" min={1} max={500} defaultValue={10} />
          <label htmlFor="batch-expiry">Code expiry in days (optional)</label>
          <input id="batch-expiry" name="expiresInDays" type="number" min={1} max={365} />
          <button className="button button-primary" type="submit">
            Send invites
          </button>
        </form>

        <h2>Entries</h2>
        <ul className="notification-list" aria-label="Waitlist entries">
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.email}</strong> <span className="status-badge">{entry.status}</span>
              <p className="quiet-note">
                joined {new Date(entry.createdAt).toLocaleString()} · referrals{" "}
                {entry.referralCount} · share code <code>{entry.referralCode}</code>
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {entry.status !== "joined" ? (
                  <form action={inviteWaitlistEntryAction}>
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button className="button button-secondary" type="submit">
                      Invite
                    </button>
                  </form>
                ) : null}
                <form action={removeWaitlistEntryAction}>
                  <input type="hidden" name="entryId" value={entry.id} />
                  <button className="button button-secondary" type="submit">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
          {entries.length === 0 ? <li className="quiet-note">No waitlist entries yet.</li> : null}
        </ul>

        <h2>Standalone early-access code</h2>
        <form action={createEarlyAccessCodeAction} className="auth-form" style={{ maxWidth: 480 }}>
          <label htmlFor="code-email">Bind to email (optional)</label>
          <input id="code-email" name="email" type="email" placeholder="anyone@example.com" />
          <label htmlFor="code-expiry">Expiry in days (optional)</label>
          <input id="code-expiry" name="expiresInDays" type="number" min={1} max={365} />
          <button className="button button-primary" type="submit">
            Create code
          </button>
        </form>
      </main>
    </div>
  );
}
