import { localePath, type AppLocale } from "@supastack/i18n";

import { groupRoadmapItems, roadmapItems } from "./roadmap-items";
import { RESOURCE_COPY } from "./resource-copy";
import styles from "./roadmap.module.css";
import utility from "./utility-page.module.css";

/** Shared metadata constants — the /roadmap and /[locale]/roadmap routes. */
export const roadmapPageMeta = {
  path: "/roadmap",
  title: RESOURCE_COPY.en.roadmap.title,
  description: RESOURCE_COPY.en.roadmap.description,
} as const;

export function RoadmapPage({ locale = "en" }: { locale?: AppLocale } = {}) {
  const copy = RESOURCE_COPY[locale].roadmap;
  const [ctaBefore = "", ctaAfter = ""] = copy.cta.split("{featureBoard}");
  const groups = groupRoadmapItems(roadmapItems);
  return (
    <main id="main" className={utility.main}>
      <header className={utility.intro}>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <div className={utility.prose}>
        {groups.map((group) => {
          const anchor = `roadmap-${group.status}`;
          const label = copy.statusLabels[group.status];
          return (
            // Deep-link anchor + scroll-margin live on the section (.home
            // section[id]) — the heading keeps a separate labelled-by id.
            <section key={group.status} id={anchor} aria-labelledby={`${anchor}-heading`}>
              <h2 id={`${anchor}-heading`}>{label}</h2>
              <ul className={styles.items}>
                {/* Item titles/descriptions stay English by deliberate scope —
                curated data, not page chrome. */}
                {group.items.map((item) => (
                  <li key={item.title} className={styles.item}>
                    <div className={styles.itemHead}>
                      <h3>{item.title}</h3>
                      <span className={styles.status} data-status={group.status}>
                        {label}
                      </span>
                    </div>
                    <p>{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <p className={styles.cta}>
          {ctaBefore}
          <a href={localePath(locale, "/feedback")}>{copy.ctaFeatureBoard}</a>
          {ctaAfter}
        </p>
      </div>
    </main>
  );
}
