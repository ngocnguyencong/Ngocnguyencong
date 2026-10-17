"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { AppLocale } from "@supastack/i18n";
import { Sheet } from "./ui/primitives";
import { copyForLocale } from "./ui/ui-copy";

export const SIDEBAR_STORAGE_KEY = "supastack-sidebar-collapsed";

/** One navigation tree, enhanced into a drawer only after hydration. */
export function ShellNavigation({
  brand,
  sidebar,
  children,
  locale = "en",
}: {
  brand: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  locale?: AppLocale | undefined;
}) {
  const copy = copyForLocale(locale).shell;
  const [ready, setReady] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [layout, setLayout] = useState("sidebar");
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<{ label: string; top: number; left: number } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const refresh = () => {
      setNarrow(media.matches);
      setLayout(document.documentElement.dataset.layout ?? "sidebar");
    };
    refresh();
    setReady(true);
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      /* Expanded rail remains usable when storage is unavailable. */
    }
    media.addEventListener("change", refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-layout"],
    });
    return () => {
      media.removeEventListener("change", refresh);
      observer.disconnect();
    };
  }, []);
  const compact = ready && (narrow || layout === "focused");
  const iconRail = ready && !compact && layout === "collapsible" && collapsed;
  useEffect(() => {
    if (!compact) setOpen(false);
  }, [compact]);
  return (
    <div
      className="app-frame"
      data-shell-ready={String(ready)}
      data-shell-mode={compact ? "compact" : "desktop"}
      data-sidebar-collapsed={String(iconRail)}
    >
      {compact ? (
        <>
          <header className="shell-compact-header">
            {brand}
            <button
              type="button"
              className="shell-navigation-trigger"
              aria-label={copy.openNavigation}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </header>
          <Sheet
            className="shell-navigation-drawer"
            open={open}
            onOpenChange={setOpen}
            title={copy.navigation}
            closeLabel={copy.closeNavigation}
            side="left"
          >
            <div
              className="shell-drawer-content"
              onClick={(event) => {
                const target = event.target instanceof Element ? event.target : null;
                if (target?.closest("a[href],button.nav-item")) setOpen(false);
              }}
            >
              {sidebar}
            </div>
          </Sheet>
        </>
      ) : (
        <aside
          className="workspace-rail"
          aria-label={copy.navigation}
          onPointerOver={(event) => {
            if (!iconRail) return;
            const link = (event.target as Element).closest<HTMLElement>(
              ".nav-item,.app-rail-footer a",
            );
            if (link) {
              const rect = link.getBoundingClientRect();
              setHint({
                label:
                  link.dataset.label ?? link.getAttribute("aria-label") ?? link.textContent ?? "",
                top: rect.top,
                left: rect.right + 12,
              });
            }
          }}
          onPointerLeave={() => setHint(null)}
          onFocusCapture={(event) => {
            if (!iconRail) return;
            const link = (event.target as Element).closest<HTMLElement>(
              ".nav-item,.app-rail-footer a",
            );
            if (link) {
              const rect = link.getBoundingClientRect();
              setHint({
                label:
                  link.dataset.label ?? link.getAttribute("aria-label") ?? link.textContent ?? "",
                top: rect.top,
                left: rect.right + 12,
              });
            } else setHint(null);
          }}
          onBlurCapture={() => setHint(null)}
        >
          <div className="shell-rail-heading">
            {brand}
            {layout === "collapsible" ? (
              <button
                type="button"
                className="shell-collapse-trigger"
                aria-label={collapsed ? copy.expandNavigation : copy.collapseNavigation}
                aria-expanded={!collapsed}
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  try {
                    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
                  } catch {
                    /* Keep local interaction available. */
                  }
                }}
              >
                {collapsed ? (
                  <PanelLeftOpen size={18} aria-hidden="true" />
                ) : (
                  <PanelLeftClose size={18} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          {sidebar}
        </aside>
      )}
      {children}
      {iconRail && hint
        ? createPortal(
            <span
              className="shell-rail-hint"
              aria-hidden="true"
              style={{ top: hint.top, left: hint.left }}
            >
              {hint.label}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}
