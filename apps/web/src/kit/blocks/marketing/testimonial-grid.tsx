import type { ReactNode } from "react";
import { Star } from "lucide-react";
import styles from "./testimonial-grid.module.css";

export type Testimonial = {
  quote: string;
  name: string;
  /** Role/company line, e.g. "CTO, Acme". */
  detail?: string | undefined;
  /** Optional avatar/initials slot. */
  avatar?: ReactNode | undefined;
  profileUrl?: string | undefined;
  rating?: number | undefined;
  lang?: string | undefined;
};

/** Kit block — customer quote section. An optional featured card spans two columns. */
export function TestimonialGrid({
  id,
  eyebrow,
  heading,
  intro,
  items,
  featuredIndex,
  ratingLabel = "{rating} out of 5 stars",
}: {
  id?: string | undefined;
  eyebrow?: string | undefined;
  heading?: string | undefined;
  intro?: string | undefined;
  items: readonly Testimonial[];
  featuredIndex?: number | undefined;
  ratingLabel?: string | undefined;
}) {
  const featured = featuredIndex ?? (items.length === 4 ? -1 : 0);
  return (
    <section
      aria-label={heading && !id ? heading : undefined}
      aria-labelledby={heading && id ? `${id}-heading` : undefined}
      className={styles.section}
      id={id}
    >
      {heading ? (
        <div className={styles.intro}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h2 id={id ? `${id}-heading` : undefined} className={styles.heading}>
            {heading}
          </h2>
          {intro ? <p className={styles.introText}>{intro}</p> : null}
        </div>
      ) : null}
      <div className={styles.grid} data-count={items.length}>
        {items.map((item, i) => {
          const rating =
            item.rating === undefined ? undefined : Math.max(0, Math.min(5, item.rating));
          return (
            <figure
              className={styles.card}
              data-featured={i === featured ? "true" : undefined}
              key={item.name + i}
            >
              <blockquote className={styles.quote} lang={item.lang}>
                {item.quote}
              </blockquote>
              <figcaption className={styles.attribution}>
                {item.avatar ? <span className={styles.avatar}>{item.avatar}</span> : null}
                <span className={styles.who}>
                  <span className={styles.identity}>
                    {item.profileUrl ? (
                      <a
                        className={styles.name}
                        href={item.profileUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {item.name}
                      </a>
                    ) : (
                      <span className={styles.name}>{item.name}</span>
                    )}
                    {rating !== undefined ? (
                      <span
                        className={styles.stars}
                        aria-label={ratingLabel.replace("{rating}", String(rating))}
                        role="img"
                      >
                        {Array.from({ length: 5 }, (_, star) => (
                          <Star
                            aria-hidden="true"
                            data-star={star < rating ? "filled" : "empty"}
                            fill={star < rating ? "currentColor" : "none"}
                            key={star}
                            size={13}
                            strokeWidth={1.5}
                          />
                        ))}
                      </span>
                    ) : null}
                  </span>
                  {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
