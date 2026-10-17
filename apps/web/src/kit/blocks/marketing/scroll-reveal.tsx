"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import styles from "./scroll-reveal.module.css";

/**
 * Kit block — once-only scroll reveal for below-fold content.
 *
 * SSR renders children fully visible; the hidden "pending" styles only
 * apply when the browser reports scripting enabled and full motion, so
 * no-JS, reduced-motion, and non-supporting visitors always see content.
 * Once the element scrolls into view it rises/fades in once and stays —
 * never a repeated reveal. Keep it below the fold: above-the-fold blocks
 * carry their own load entrance.
 */
export function ScrollReveal({
  as = "div",
  children,
  className,
  delay = 0,
}: {
  /** Rendered element — pick "li"/"article"/"section" to keep list and landmark markup valid. */
  as?: "div" | "li" | "article" | "section" | "header";
  children: ReactNode;
  className?: string | undefined;
  /** Stagger offset in ms for grouped reveals. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      node.dataset.reveal = "shown";
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal", "shown");
          observer.unobserve(entry.target);
        }
      },
      // Fire a touch before full visibility so the motion reads as
      // arriving, not popping.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Polymorphic tag: typed as "div" so JSX accepts the ref; `as` keeps
  // markup honest (li inside ol, article inside grids).
  const Tag = as as "div";
  return (
    <Tag
      className={[styles.reveal, className].filter(Boolean).join(" ")}
      data-reveal="pending"
      ref={ref}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
