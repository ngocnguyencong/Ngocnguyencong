import type { ReactNode } from "react";
import styles from "./site-footer.module.css";

export type FooterLinkGroup = {
  title: string;
  links: readonly { href: string; label: string }[];
};

/**
 * Kit block — marketing site footer: brand + link columns + legal line.
 * Every public page needs privacy/terms reachable from here; keep the
 * groups honest — no dead links.
 */
export function SiteFooter({
  brand,
  tagline,
  groups,
  legal,
  controls,
}: {
  /** Caller-supplied brand mark (logo + wordmark). */
  brand: ReactNode;
  tagline?: string | undefined;
  groups: readonly FooterLinkGroup[];
  /** Bottom line — copyright, jurisdiction, extra legal links. */
  legal?: ReactNode | undefined;
  /** Visitor controls row — e.g. language/theme menus; renders above legal. */
  controls?: ReactNode | undefined;
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <div className={styles.brand}>{brand}</div>
          {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
        </div>
        {groups.map((group) => (
          <nav aria-label={group.title} className={styles.group} key={group.title}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.linkList}>
              {group.links.map((link) => (
                <li key={link.href + link.label}>
                  <a className={styles.link} href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {controls ? <div className={styles.controls}>{controls}</div> : null}
      {legal ? <div className={styles.legal}>{legal}</div> : null}
    </footer>
  );
}
