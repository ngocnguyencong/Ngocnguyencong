import type { ReactNode } from "react";
import styles from "./site-header.module.css";

/**
 * Kit block — marketing site header: sticky brand + nav + CTA row.
 * Keep the link list short and honest; mobile collapses into a
 * horizontally scrollable nav rather than a hamburger.
 */
export function SiteHeader({
  brand,
  links,
  cta,
}: {
  /** Caller-supplied brand mark (logo + wordmark) wrapped in a link. */
  brand: ReactNode;
  links: readonly { href: string; label: string; active?: boolean | undefined }[];
  cta?: { href: string; label: string } | undefined;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>{brand}</div>
        <nav aria-label="Site" className={styles.nav}>
          {links.map((link) => (
            <a
              aria-current={link.active ? "page" : undefined}
              className={styles.link}
              data-active={link.active ? "true" : undefined}
              href={link.href}
              key={link.href + link.label}
            >
              {link.label}
            </a>
          ))}
        </nav>
        {cta ? (
          <a className={styles.cta} href={cta.href}>
            {cta.label}
          </a>
        ) : null}
      </div>
    </header>
  );
}
