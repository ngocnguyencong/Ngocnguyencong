import type { ReactNode } from "react";
import styles from "./logo-strip.module.css";

/**
 * Kit block — "trusted by" strip. Pass real logos/wordmarks as ReactNode
 * children (svg/img/text); keep them monochrome-friendly by styling with
 * currentColor where possible.
 *
 * `marquee` renders an edge-faded infinite loop (the row is duplicated
 * once, aria-hidden); it pauses on hover and collapses to a static strip
 * under prefers-reduced-motion.
 */
export function LogoStrip({
  label,
  marquee = false,
  children,
}: {
  label?: string | undefined;
  marquee?: boolean | undefined;
  children: ReactNode;
}) {
  const row = <div className={styles.row}>{children}</div>;
  return (
    <section className={styles.section} aria-label={label ?? "Trusted by"}>
      {label ? <p className={styles.label}>{label}</p> : null}
      {marquee ? (
        <div className={styles.marquee}>
          <div className={styles.marqueeTrack}>
            {row}
            <div aria-hidden="true" className={styles.row}>
              {children}
            </div>
          </div>
        </div>
      ) : (
        row
      )}
    </section>
  );
}
