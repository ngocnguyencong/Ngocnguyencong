"use client";

import Link from "next/link";
import { Dialog } from "../ui/primitives";
import { copyForLocale } from "../ui/ui-copy";
import { motionTokens } from "@supastack/design-tokens";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { DocsIndexEntry } from "./docs-markdown";
import styles from "./resources.module.css";
import type { AppLocale } from "@supastack/i18n";
import { DOCS_COPY, docsHref } from "./docs-copy";
import { rankDocs } from "./docs-navigation";

const APPLE_DEVICE = /mac|iphone|ipad|ipod/i;

/** Apple platforms get ⌘K; everyone else gets Ctrl K. */
function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform;
  return APPLE_DEVICE.test(`${platform} ${navigator.userAgent}`);
}

/**
 * ⌘K / Ctrl+K documentation palette + copy-as-Markdown button. Client-side
 * filtering over a serialized index keeps this dependency-free; the server-side
 * `?q=` form remains the no-JS path.
 */
export function DocsSearchPalette({
  index,
  locale = "en",
}: {
  index: readonly DocsIndexEntry[];
  locale?: AppLocale;
}) {
  const copy = DOCS_COPY[locale];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [apple] = useState(isAppleDevice);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutLabel = apple ? "⌘K" : "Ctrl K";

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term === "") {
      return index.slice(0, 8);
    }
    return rankDocs(index, term).slice(0, 8);
  }, [index, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const go = useCallback(
    (slug: string) => {
      setOpen(false);
      router.push(docsHref(locale, `/docs/${slug}`));
    },
    [router, locale],
  );

  return (
    <>
      <button
        type="button"
        className={styles.paletteTrigger}
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
      >
        {copy.search} <kbd suppressHydrationWarning>{shortcutLabel}</kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={copy.searchDocumentation}
        closeLabel={copyForLocale(locale).gallery.close}
      >
        <div className={styles.palettePanel}>
          <input
            ref={inputRef}
            type="search"
            aria-label={copy.searchDocumentation}
            placeholder={copy.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter" && results[activeIndex]) {
                go(results[activeIndex].slug);
              }
            }}
          />
          <ul role="listbox" aria-label={copy.results}>
            {results.length === 0 ? (
              <li className={styles.paletteEmpty}>{copy.noResults}</li>
            ) : (
              results.map((entry, position) => (
                <li key={entry.slug}>
                  <Link
                    href={docsHref(locale, `/docs/${entry.slug}`)}
                    role="option"
                    aria-selected={position === activeIndex}
                    className={position === activeIndex ? styles.paletteActive : undefined}
                  >
                    <small>{entry.group}</small>
                    <span>{entry.title}</span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </Dialog>
    </>
  );
}

/**
 * Delegated collapse/expand animation for the docs `<details>` disclosures
 * (nav groups and the mobile nav). Mount once inside `.docsMain`.
 * The summary's next sibling is the animated region; `data-state="closing"`
 * keeps the chevron rotating while height closes. Reduced-motion and
 * no-WAAPI fall back to the native instant toggle — and without JS the
 * browser toggles `<details>` itself, so nothing here is required.
 */
export function DocsMotion() {
  useEffect(() => {
    const ANIMATED = [styles.navGroup, styles.mobileSidebar].filter(
      (name): name is string => name !== undefined,
    );

    const animations = new Map<HTMLDetailsElement, Animation>();
    function toggle(details: HTMLDetailsElement, content: HTMLElement) {
      const opening =
        details.dataset.state === "closing" ||
        (!details.open && details.dataset.state !== "opening");
      const height = content.getBoundingClientRect().height;
      const opacity = getComputedStyle(content).opacity;
      animations.get(details)?.cancel();
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof content.animate !== "function"
      ) {
        animations.delete(details);
        content.style.overflow = "";
        details.open = opening;
        delete details.dataset.state;
        return;
      }
      details.open = true;
      details.dataset.state = opening ? "opening" : "closing";
      content.style.overflow = "clip";
      const targetHeight = opening ? content.scrollHeight : 0;
      const easing =
        getComputedStyle(details).getPropertyValue("--ease").trim() || "cubic-bezier(0.16,1,0.3,1)";
      const animation = content.animate(
        [
          { height: `${height}px`, opacity },
          { height: `${targetHeight}px`, opacity: opening ? 1 : 0 },
        ],
        { duration: opening ? motionTokens.disclosureOpen : motionTokens.disclosureClose, easing },
      );
      animations.set(details, animation);
      const cleanup = () => {
        if (animations.get(details) !== animation) return;
        delete details.dataset.state;
        content.style.overflow = "";
        animations.delete(details);
      };
      animation.onfinish = () => {
        details.open = opening;
        cleanup();
      };
      animation.oncancel = cleanup;
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const summary = target?.closest("summary") ?? null;
      if (!summary) return;
      const details = summary.parentElement;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (!ANIMATED.some((name) => details.classList.contains(name))) return;
      const content = summary.nextElementSibling;
      if (!(content instanceof HTMLElement)) return;
      event.preventDefault();
      toggle(details, content);
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      for (const animation of animations.values()) animation.cancel();
    };
  }, []);
  return null;
}

const SIDE_SCROLL_KEY = "supastack-docs-side-scroll";

// useLayoutEffect warns during SSR — fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Keeps `.sidebar` at the scroll position the user left it in across guide
 * navigations. The sidebar is rendered inside the page component, so client
 * navigation remounts it and scrollTop resets — record it to sessionStorage
 * on scroll and re-apply before paint on mount.
 */
export function DocsSideScroll() {
  useIsomorphicLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`.${styles.sidebar}`);
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(SIDE_SCROLL_KEY);
      if (saved !== null) el.scrollTop = Number(saved);
    } catch {
      // sessionStorage unavailable — position just resets
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem(SIDE_SCROLL_KEY, String(el.scrollTop));
      } catch {
        // quota/denied — non-fatal
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}

export function CopyMarkdownButton({
  markdown,
  locale = "en",
}: {
  markdown: string;
  locale?: AppLocale;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={styles.copyMarkdown}
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        })();
      }}
    >
      {copied ? DOCS_COPY[locale].copied : DOCS_COPY[locale].copyMarkdown}
    </button>
  );
}
