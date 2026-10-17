import { ChevronDown } from "lucide-react";

import styles from "./faq-split.module.css";

export type FaqSplitItem = {
  q: string;
  a: string;
};

/**
 * Kit block — split FAQ: heading + intro on the left (5fr), a hairline
 * <details> list on the right (7fr). Answers open and close with a
 * ::details-content height animation (progressive — engines without it
 * toggle instantly); the chevron rotates 160ms. Native disclosure — fully
 * operable with no JavaScript.
 */
export function FaqSplit({
  title,
  sub,
  items,
  defaultOpen,
  name,
}: {
  title: string;
  sub?: string | undefined;
  items: readonly FaqSplitItem[];
  /** Index of the item rendered open — e.g. 0 opens the first. */
  defaultOpen?: number | undefined;
  /** Set to share a name across items — native exclusive accordion:
     opening one closes the others (Chrome 120+, Safari 17.2+, FF 130+;
     older engines degrade to independent toggles). */
  name?: string | undefined;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        <div className={styles.intro}>
          <h2 className={styles.title}>{title}</h2>
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </div>
        <div className={styles.list}>
          {items.map((item, index) => (
            <details
              className={styles.item}
              key={item.q}
              name={name}
              open={index === defaultOpen}
              suppressHydrationWarning
            >
              <summary className={styles.question}>
                <span>{item.q}</span>
                <ChevronDown aria-hidden="true" className={styles.chevron} size={16} />
              </summary>
              <div className={styles.answerWrap}>
                <div className={styles.answerInner}>
                  <p className={styles.answer}>{item.a}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
