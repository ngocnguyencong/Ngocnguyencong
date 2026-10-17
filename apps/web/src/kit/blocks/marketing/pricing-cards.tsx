import styles from "./pricing-cards.module.css";

export type PricingTier = {
  name: string;
  price: string;
  period?: string | undefined;
  description: string;
  features: readonly string[];
  cta: { href: string; label: string };
  recommended?: boolean | undefined;
};

/** Kit block — pricing tiers with an accent-highlighted recommended card. */
export function PricingCards({
  heading,
  sub,
  tiers,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  tiers: readonly PricingTier[];
}) {
  return (
    <section className={styles.section} aria-label={heading ?? "Pricing"}>
      {heading || sub ? (
        <header className={styles.header}>
          {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </header>
      ) : null}
      <ul className={styles.grid}>
        {tiers.map((tier) => (
          <li
            className={styles.card}
            data-recommended={tier.recommended ? "true" : undefined}
            key={tier.name}
          >
            {tier.recommended ? <span className={styles.badge}>Popular</span> : null}
            <h3 className={styles.tierName}>{tier.name}</h3>
            <p className={styles.price}>
              <strong>{tier.price}</strong>
              {tier.period ? <span className={styles.period}> / {tier.period}</span> : null}
            </p>
            <p className={styles.tierDesc}>{tier.description}</p>
            <ul className={styles.features}>
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <a
              className={`${styles.cta} ${tier.recommended ? styles.ctaPrimary : styles.ctaSecondary}`}
              href={tier.cta.href}
            >
              {tier.cta.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
