"use client";

import { localePath, type AppLocale } from "@supastack/i18n";
import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Popover } from "./ui/primitives";
import { browserLocale, copyForLocale } from "./ui/ui-copy";

type SessionUser = Readonly<{
  email?: string;
  image?: string | null;
  name?: string;
}>;

function userInitial(user: SessionUser | null): string {
  const basis = (user?.name ?? user?.email ?? "A").trim();
  return (basis[0] ?? "A").toUpperCase();
}

export function UserMenu({ locale }: { locale?: AppLocale | undefined }) {
  const copy = copyForLocale(locale ?? browserLocale()).account;
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/auth/get-session");
        if (res.ok) {
          const data = (await res.json()) as { user?: SessionUser } | null;
          if (active && data && typeof data === "object" && data.user) {
            setUser(data.user);
          }
        }
      } catch {
        // Menu stays a plain Account link when the session lookup fails.
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      window.location.assign(localePath(locale ?? "en", "/auth"));
    }
  }

  return (
    <div className="user-menu">
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={copy.menu}
        placement="top"
        trigger={
          <button
            type="button"
            className="user-menu-button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={user?.email ? `${copy.menu}: ${user.email}` : copy.menu}
          >
            {user?.image ? (
              <img src={user.image} alt="" className="user-menu-avatar" />
            ) : (
              <span className="user-menu-initial" aria-hidden="true">
                {loaded ? userInitial(user) : "·"}
              </span>
            )}
            <span className="user-menu-name">{user?.name ?? copy.account}</span>
            <ChevronUp className="user-menu-chevron" aria-hidden="true" size={14} />
          </button>
        }
      >
        <div className="user-menu-identity">
          {user?.email ? (
            <span className="user-menu-email">{user.email}</span>
          ) : (
            <span className="user-menu-email">{copy.account}</span>
          )}
        </div>
        <div className="user-menu-footer">
          <button type="button" className="user-menu-signout" onClick={() => void signOut()}>
            {copy.signOut}
          </button>
        </div>
      </Popover>
    </div>
  );
}
