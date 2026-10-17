import { ArrowRight, Check } from "lucide-react";

import styles from "./pricing-panel.module.css";

export type PricingTier = {
  name: string;
  /** Price string or a placeholder like "Coming soon". */
  price: string;
  description: string;
  features: readonly string[];
  cta: { href: string; label: string };
  recommended?: boolean | undefined;
  /** Label shown in accent on the recommended column — e.g. "Recommended". */
  recommendedLabel?: string | undefined;
};

/**
 * Kit block — pricing panel: one joined ruled panel, columns split by
 * hairlines (no floating cards). The recommended tier gets a 4% accent
 * tint, an accent label, and the primary pill; other tiers get outline
 * pills. No entrance motion — only the pill arrow nudges on hover.
 */
export function PricingPanel({
  eyebrow,
  title,
  sub,
  tiers,
}: {
  eyebrow?: string | undefined;
  title: string;
  sub?: string | undefined;
  tiers: readonly PricingTier[];
}) {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.title}>{title}</h2>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <div className={styles.panel}>
          {tiers.map((tier) => (
            <div
              className={`${styles.tier} ${tier.recommended ? styles.recommended : ""}`}
              key={tier.name}
            >
              <p className={styles.tierName}>
                {tier.name}
                {tier.recommended && tier.recommendedLabel ? (
                  <span className={styles.recTag}>{tier.recommendedLabel}</span>
                ) : null}
              </p>
              <p className={styles.price}>{tier.price}</p>
              <p className={styles.desc}>{tier.description}</p>
              <ul className={styles.features}>
                {tier.features.map((feature) => (
                  <li key={feature}>
                    <Check
                      aria-hidden="true"
                      className={styles.check}
                      size={14}
                      strokeWidth={2.4}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                className={`${styles.pill} ${tier.recommended ? styles.pillB : styles.pillO}`}
                href={tier.cta.href}
              >
                {tier.cta.label}
                <ArrowRight
                  aria-hidden="true"
                  className={styles.arrow}
                  size={15}
                  strokeWidth={2.2}
                />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
