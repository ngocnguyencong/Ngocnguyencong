"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import styles from "./steps-ruled.module.css";

export type RuledStep = {
  /** Decorative icon (lucide at the call site) — rendered in --accent. */
  icon?: ReactNode;
  title: string;
  text: string;
};

/**
 * Kit block — ruled steps: one row of N steps separated by vertical
 * hairlines, no boxes. On first entry into view a 1px accent line draws
 * across the top of the row and each step's icon/title resolves from muted
 * to its final colour in sequence, so the line reads as order. Mobile
 * stacks the steps with horizontal hairlines and the line runs vertically
 * down the left edge. SSR renders the final state; the hidden state only
 * exists with scripting enabled and full motion.
 */
export function StepsRuled({
  eyebrow,
  title,
  sub,
  steps,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  steps: readonly RuledStep[];
}) {
  const ref = useRef<HTMLOListElement>(null);

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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = Math.max(steps.length, 1);
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.title}>{title}</h2>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <ol className={styles.steps} data-reveal="pending" ref={ref}>
          {steps.map((step, index) => (
            <li
              className={styles.step}
              key={step.title}
              style={{ "--step-d": `${Math.round((index * 900) / count)}ms` } as CSSProperties}
            >
              {step.icon ? (
                <span aria-hidden="true" className={styles.icon}>
                  {step.icon}
                </span>
              ) : null}
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.text}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
