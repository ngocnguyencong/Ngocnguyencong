"use client";

import { ArrowUpRight, MessageCircle, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./scroll-end-cta.module.css";

export type ScrollEndCtaAction = {
  href: string;
  label: string;
  /** Quieter second line inside the action row. */
  hint?: string | undefined;
};

/**
 * Kit block — end-of-page follow-up dialog. Shows once per browser session
 * when the visitor scrolls to the bottom of the page, or after `delayMs` of
 * visible time — whichever comes first. Uses a native <dialog>: Escape,
 * backdrop click, and the close button dismiss; Tab cycles inside; body
 * scroll locks while open; entrance/exit motion drops under
 * prefers-reduced-motion. Never interrupts while another dialog is open or
 * a form control holds focus. `preview` renders the panel inline for
 * galleries and docs instead of mounting dialog behavior.
 */
export function ScrollEndCta({
  body,
  closeLabel = "Close",
  delayMs = 90_000,
  preview = false,
  primary,
  secondary,
  storageKey = "scroll-end-cta.shown",
  title,
}: {
  title: string;
  body: ReactNode;
  primary: ScrollEndCtaAction;
  secondary?: ScrollEndCtaAction | undefined;
  closeLabel?: string | undefined;
  /** Dwell fallback for visitors who never reach the bottom. */
  delayMs?: number | undefined;
  /** sessionStorage key recording that the dialog already appeared. */
  storageKey?: string | undefined;
  /** Inline render for the /kit-blocks gallery — no listeners or modal. */
  preview?: boolean | undefined;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const overflowRef = useRef<string | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleId = useId();
  const bodyId = useId();

  function restore() {
    if (overflowRef.current !== null) {
      document.body.style.overflow = overflowRef.current;
      overflowRef.current = null;
    }
  }

  function close() {
    const element = dialogRef.current;
    if (!element?.open || element.dataset.closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.close();
      restore();
      return;
    }
    element.dataset.closing = "true";
    exitTimerRef.current = setTimeout(() => {
      element.close();
      delete element.dataset.closing;
      restore();
    }, 180);
  }

  useEffect(() => {
    if (preview) return;
    try {
      if (sessionStorage.getItem(storageKey)) return;
    } catch {
      /* Storage can be disabled. */
    }
    const element = dialogRef.current;
    if (!element || typeof element.showModal !== "function") return;
    let remaining = delayMs;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;

    function check() {
      timer = undefined;
      remaining = 0;
      if (document.hidden || shown) return;
      const focused = document.activeElement;
      if (
        document.querySelector('dialog[open], [role="dialog"]') ||
        focused?.closest('form, input, textarea, select, [contenteditable="true"]')
      ) {
        timer = setTimeout(check, 1000);
        return;
      }
      shown = true;
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* Still show once in this mount. */
      }
      element!.showModal();
      overflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus({ preventScroll: true });
    }

    function onVisibility() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        remaining = Math.max(0, remaining - (Date.now() - started));
      }
      if (!document.hidden && !shown) {
        started = Date.now();
        timer = setTimeout(check, remaining);
      }
    }

    // Reaching the end of the page is the same intent signal as the dwell
    // timer — run the identical guarded check. `scrollY > 0` keeps pages
    // short enough to fit the viewport from firing this on mount.
    function onScroll() {
      if (shown || window.scrollY <= 0) return;
      const page = document.documentElement;
      if (window.scrollY + window.innerHeight >= page.scrollHeight - 8) check();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timer);
      if (exitTimerRef.current !== null) clearTimeout(exitTimerRef.current);
      if (element.open) element.close();
      if (overflowRef.current !== null) {
        document.body.style.overflow = overflowRef.current;
        overflowRef.current = null;
      }
    };
  }, [delayMs, preview, storageKey]);

  const panel = (
    <div className={styles.panel}>
      <button
        aria-label={closeLabel}
        className={styles.close}
        onClick={close}
        ref={closeButtonRef}
        type="button"
      >
        <X aria-hidden="true" size={20} />
      </button>
      <span aria-hidden="true" className={styles.icon}>
        <MessageCircle size={26} strokeWidth={1.5} />
      </span>
      <h2 className={styles.title} id={titleId}>
        {title}
      </h2>
      <p className={styles.body} id={bodyId}>
        {body}
      </p>
      <div className={styles.actions}>
        <a className={`${styles.action} ${styles.primary}`} href={primary.href}>
          <span className={styles.actionText}>
            <strong>{primary.label}</strong>
            {primary.hint ? <small>{primary.hint}</small> : null}
          </span>
          <ArrowUpRight aria-hidden="true" className={styles.arrow} size={20} />
        </a>
        {secondary ? (
          <a className={`${styles.action} ${styles.secondary}`} href={secondary.href}>
            <span className={styles.actionText}>
              <strong>{secondary.label}</strong>
              {secondary.hint ? <small>{secondary.hint}</small> : null}
            </span>
            <ArrowUpRight aria-hidden="true" className={styles.arrow} size={20} />
          </a>
        ) : null}
      </div>
    </div>
  );

  if (preview) {
    return <div className={styles.preview}>{panel}</div>;
  }

  return (
    <dialog
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onClose={restore}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      ref={dialogRef}
    >
      {panel}
    </dialog>
  );
}
