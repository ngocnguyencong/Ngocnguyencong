"use client";
import { getDictionary, type AppLocale } from "@supastack/i18n";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useCachedSession } from "../use-cached-session";
import { FaqWidget } from "./faq-browser";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { motionDuration, useReducedMotion } from "./motion-settings";
import { isActiveSection, siteConfig, type MarketingSection } from "./site-config";
import type { ViewerSnapshot } from "./viewer-snapshot-types";
import styles from "./marketing.module.css";
export function SiteHeaderClient({
  active,
  locale = "en",
  viewer,
}: {
  active?: MarketingSection | undefined;
  locale?: AppLocale | undefined;
  viewer?: ViewerSnapshot | undefined;
} = {}) {
  const hrefFor = (href: string) => (active && href.startsWith("#") ? `/${href}` : href);
  const copy = getDictionary(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const overflow = useRef<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const title = useId();
  const live = useCachedSession();
  // While the client session is unresolved, a server-resolved snapshot already
  // knows the answer — paint it immediately instead of hiding the action. Once
  // the session resolves (or a confirmed cache exists) the live value wins.
  const signedIn = live !== undefined ? live !== null : viewer?.signedIn;
  const ready = signedIn !== undefined;
  const primary = signedIn
    ? { href: "/dashboard", label: copy.auth.returnToDashboard }
    : { href: "/auth", label: copy.nav.getAccess };
  // noscript markup is fixed at SSR time — the server-resolved viewer is the
  // only identity a no-JS reader can have, so it owns the fallback links.
  const noscriptPrimary =
    viewer?.signedIn === true
      ? { href: "/dashboard", label: copy.auth.returnToDashboard }
      : { href: "/auth", label: copy.nav.getAccess };
  const reduced = useReducedMotion();
  const navLabels: Record<string, string> = {
    Pricing: copy.nav.pricing,
    Waitlist: copy.nav.waitlist,
    FAQ: copy.nav.faq,
    Blog: copy.nav.blog,
    Docs: copy.nav.docs,
  };
  const restore = useCallback(() => {
    if (overflow.current !== null) {
      document.body.style.overflow = overflow.current;
      overflow.current = null;
    }
    setOpen(false);
    trigger.current?.focus();
  }, []);
  const close = useCallback(() => {
    if (!dialog.current?.open) return;
    const el = panel.current!;
    const from = getComputedStyle(el);
    const opacity = from.opacity;
    const transform = from.transform;
    animation.current?.cancel();
    dialog.current.dataset.closing = "true";
    const a = el.animate(
      [
        { opacity, transform },
        { opacity: 0, transform: "translateY(-18px) scale(.985)" },
      ],
      { duration: motionDuration(240), easing: "cubic-bezier(.4,0,.7,.2)", fill: "forwards" },
    );
    animation.current = a;
    a.onfinish = () => {
      dialog.current?.close();
      a.cancel();
      animation.current = null;
      restore();
    };
  }, [restore]);
  const show = () => {
    animation.current?.cancel();
    const d = dialog.current!;
    delete d.dataset.closing;
    d.showModal();
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setOpen(true);
    closeButton.current?.focus();
    animation.current = panel.current!.animate(
      [
        { opacity: 0, transform: "translateY(-24px) scale(.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: motionDuration(400), easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  };
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 20);
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    const media = window.matchMedia("(min-width:900px)");
    const resize = () => {
      if (media.matches) close();
    };
    media.addEventListener("change", resize);
    return () => {
      window.removeEventListener("scroll", scroll);
      media.removeEventListener("change", resize);
      animation.current?.cancel();
      if (overflow.current !== null) document.body.style.overflow = overflow.current;
    };
  }, [close]);
  useEffect(() => {
    if (reduced) animation.current?.finish();
  }, [reduced]);
  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.headerInner}>
          <a aria-label="supastack home" className={`${styles.brand} brand`} href="/">
            <span data-hero-wordmark>{siteConfig.brandName}</span>
          </a>
          <nav aria-label="Page sections" className={styles.desktopNav}>
            {siteConfig.navigation.map((item) => (
              <a
                href={hrefFor(item.href)}
                aria-current={isActiveSection(item.href, active) ? "page" : undefined}
                key={item.href}
              >
                {navLabels[item.label] ?? item.label}
              </a>
            ))}
          </nav>
          <div className={styles.headerEnd}>
            <LanguageSwitcher className={styles.languageSwitcher} />
            <noscript>
              <a
                className={`${styles.btn} ${styles.btnPrimary} ${styles.headerCta}`}
                href={noscriptPrimary.href}
              >
                {noscriptPrimary.label}
              </a>
            </noscript>
            {ready && (
              <a
                className={`${styles.btn} ${styles.btnPrimary} ${styles.headerCta}`}
                href={hrefFor(primary.href)}
              >
                {primary.label}
              </a>
            )}
          </div>
          <button
            ref={trigger}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Open menu"
            className={styles.menuButton}
            onClick={show}
            type="button"
          >
            <Menu aria-hidden="true" size={22} strokeWidth={1.5} />
          </button>
        </div>
        <dialog
          ref={dialog}
          aria-labelledby={title}
          className={styles.menuDialog}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClose={restore}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div ref={panel} className={styles.menuPanel}>
            <div className={styles.menuTop}>
              <p id={title}>Menu</p>
              <button
                ref={closeButton}
                className={styles.menuClose}
                onClick={close}
                type="button"
                aria-label="Close menu"
              >
                <X aria-hidden="true" size={22} strokeWidth={1.5} />
              </button>
            </div>
            <nav aria-label="Page sections" className={styles.mobileNav}>
              {siteConfig.navigation.map((item) => (
                <a
                  href={hrefFor(item.href)}
                  aria-current={isActiveSection(item.href, active) ? "page" : undefined}
                  key={item.href}
                  onClick={close}
                >
                  {navLabels[item.label] ?? item.label}
                </a>
              ))}
            </nav>
            <LanguageSwitcher align="start" side="top" />
            {ready && (
              <a
                className={`${styles.btn} ${styles.btnPrimary}`}
                href={hrefFor(primary.href)}
                onClick={close}
              >
                {primary.label}
              </a>
            )}
          </div>
        </dialog>
        <noscript>
          <nav aria-label="Site navigation" className={styles.noScriptNav}>
            {siteConfig.navigation.map((item) => (
              <a
                key={item.href}
                href={hrefFor(item.href)}
                aria-current={isActiveSection(item.href, active) ? "page" : undefined}
              >
                {navLabels[item.label] ?? item.label}
              </a>
            ))}
            <a href={noscriptPrimary.href}>{noscriptPrimary.label}</a>
          </nav>
        </noscript>
      </header>
      <FaqWidget />
    </>
  );
}
