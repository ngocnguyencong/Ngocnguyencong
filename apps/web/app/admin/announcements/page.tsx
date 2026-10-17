import { Select } from "../../../src/ui/primitives";
import Link from "next/link";

import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  listAnnouncements,
} from "../../../src/platform-actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<{ status?: string }>;
}>;

export default async function AdminAnnouncementsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const announcements = await listAnnouncements();

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "960px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Announcements</h1>
          <p className="header-subtitle">
            Banners shown inside the app shell until the window ends or a user dismisses them.
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
          <Link href="/admin/waitlist">Waitlist</Link>
          <Link href="/dashboard">Back to app</Link>
        </nav>

        {status ? <p role="status">{status}</p> : null}

        <ul className="notification-list" aria-label="Announcements">
          {announcements.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.title}</strong> <span className="status-badge">{entry.severity}</span>
              <p className="quiet-note">{entry.body}</p>
              <span className="quiet-note">
                starts {new Date(entry.startsAt).toLocaleString()}
                {entry.endsAt ? ` · ends ${new Date(entry.endsAt).toLocaleString()}` : " · open"}
              </span>
              <form action={deleteAnnouncementAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="announcementId" value={entry.id} />
                <button className="button button-secondary" type="submit">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>

        <h2>New announcement</h2>
        <form action={createAnnouncementAction} className="auth-form">
          <label htmlFor="ann-title">Title</label>
          <input id="ann-title" maxLength={200} name="title" required />
          <label htmlFor="ann-body">Body</label>
          <textarea id="ann-body" name="body" required rows={3} />
          <label htmlFor="ann-severity">Severity</label>
          <Select defaultValue="info" id="ann-severity" name="severity">
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </Select>
          <label htmlFor="ann-starts">Starts at (ISO, optional — defaults to now)</label>
          <input id="ann-starts" name="startsAt" placeholder="2026-09-16T12:00" />
          <label htmlFor="ann-ends">Ends at (ISO, optional)</label>
          <input id="ann-ends" name="endsAt" placeholder="2026-09-23T12:00" />
          <button className="button button-primary" type="submit">
            Publish announcement
          </button>
        </form>
      </main>
    </div>
  );
}
