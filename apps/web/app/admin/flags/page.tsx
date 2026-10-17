import { Select } from "../../../src/ui/primitives";
import Link from "next/link";

import {
  listFeatureFlags,
  upsertFeatureFlagAction,
  deleteFeatureFlagAction,
  setFeatureFlagOverrideAction,
} from "../../../src/platform-actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<{ status?: string }>;
}>;

export default async function AdminFlagsPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const flags = await listFeatureFlags();

  return (
    <div className="token-root app-theme">
      <main
        className="main-panel"
        style={{ margin: "0 auto", maxWidth: "960px", padding: "48px 24px" }}
      >
        <header className="screen-intro">
          <p className="eyebrow">Platform admin</p>
          <h1>Feature flags</h1>
          <p className="header-subtitle">
            Global defaults plus per-workspace and per-user overrides. User overrides win over
            workspace overrides.
          </p>
        </header>
        <nav
          className="app-rail-footer"
          style={{ display: "flex", gap: "16px", marginBottom: "24px" }}
        >
          <Link href="/admin">Overview</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/organizations">Organizations</Link>
          <Link href="/admin/announcements">Announcements</Link>
          <Link href="/admin/waitlist">Waitlist</Link>
          <Link href="/dashboard">Back to app</Link>
        </nav>

        {status ? <p role="status">{status}</p> : null}

        <ul className="notification-list" aria-label="Feature flags">
          {flags.map((flag) => (
            <li key={flag.id}>
              <strong>
                <code>{flag.key}</code>
              </strong>{" "}
              <span className="status-badge">
                {flag.defaultEnabled ? "on by default" : "off by default"}
              </span>{" "}
              <span className="quiet-note">
                {flag.overrideCount} override{flag.overrideCount === 1 ? "" : "s"}
              </span>
              {flag.description ? <p className="quiet-note">{flag.description}</p> : null}
              <form
                action={setFeatureFlagOverrideAction}
                style={{ display: "flex", gap: 8, marginTop: 8 }}
              >
                <input type="hidden" name="flagId" value={flag.id} />
                <Select aria-label="Scope" name="scopeType" defaultValue="workspace">
                  <option value="workspace">workspace</option>
                  <option value="user">user</option>
                </Select>
                <input
                  aria-label="Scope id"
                  name="scopeId"
                  placeholder="workspace or user id"
                  required
                />
                <Select aria-label="State" name="state" defaultValue="on">
                  <option value="on">on</option>
                  <option value="off">off</option>
                  <option value="clear">clear override</option>
                </Select>
                <button className="button button-secondary" type="submit">
                  Apply
                </button>
              </form>
              <form action={deleteFeatureFlagAction} style={{ marginTop: 8 }}>
                <input type="hidden" name="flagId" value={flag.id} />
                <button className="button button-secondary" type="submit">
                  Delete flag
                </button>
              </form>
            </li>
          ))}
        </ul>

        <h2>Create or update flag</h2>
        <form action={upsertFeatureFlagAction} className="auth-form">
          <label htmlFor="flag-key">Key</label>
          <input
            id="flag-key"
            name="key"
            pattern="[a-z0-9._-]+"
            placeholder="chat.streaming"
            required
          />
          <label htmlFor="flag-description">Description</label>
          <input id="flag-description" name="description" />
          <label>
            <input name="enabled" type="checkbox" /> Enabled by default
          </label>
          <button className="button button-primary" type="submit">
            Save flag
          </button>
        </form>
      </main>
    </div>
  );
}
