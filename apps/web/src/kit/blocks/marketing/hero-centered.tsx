import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import styles from "./hero-centered.module.css";

export type HeroAction = { href: string; label: string };

/**
 * Kit block — centered marketing hero. Copy this file + its module.css into a
 * product and rewrite the copy; styling follows whichever theme surface
 * (.marketing-theme / .app-theme) and pack wraps it. Icons/art slots are
 * caller-supplied so blocks never prescribe imagery.
 */
export function HeroCentered({
  kicker,
  title,
  accent,
  subtitle,
  lede,
  children,
  primary,
  secondary,
  trust,
}: {
  kicker?: string | undefined;
  /** Plain headline — pass `accent` for the emphasized tail. */
  title: string;
  /** Emphasized span appended to the title (renders in --accent, serif if the surface has one). */
  accent?: string | undefined;
  /** A separate second headline line. */
  subtitle?: string | undefined;
  lede?: string | undefined;
  /** Caller-owned content between the headline/copy and actions. */
  children?: ReactNode;
  primary: HeroAction;
  secondary?: HeroAction | undefined;
  trust?: { href: string; label: string; avatars: ReactNode } | undefined;
}) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.inner}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.title} id="hero-title">
          {title}
          {accent ? <em className={styles.accent}> {accent}</em> : null}
          {subtitle ? <span className={styles.subtitle}> {subtitle}</span> : null}
        </h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
        {children}
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
        {trust ? (
          <a className={styles.trust} href={trust.href}>
            <span className={styles.trustAvatars} aria-hidden="true">
              {trust.avatars}
            </span>
            <span>{trust.label}</span>
            <ArrowDown aria-hidden="true" size={14} strokeWidth={1.5} />
          </a>
        ) : null}
      </div>
    </section>
  );
}
