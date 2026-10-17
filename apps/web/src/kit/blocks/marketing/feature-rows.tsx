import type { ReactNode } from "react";
import styles from "./feature-rows.module.css";

export type FeatureRow = {
  eyebrow?: string | undefined;
  title: string;
  description: string;
  /** Optional bullet points under the description. */
  bullets?: readonly { title: string; text: string }[] | undefined;
  /** Media slot (screenshot/illustration) — alternates left/right automatically. */
  media?: ReactNode | undefined;
};

/** Kit block — alternating media/text feature rows, the classic SaaS product story. */
export function FeatureRows({ items }: { items: readonly FeatureRow[] }) {
  return (
    <section className={styles.section}>
      {items.map((item, i) => (
        <div
          className={styles.row}
          data-reverse={i % 2 === 1 ? "true" : undefined}
          key={item.title}
        >
          <div className={styles.copy}>
            {item.eyebrow ? <p className={styles.eyebrow}>{item.eyebrow}</p> : null}
            <h3 className={styles.title}>{item.title}</h3>
            <p className={styles.description}>{item.description}</p>
            {item.bullets?.length ? (
              <ul className={styles.bullets}>
                {item.bullets.map((bullet) => (
                  <li key={bullet.title}>
                    <strong>{bullet.title}</strong>
                    <span>{bullet.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {item.media ? <div className={styles.media}>{item.media}</div> : null}
        </div>
      ))}
    </section>
  );
}
