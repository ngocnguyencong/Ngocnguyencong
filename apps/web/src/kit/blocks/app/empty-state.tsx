import type { ReactNode } from "react";
import styles from "./empty-state.module.css";

/** Kit block — centered empty state with icon, copy, and optional action. */
export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  /** Caller-supplied icon (e.g. a lucide-react glyph with aria-hidden). */
  icon?: ReactNode | undefined;
  title: string;
  text?: string | undefined;
  action?: { href: string; label: string } | undefined;
}) {
  return (
    <div className={styles.root}>
      {icon ? (
        <span aria-hidden="true" className={styles.icon}>
          {icon}
        </span>
      ) : null}
      <h2 className={styles.title}>{title}</h2>
      {text ? <p className={styles.text}>{text}</p> : null}
      {action ? (
        <a className={styles.cta} href={action.href}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
