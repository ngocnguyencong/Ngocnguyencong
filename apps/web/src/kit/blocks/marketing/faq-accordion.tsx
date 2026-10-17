import styles from "./faq-accordion.module.css";

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Kit block — FAQ accordion on native <details>/<summary>: accessible,
 * keyboard-operable, and works with JavaScript disabled.
 */
export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  return (
    <section className={styles.section}>
      <div className={styles.list}>
        {items.map((item) => (
          <details className={styles.item} key={item.question}>
            <summary className={styles.question}>
              <span>{item.question}</span>
              <span aria-hidden="true" className={styles.icon} />
            </summary>
            <div className={styles.answer}>
              <p>{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
