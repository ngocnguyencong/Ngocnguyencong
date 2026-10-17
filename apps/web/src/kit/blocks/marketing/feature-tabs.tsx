"use client";

import type { LucideIcon } from "lucide-react";
import {
  createElement,
  isValidElement,
  useId,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { ProductFrame } from "./product-frame";
import styles from "./feature-tabs.module.css";

export type FeatureTabItem = {
  /** Unique slug — also seeds the tab/panel aria ids. */
  id: string;
  /** Short capability name on the tab strip. */
  label: string;
  /** Panel headline. */
  title: string;
  description: string;
  /** Bullet points under the description. */
  points: readonly string[];
  /**
   * Optional marker on the tab + in the default media surface. Pass an
   * element (`<ShieldCheck />`) from server components — component
   * references cannot cross the RSC boundary; client callers may pass the
   * LucideIcon component itself.
   */
  icon?: LucideIcon | ReactElement | undefined;
  /** Product visual for the panel — defaults to a ProductFrame placeholder. */
  media?: ReactNode | undefined;
};

function renderIcon(icon: FeatureTabItem["icon"], className: string | undefined) {
  if (!icon) return null;
  return (
    <span aria-hidden="true" className={className}>
      {isValidElement(icon) ? icon : createElement(icon, { size: 16, strokeWidth: 1.8 })}
    </span>
  );
}

/**
 * Kit block — interactive feature tour: a tab strip of capability names,
 * each revealing a panel with a headline, description, bullet list, and a
 * product visual. WAI-ARIA tabs pattern: arrow keys, Home/End, roving
 * tabindex, automatic activation.
 *
 * Fails open like scroll-reveal: every panel stays in the DOM and the
 * hiding styles for inactive panels only apply under `scripting: enabled`,
 * so no-JS readers get the full text; the entrance animation requires
 * `prefers-reduced-motion: no-preference`.
 */
export function FeatureTabs({
  heading,
  sub,
  label,
  items,
  defaultActiveId,
}: {
  heading?: string | undefined;
  sub?: string | undefined;
  /** Accessible name for the tab strip — defaults to `heading` then "Features". */
  label?: string | undefined;
  items: readonly FeatureTabItem[];
  /** Initially selected tab — defaults to the first item. */
  defaultActiveId?: string | undefined;
}) {
  const [activeId, setActiveId] = useState(
    () => items.find((item) => item.id === defaultActiveId)?.id ?? items[0]?.id ?? "",
  );
  const base = useId();
  const headingId = `${base}-heading`;

  if (items.length === 0) return null;

  // If `items` changes to a set lacking `activeId`, fall back to the first
  // item at render so the widget never bricks (all tabs -1 / all panels
  // hidden). The next interaction stores a valid id again.
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = items.length;
    let next = -1;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + count) % count;
    else return;
    event.preventDefault();
    const item = items[next];
    if (!item) return;
    // Automatic activation: focus and selection travel together.
    setActiveId(item.id);
    document.getElementById(`${base}-tab-${item.id}`)?.focus();
  }

  return (
    <section
      className={styles.section}
      {...(heading ? { "aria-labelledby": headingId } : { "aria-label": label ?? "Features" })}
    >
      {heading || sub ? (
        <header className={styles.header}>
          {heading ? (
            <h2 className={styles.heading} id={headingId}>
              {heading}
            </h2>
          ) : null}
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </header>
      ) : null}
      <div className={styles.layout}>
        <div aria-label={label ?? heading ?? "Features"} className={styles.tablist} role="tablist">
          {items.map((item, index) => {
            const active = item.id === activeItem?.id;
            return (
              <button
                aria-controls={`${base}-panel-${item.id}`}
                aria-selected={active}
                className={styles.tab}
                data-active={active || undefined}
                id={`${base}-tab-${item.id}`}
                key={item.id}
                onClick={() => setActiveId(item.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                role="tab"
                tabIndex={active ? 0 : -1}
                type="button"
              >
                {renderIcon(item.icon, styles.tabIcon)}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.panels}>
          {items.map((item) => {
            const active = item.id === activeItem?.id;
            return (
              <div
                aria-labelledby={`${base}-tab-${item.id}`}
                className={styles.panel}
                data-active={active || undefined}
                id={`${base}-panel-${item.id}`}
                key={item.id}
                role="tabpanel"
                tabIndex={0}
              >
                <div className={styles.panelGrid}>
                  <div className={styles.copy}>
                    <h3 className={styles.title}>{item.title}</h3>
                    <p className={styles.description}>{item.description}</p>
                    {item.points.length > 0 ? (
                      <ul className={styles.points}>
                        {item.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className={styles.media}>
                    {item.media ?? (
                      <ProductFrame>
                        <div className={styles.mediaPlaceholder}>
                          {renderIcon(item.icon, styles.mediaIcon)}
                        </div>
                      </ProductFrame>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
