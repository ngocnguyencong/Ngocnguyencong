"use client";
import { MessageCircleQuestion, Plus, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { filterFaqItems } from "./faq-search";
import { motionDuration, useReducedMotion } from "./motion-settings";
import { siteConfig } from "./site-config";
import s from "./faq-browser.module.css";

function animateAnswer(details: HTMLDetailsElement) {
  const answer = details.querySelector("p");
  if (!(answer instanceof HTMLElement) || !details.open) return;
  const height = answer.getBoundingClientRect().height;
  if (!height) return;
  answer.animate(
    [
      { height: "0px", opacity: 0.55, overflow: "hidden" },
      { height: `${height}px`, opacity: 1, overflow: "hidden" },
    ],
    { duration: motionDuration(320), easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
  );
}

export function FaqBrowser() {
  const [query, setQuery] = useState("");
  const id = useId();
  const items = filterFaqItems(siteConfig.faq, query);
  return (
    <div className={s.browser}>
      <div className={s.search}>
        <label htmlFor={id}>Search questions</label>
        <div>
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions or topics…"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}>
              Clear search
            </button>
          )}
        </div>
      </div>
      <p className={s.count} role="status">
        {items.length} {items.length === 1 ? "question" : "questions"}
      </p>
      {!items.length ? (
        <p className={s.empty}>No matching questions.</p>
      ) : (
        <div className={s.answers}>
          {items.map((item) => (
            <details
              key={item.question}
              name={`${id}-answers`}
              onToggle={(event) => animateAnswer(event.currentTarget)}
            >
              <summary>
                {item.question}
                <Plus aria-hidden="true" className={s.plusIcon} size={18} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function FaqWidget() {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const overflow = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduced = useReducedMotion();
  const restore = useCallback(() => {
    if (overflow.current !== null) {
      document.body.style.overflow = overflow.current;
      overflow.current = null;
    }
    setOpen(false);
    trigger.current?.focus();
  }, []);
  const close = useCallback(() => {
    if (!dialog.current?.open || dialog.current.dataset.closing === "true") return;
    const el = panel.current!;
    const from = getComputedStyle(el);
    animation.current?.cancel();
    dialog.current.dataset.closing = "true";
    const a = el.animate(
      [
        { opacity: from.opacity, transform: from.transform, filter: "blur(0px)" },
        { opacity: 0, transform: "translateY(14px) scale(.97)", filter: "blur(2px)" },
      ],
      { duration: motionDuration(220), easing: "cubic-bezier(.4,0,.7,.2)", fill: "forwards" },
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
    const el = panel.current!;
    delete d.dataset.closing;
    d.showModal();
    overflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setOpen(true);
    el.querySelector("input")?.focus();
    animation.current = el.animate(
      [
        { opacity: 0, transform: "translateY(22px) scale(.96)", filter: "blur(4px)" },
        { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
      ],
      { duration: motionDuration(420), easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
    );
  };
  useEffect(() => {
    if (reduced) animation.current?.finish();
  }, [reduced]);
  useEffect(
    () => () => {
      animation.current?.cancel();
      if (overflow.current !== null) document.body.style.overflow = overflow.current;
    },
    [],
  );
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={s.launcher}
        aria-label="Open FAQ"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <MessageCircleQuestion aria-hidden="true" size={20} strokeWidth={1.5} />
        FAQ
      </button>
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby={id}
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={restore}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className={s.panel} data-faq-panel ref={panel}>
          <div className={s.top}>
            <h2 id={id}>Frequently asked questions</h2>
            <button type="button" onClick={close} aria-label="Close FAQ">
              <X aria-hidden="true" size={20} strokeWidth={1.5} />
            </button>
          </div>
          <FaqBrowser />
          <a className={s.fullPage} href="/faq">
            Open full FAQ page
          </a>
        </div>
      </dialog>
      <noscript>
        <style>{`.${s.launcher}{display:none}`}</style>
      </noscript>
    </>
  );
}
