"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover } from "./ui/primitives";
import { browserLocale, copyForLocale } from "./ui/ui-copy";
import type { AppLocale } from "@supastack/i18n";

export type WorkspaceSwitcherMembership = Readonly<{
  role: string;
  workspaceId: string;
  workspaceLogo: string | null;
  workspaceName: string;
  workspaceType: "organization" | "personal";
}>;

function workspaceInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] ?? "W").toUpperCase();
}

export function WorkspaceSwitcher({
  fallbackLabel = "Personal account",
  fallbackLogo = null,
  locale,
}: {
  fallbackLabel?: string | undefined;
  fallbackLogo?: string | null | undefined;
  locale?: AppLocale | undefined;
}) {
  const copy = copyForLocale(locale ?? browserLocale()).workspace;
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [memberships, setMemberships] = useState<readonly WorkspaceSwitcherMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/workspaces");
        if (res.ok) {
          const data = (await res.json()) as {
            activeWorkspaceId?: string | null;
            memberships?: WorkspaceSwitcherMembership[];
          };
          if (active && Array.isArray(data.memberships)) {
            setMemberships(data.memberships);
            setActiveWorkspaceId(data.activeWorkspaceId ?? null);
          }
        }
      } catch {
        // Chrome stays usable without the directory response.
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function switchTo(workspaceId: string) {
    if (switching || workspaceId === activeWorkspaceId) {
      if (workspaceId === activeWorkspaceId) setOpen(false);
      return;
    }
    setSwitching(true);
    setError("");
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (res.ok) {
        setActiveWorkspaceId(workspaceId);
        setOpen(false);
        window.location.reload();
      } else setError(copy.failed);
    } catch {
      setError(copy.failed);
    } finally {
      setSwitching(false);
    }
  }

  const active = memberships.find((m) => m.workspaceId === activeWorkspaceId);
  const displayName =
    active?.workspaceName ?? (fallbackLabel === "Personal account" ? copy.personal : fallbackLabel);
  const displayLogo = active?.workspaceLogo ?? fallbackLogo;

  return (
    <div className="workspace-switcher">
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={copy.switch}
        trigger={
          <button
            type="button"
            className="workspace-switcher-button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${copy.current}: ${displayName}. ${copy.switch}`}
          >
            {displayLogo ? (
              <img src={displayLogo} alt="" className="workspace-switcher-logo" />
            ) : (
              <span className="workspace-switcher-initial" aria-hidden="true">
                {workspaceInitial(displayName)}
              </span>
            )}
            <span className="workspace-switcher-name">{displayName}</span>
            <ChevronsUpDown className="workspace-switcher-chevron" size={16} aria-hidden="true" />
          </button>
        }
      >
        <div className="workspace-switcher-list">
          {!loaded ? (
            <p className="workspace-switcher-empty">{copy.loading}</p>
          ) : memberships.length === 0 ? (
            <p className="workspace-switcher-empty">{copy.empty}</p>
          ) : (
            memberships.map((membership) => {
              const isActive = membership.workspaceId === activeWorkspaceId;
              return (
                <button
                  key={membership.workspaceId}
                  type="button"
                  className={`workspace-switcher-item${isActive ? " workspace-switcher-item-active" : ""}`}
                  disabled={switching}
                  onClick={() => void switchTo(membership.workspaceId)}
                >
                  {membership.workspaceLogo ? (
                    <img
                      src={membership.workspaceLogo}
                      alt=""
                      className="workspace-switcher-logo"
                    />
                  ) : (
                    <span className="workspace-switcher-initial" aria-hidden="true">
                      {workspaceInitial(membership.workspaceName)}
                    </span>
                  )}
                  <span className="workspace-switcher-item-main">
                    <strong>{membership.workspaceName}</strong>
                    <span className="workspace-switcher-item-meta">
                      {membership.workspaceType === "personal"
                        ? copy.personalType
                        : copy.organizationType}{" "}
                      · {membership.role}
                    </span>
                  </span>
                  {isActive ? (
                    <Check className="workspace-switcher-check" size={16} aria-hidden="true" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
        <div className="workspace-switcher-footer">
          <a href="/new-organization" className="workspace-switcher-footer-link">
            {copy.create}
          </a>
          <a href="/select-organization" className="workspace-switcher-footer-link">
            {copy.manage}
          </a>
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </Popover>
    </div>
  );
}
