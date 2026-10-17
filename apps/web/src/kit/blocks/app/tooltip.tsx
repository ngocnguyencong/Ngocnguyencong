"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ElementType, KeyboardEvent, PointerEvent, ReactNode } from "react";
import styles from "./tooltip.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Kit block — delayed hover / instant keyboard-focus tooltip bubble.
 * The first focusable descendant (or the wrapper itself) is the described
 * trigger; the bubble stays in the DOM so `aria-describedby` resolves.
 * Touch pointers never open it.
 */
export function Tooltip({
  as = "span",
  children,
  className,
  content,
  delayMs = 300,
  side = "top",
}: {
  /** Wrapper element — "span" for inline triggers, "div" around block cards. */
  as?: "span" | "div";
  children: ReactNode;
  className?: string | undefined;
  content: ReactNode;
  delayMs?: number;
  side?: "top" | "bottom";
}) {
  const Tag = as as ElementType;
  const tooltipId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function close() {
    clearTimer();
    setOpen(false);
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const trigger = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    const described = trigger ?? root;
    if (!trigger) root.tabIndex = 0;
    described.setAttribute("aria-describedby", tooltipId);
    return () => {
      described.removeAttribute("aria-describedby");
      if (!trigger) root.removeAttribute("tabindex");
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [tooltipId]);

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setOpen(true);
    }, delayMs);
  }

  // Any focus (keyboard Tab or programmatic) opens instantly — the APG
  // tooltip pattern; pointer-driven focus is already covered by hover.
  function handleFocus() {
    setOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") close();
  }

  return (
    <Tag
      className={`${styles.root} ${as === "div" ? styles.block : ""} ${className ?? ""}`.trim()}
      data-open={open ? "true" : undefined}
      data-side={side}
      onBlur={close}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={close}
      ref={(element: HTMLElement | null) => {
        rootRef.current = element;
      }}
    >
      {children}
      <span className={styles.bubble} id={tooltipId} role="tooltip">
        {content}
      </span>
    </Tag>
  );
}
