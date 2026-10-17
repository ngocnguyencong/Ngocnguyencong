import { ArrowRight } from "lucide-react";

import styles from "./product-grid.module.css";

export type ProductCard = {
  name: string;
  description?: string | undefined;
  price: string;
  /** Optional image; falls back to a token-tinted monogram tile. */
  image?: { src: string; alt: string } | undefined;
  href?: string | undefined;
  badge?: string | undefined;
};

/** Kit block — purchasable product cards for shop/catalog marketing pages. */
export function ProductGrid({
  heading,
  sub,
  products,
  ctaLabel = "View",
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  products: readonly ProductCard[];
  ctaLabel?: string | undefined;
}) {
  return (
    <section className={styles.section} aria-label={heading ?? "Products"}>
      {heading || sub ? (
        <header className={styles.header}>
          {heading ? <h2 className={styles.heading}>{heading}</h2> : null}
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </header>
      ) : null}
      <ul className={styles.grid}>
        {products.map((product) => {
          const card = (
            <>
              <span className={styles.media}>
                {product.image ? (
                  <img className={styles.image} src={product.image.src} alt={product.image.alt} />
                ) : (
                  <span className={styles.monogram} aria-hidden="true">
                    {product.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                {product.badge ? <span className={styles.badge}>{product.badge}</span> : null}
              </span>
              <span className={styles.body}>
                <span className={styles.row}>
                  <strong className={styles.name}>{product.name}</strong>
                  <span className={styles.price}>{product.price}</span>
                </span>
                {product.description ? (
                  <span className={styles.description}>{product.description}</span>
                ) : null}
                {product.href ? (
                  <span className={styles.cta}>
                    {ctaLabel}
                    <ArrowRight aria-hidden="true" size={13} strokeWidth={2.2} />
                  </span>
                ) : null}
              </span>
            </>
          );
          return (
            <li className={styles.card} key={product.name}>
              {product.href ? (
                <a className={styles.cardLink} href={product.href}>
                  {card}
                </a>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
