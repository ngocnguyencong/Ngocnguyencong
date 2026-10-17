import styles from "./section-header.module.css";

/**
 * Kit block — typographic section header. Eyebrow renders as a short accent
 * rule + serif-italic word (editorial, not a bordered mono chip); set
 * `eyebrow` to null to skip it entirely.
 */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = "center",
}: {
  eyebrow?: string | null | undefined;
  title: string;
  sub?: string | undefined;
  align?: "center" | "left" | undefined;
}) {
  return (
    <header className={styles.header} data-align={align}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 className={styles.title}>{title}</h2>
      {sub ? <p className={styles.sub}>{sub}</p> : null}
    </header>
  );
}
