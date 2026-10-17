import { ArrowRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { ProductFrame, type ProductFrameTab } from "./product-frame";
import styles from "./hero-product.module.css";

/**
 * Kit block — product hero (minimal grammar): left-aligned eyebrow, tight
 * headline, lede, a black pill plus a quiet text link, then the real product
 * UI inside an elevated ProductFrame at full container width. The authored
 * load entrance is CSS-only (staggered rise) and skips itself under reduced
 * motion — the resting state is always the final state.
 */
export function HeroProduct({
  eyebrow,
  title,
  titleBreak,
  lede,
  primary,
  secondary,
  product,
  productUrl,
  chrome = "browser",
  productBrand,
  productTabs,
  productStatus,
  titleId,
}: {
  eyebrow?: string | undefined;
  title: string;
  /** Optional second headline line, forced onto its own line. */
  titleBreak?: string | undefined;
  lede: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string } | undefined;
  /** Product UI rendered inside the elevated frame — pass real markup. */
  product?: ReactNode;
  /** URL shown in the frame's chrome pill (browser chrome only). */
  productUrl?: string | undefined;
  /** Frame chrome: "browser" (default) or "app" (flat titlebar). */
  chrome?: "browser" | "app" | undefined;
  /** Leading brand slot in the app titlebar — mark + wordmark. */
  productBrand?: ReactNode;
  /** Segmented tab strip in the app titlebar. */
  productTabs?: readonly ProductFrameTab[];
  /** Status strip rendered at the bottom edge of the frame. */
  productStatus?: ReactNode;
  /** Heading id for aria-labelledby — override when more than one hero is on a page. */
  titleId?: string | undefined;
}) {
  const id = titleId ?? "hero-product-title";
  return (
    <section className={styles.hero} aria-labelledby={id}>
      <div className={styles.wrap}>
        {eyebrow ? (
          <p className={styles.eyebrow} style={{ "--in-d": "0ms" } as CSSProperties}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className={styles.title} id={id} style={{ "--in-d": "60ms" } as CSSProperties}>
          {title}
          {titleBreak ? (
            <>
              <br />
              {titleBreak}
            </>
          ) : null}
        </h1>
        <p className={styles.lede} style={{ "--in-d": "120ms" } as CSSProperties}>
          {lede}
        </p>
        <div className={styles.actions} style={{ "--in-d": "180ms" } as CSSProperties}>
          <a className={`${styles.pill} ${styles.pillB}`} href={primary.href}>
            {primary.label}
            <ArrowRight aria-hidden="true" className={styles.arrow} size={16} strokeWidth={2.2} />
          </a>
          {secondary ? (
            <a className={styles.tlink} href={secondary.href}>
              {secondary.label}
              <ArrowRight aria-hidden="true" className={styles.arrow} size={16} strokeWidth={2.2} />
            </a>
          ) : null}
        </div>
        {product ? (
          <div className={styles.product} style={{ "--in-d": "240ms" } as CSSProperties}>
            <ProductFrame
              brand={productBrand}
              chrome={chrome}
              status={productStatus}
              tabs={productTabs}
              url={productUrl}
            >
              {product}
            </ProductFrame>
          </div>
        ) : null}
      </div>
    </section>
  );
}
