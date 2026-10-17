import type { ReactNode } from "react";
import styles from "./feature-spotlight.module.css";

export type SpotlightMini = {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon?: ReactNode;
  title: string;
  body: string;
};

/**
 * Kit block — feature spotlight: one media panel beside focused copy,
 * with a row of container-less mini points underneath. Use when a single
 * product story needs a real interface visual plus a few supporting
 * points — instead of boxing plain text into cards.
 */
export function FeatureSpotlight({
  eyebrow,
  title,
  sub,
  media,
  heading,
  description,
  support,
  minis,
  ordered = false,
  reverse = false,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  /** Media slot — a real product visual or coded mock, never a grey box. */
  media: ReactNode;
  /** Heading beside the media. */
  heading: string;
  description: string;
  /** Quieter second paragraph under the description. */
  support?: string | undefined;
  /** Container-less mini points — icon + title + one line each. */
  minis: readonly SpotlightMini[];
  /** Set when the minis are a real sequence (steps) — renders an <ol>. */
  ordered?: boolean;
  /** Flip media to the right on wide screens. */
  reverse?: boolean;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <section aria-label={title} className={styles.section}>
      <header className={styles.header}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.title}>{title}</h2>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
      </header>
      <div className={styles.row} data-reverse={reverse ? "true" : undefined}>
        <div className={styles.media}>{media}</div>
        <div className={styles.copy}>
          <h3 className={styles.heading}>{heading}</h3>
          <p className={styles.description}>{description}</p>
          {support ? <p className={styles.support}>{support}</p> : null}
        </div>
      </div>
      {minis.length ? (
        <List className={styles.minis}>
          {minis.map((mini) => (
            <li className={styles.mini} key={mini.title}>
              {mini.icon ? (
                <span aria-hidden="true" className={styles.miniIcon}>
                  {mini.icon}
                </span>
              ) : null}
              <h4 className={styles.miniTitle}>{mini.title}</h4>
              <p className={styles.miniBody}>{mini.body}</p>
            </li>
          ))}
        </List>
      ) : null}
    </section>
  );
}
