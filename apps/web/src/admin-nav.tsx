"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

import { isAdminRole } from "./admin";
import { adminStopImpersonatingAction } from "./admin-actions";
import { dismissAnnouncementAction } from "./announcement-actions";

type AdminSessionPayload = Readonly<{
  session?: { impersonatedBy?: string | null };
  user?: { role?: string | null };
}>;

function useAdminSessionProbe(): AdminSessionPayload | null {
  const [payload, setPayload] = useState<AdminSessionPayload | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/auth/get-session");
        if (res.ok && active) {
          setPayload((await res.json()) as AdminSessionPayload);
        }
      } catch {
        // Non-admin shells render without the link/banner.
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);
  return payload;
}

/** Renders the platform-admin rail entry only for sessions holding the admin role. */
export function AdminNavLink() {
  const payload = useAdminSessionProbe();
  if (!isAdminRole(payload?.user?.role)) {
    return null;
  }
  return (
    <a href="/admin" className="nav-item" aria-label="Admin" data-label="Admin">
      <Shield className="app-nav-icon" size={18} strokeWidth={1.5} aria-hidden="true" />
      <span className="nav-label">Admin</span>
    </a>
  );
}

/** Persistent banner while an admin session impersonates another user. */
export function ImpersonationBanner() {
  const payload = useAdminSessionProbe();
  const impersonatedBy = payload?.session?.impersonatedBy;
  if (typeof impersonatedBy !== "string" || impersonatedBy.length === 0) {
    return null;
  }
  return (
    <form
      action={adminStopImpersonatingAction}
      className="impersonation-banner"
      style={{
        alignItems: "center",
        background: "var(--raised)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        gap: 12,
        justifyContent: "center",
        padding: "8px 16px",
      }}
    >
      <span className="status-badge status-badge-signal">impersonating</span>
      <span className="quiet-note">You are viewing the product as this user.</span>
      <button className="button button-secondary" type="submit">
        Stop impersonating
      </button>
    </form>
  );
}

interface AnnouncementPayload {
  body: string;
  id: string;
  severity: "critical" | "info" | "warning";
  title: string;
}

/** Active platform announcements; each is dismissible per user. */
export function AnnouncementBanner() {
  const [items, setItems] = useState<AnnouncementPayload[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/announcements", { credentials: "include" });
        if (!res.ok) {
          return;
        }
        const json = (await res.json()) as { announcements?: AnnouncementPayload[] };
        if (active && Array.isArray(json.announcements)) {
          setItems(json.announcements);
        }
      } catch {
        // Announcements are non-essential chrome.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) {
    return null;
  }
  return (
    <>
      {items.map((item) => (
        <div
          className="impersonation-banner"
          key={item.id}
          role={item.severity === "critical" ? "alert" : "status"}
          style={{
            alignItems: "center",
            background: "var(--raised)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: 12,
            justifyContent: "center",
            padding: "8px 16px",
          }}
        >
          <span className="status-badge status-badge-signal">{item.severity}</span>
          <span>
            <strong>{item.title}</strong> {item.body}
          </span>
          <form
            action={async (formData) => {
              await dismissAnnouncementAction(formData);
              setItems((current) => current.filter((entry) => entry.id !== item.id));
            }}
          >
            <input type="hidden" name="announcementId" value={item.id} />
            <button className="button button-secondary" type="submit">
              Dismiss
            </button>
          </form>
        </div>
      ))}
    </>
  );
}
