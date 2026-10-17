"use client";

import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  dictionaries,
  isAppLocale,
  localePath,
  stripLocalePrefix,
  type AppLocale,
} from "@supastack/i18n";
import { Check, ChevronDown, Languages } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./language-switcher.module.css";

function readCookieLocale(): AppLocale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isAppLocale(value) ? value : "en";
}

export function LanguageSwitcher({
  align = "end",
  side = "bottom",
  className,
}: Readonly<{
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string | undefined;
}> = {}) {
  const [locale, setLocale] = useState<AppLocale>("en");
  const [pathname, setPathname] = useState("/");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setLocale(readCookieLocale());
    setPathname(stripLocalePrefix(window.location.pathname).pathname);
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
      (el.querySelector<HTMLElement>("a[aria-current]") ?? el.querySelector("a"))?.focus();
    }
  }

  function onPopoverKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(detailsRef.current?.querySelectorAll<HTMLAnchorElement>("ul a") ?? []);
    if (links.length === 0) return;
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % links.length
        : (index - 1 + links.length) % links.length;
    event.preventDefault();
    links[next]?.focus();
  }

  function onBlur(event: ReactFocusEvent) {
    if (!event.currentTarget.contains(event.relatedTarget)) requestClose();
  }

  function choose(code: AppLocale, event: ReactMouseEvent) {
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
    setLocale(code);
    if (code === locale) event.preventDefault();
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
        aria-label={`Language: ${dictionaries[locale].language}`}
        onClick={onSummaryClick}
        onKeyDown={onSummaryKeyDown}
      >
        <Languages size={15} aria-hidden="true" className={styles.glyph} />
        <span>{dictionaries[locale].language}</span>
        <ChevronDown size={14} aria-hidden="true" className={styles.chevron} />
      </summary>
      <ul className={styles.popover} onKeyDown={onPopoverKeyDown}>
        {SUPPORTED_LOCALES.map((code) => (
          <li key={code}>
            <a
              href={localePath(code, pathname)}
              aria-current={code === locale ? "true" : undefined}
              onClick={(event) => choose(code, event)}
            >
              <span>{dictionaries[code].language}</span>
              {code === locale ? (
                <Check size={14} aria-hidden="true" className={styles.check} />
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
