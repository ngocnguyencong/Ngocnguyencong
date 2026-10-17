import type { ReactNode } from "react";
import styles from "./newsletter-band.module.css";

/**
 * Kit block — newsletter/updates signup band. Pass your form (or a client
 * island) into `children`; the block supplies the split copy/layout.
 */
export function NewsletterBand({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  /** Form slot — typically an inline email input + submit button. */
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.panel}>
        <div className={styles.copy}>
          <h3 className={styles.title}>{title}</h3>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.form}>{children}</div>
      </div>
    </section>
  );
}
