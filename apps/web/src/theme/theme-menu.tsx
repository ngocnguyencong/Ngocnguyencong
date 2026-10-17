"use client";

import { Check, ChevronDown, Palette } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { markAppearanceChanged } from "./appearance";
import { applyTheme, DEFAULT_THEME_ID, resolveThemeId, THEME_CATALOG, themeById } from "./catalog";
import { runThemeTransition } from "./theme-transition";
import styles from "./theme-menu.module.css";

function readCurrentTheme(): string {
  if (typeof document === "undefined") return DEFAULT_THEME_ID;
  return resolveThemeId(document.documentElement.dataset.theme);
}

/**
 * Compact color-pack picker for site chrome — same details/summary popover
 * contract as LanguageSwitcher (Esc refocus, outside-pointer close, arrow
 * keys through options, reduced-motion-safe). Applies the pack through
 * runThemeTransition so the change reveals from the pointer position, and
 * watches data-theme so the label stays correct when another control
 * (e.g. Settings → Appearance) changes the pack.
 */
export function ThemeMenu({
  align = "end",
  side = "bottom",
  className,
  label = "Theme",
}: Readonly<{
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string | undefined;
  /** Visible control name — pass the localized appearance label. */
  label?: string | undefined;
}> = {}) {
  const [theme, setTheme] = useState<string>(DEFAULT_THEME_ID);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setTheme(readCurrentTheme());
    const observer = new MutationObserver(() => setTheme(readCurrentTheme()));
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    return () => observer.disconnect();
  }, []);

  function requestClose(refocus = false) {
    const el = detailsRef.current;
    if (!el?.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.open = false;
    } else {
      el.dataset.closing = "true";
      window.setTimeout(() => {
        el.open = false;
        delete el.dataset.closing;
      }, 140);
    }
    if (refocus) summaryRef.current?.focus();
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const el = detailsRef.current;
      if (el?.open && !el.contains(event.target as Node)) requestClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (detailsRef.current?.open) {
        event.preventDefault();
        requestClose(true);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function onSummaryClick(event: ReactMouseEvent) {
    if (detailsRef.current?.open) {
      event.preventDefault();
      requestClose();
    }
  }

  function onSummaryKeyDown(event: ReactKeyboardEvent) {
    const el = detailsRef.current;
    if (event.key === "ArrowDown" && el && !el.open) {
      event.preventDefault();
      el.open = true;
      (
        el.querySelector<HTMLElement>("button[aria-pressed='true']") ??
        el.querySelector("ul button")
      )?.focus();
    }
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(
      detailsRef.current?.querySelectorAll<HTMLButtonElement>("ul button") ?? [],
    );
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[next]?.focus();
  }

  function onBlur(event: ReactFocusEvent) {
    if (!event.currentTarget.contains(event.relatedTarget)) requestClose();
  }

  function choose(id: string, event: ReactMouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    runThemeTransition(() => {
      setTheme(applyTheme(id));
      markAppearanceChanged();
    }, origin);
    requestClose();
  }

  return (
    <details
      ref={detailsRef}
      className={className ? `${styles.root} ${className}` : styles.root}
      data-align={align}
      data-side={side}
      onBlur={onBlur}
    >
      <summary
        ref={summaryRef}
        className={styles.trigger}
        aria-label={`${label}: ${themeById(theme).name}`}
        onClick={onSummaryClick}
        onKeyDown={onSummaryKeyDown}
      >
        <Palette size={15} aria-hidden="true" className={styles.glyph} />
        <span>{themeById(theme).name}</span>
        <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
      </summary>
      <ul className={styles.popover} onKeyDown={onPopoverKeyDown}>
        {THEME_CATALOG.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              aria-pressed={entry.id === theme}
              onClick={(event) => choose(entry.id, event)}
            >
              <span
                aria-hidden="true"
                className={styles.swatch}
                style={{
                  background: entry.tokens["--page"],
                  borderColor: entry.tokens["--border-strong"],
                }}
              >
                <i style={{ background: entry.tokens["--accent"] }} />
              </span>
              <span className={styles.name}>{entry.name}</span>
              {entry.id === theme ? (
                <Check size={14} aria-hidden="true" className={styles.check} />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
