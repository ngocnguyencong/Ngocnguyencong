"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./feature-story.module.css";

export type StoryPoint = {
  icon?: ReactNode;
  title: string;
  text: string;
};

export type StoryRow = {
  title: string;
  text: string;
  /** Mini points — up to 3 render in a row under the copy. */
  points?: readonly StoryPoint[];
  /** Product vignette — rendered flat as a hairline-ruled region. */
  media?: ReactNode;
  /** Optional frame header label (e.g. "To approve") with an optional right-hand meta. */
  mediaLabel?: string;
  mediaMeta?: string;
};

/**
 * Kit block — feature story: alternating copy/media rows separated by
 * hairlines. Each row's media rises in once when it enters view and the
 * copy follows at +80ms; rows even-numbered flip the media to the right.
 * Fails open: SSR and reduced-motion show the final state.
 */
export function FeatureStory({ rows }: { rows: readonly StoryRow[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        {rows.map((row, index) => (
          <RevealRow even={index % 2 === 1} key={row.title} row={row} />
        ))}
      </div>
    </section>
  );
}

function RevealRow({ row, even }: { row: StoryRow; even: boolean }) {
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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.row} data-reveal="pending" ref={ref}>
      <div className={styles.copy}>
        <h3 className={styles.rowTitle}>{row.title}</h3>
        <p className={styles.rowText}>{row.text}</p>
        {row.points && row.points.length > 0 ? (
          <div className={styles.points}>
            {row.points.slice(0, 3).map((point) => (
              <div className={styles.point} key={point.title}>
                {point.icon ? (
                  <span aria-hidden="true" className={styles.pointIcon}>
                    {point.icon}
                  </span>
                ) : null}
                <b className={styles.pointTitle}>{point.title}</b>
                <span className={styles.pointText}>{point.text}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {row.media ? (
        <div className={styles.mediaCell} style={even ? { order: 2 } : undefined}>
          <div className={styles.vig}>
            {row.mediaLabel ? (
              <div className={styles.vigHead}>
                <span>{row.mediaLabel}</span>
                {row.mediaMeta ? <span className={styles.vigMeta}>{row.mediaMeta}</span> : null}
              </div>
            ) : null}
            <div className={styles.vigBody}>{row.media}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
