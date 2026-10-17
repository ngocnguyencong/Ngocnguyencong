import type { ReactNode } from "react";
import styles from "./feature-grid.module.css";

export type FeatureItem = {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon: ReactNode;
  title: string;
  description: string;
};

/** Kit block — responsive feature grid with icon chips. 3 columns → auto-fit on narrow. */
export function FeatureGrid({
  heading,
  sub,
  items,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  items: readonly FeatureItem[];
}) {
  return (
    <section className={styles.section} aria-label={heading ?? "Features"}>
      {heading || sub ? (
        <header className={styles.header}>
          {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </header>
      ) : null}
      <ul className={styles.grid}>
        {items.map((item) => (
          <li className={styles.card} key={item.title}>
            <span aria-hidden="true" className={styles.iconChip}>
              {item.icon}
            </span>
            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardText}>{item.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
