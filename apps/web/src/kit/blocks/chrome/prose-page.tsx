import type { ReactNode } from "react";
import styles from "./prose-page.module.css";

/**
 * Kit block — long-form text page scaffold for legal/policy/docs content.
 * Centers a readable column with a title + updated date header; pass
 * sectioned copy as children (h2/p/ul all styled by the module).
 */
export function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  /** e.g. "Last updated March 2026" */
  updated?: string | undefined;
  children: ReactNode;
}) {
  return (
    <article className={styles.prose}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {updated ? <p className={styles.updated}>{updated}</p> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </article>
  );
}
