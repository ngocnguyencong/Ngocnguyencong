import type { ReactNode } from "react";
import styles from "./hero-split.module.css";

/**
 * Kit block — split hero: copy left, media right (the classic SaaS layout).
 * `media` is a caller slot — pass a real product screenshot/preview or any
 * framed content; the block never fakes imagery for you.
 */
export function HeroSplit({
  kicker,
  title,
  accent,
  lede,
  primary,
  secondary,
  media,
  proof,
}: {
  kicker?: string | undefined;
  title: string;
  accent?: string | undefined;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string } | undefined;
  media: ReactNode;
  /** Small line under the CTAs — e.g. "Free while in beta". */
  proof?: string | undefined;
}) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.title} id="hero-title">
          {title}
          {accent ? <em className={styles.accent}> {accent}</em> : null}
        </h1>
        <p className={styles.lede}>{lede}</p>
        <div className={styles.actions}>
          <a className={`${styles.btn} ${styles.btnPrimary}`} href={primary.href}>
            {primary.label}
          </a>
          {secondary ? (
            <a className={`${styles.btn} ${styles.btnSecondary}`} href={secondary.href}>
              {secondary.label}
            </a>
          ) : null}
        </div>
        {proof ? <p className={styles.proof}>{proof}</p> : null}
      </div>
      <div className={styles.media}>{media}</div>
    </section>
  );
}
