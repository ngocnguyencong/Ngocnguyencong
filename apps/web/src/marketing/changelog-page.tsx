import type { AppLocale } from "@supastack/i18n";

import { ChangelogTimeline } from "../kit/blocks/marketing/changelog-timeline";
import { changelogEntries, formatChangelogDate } from "./changelog-entries";
import { RESOURCE_COPY } from "./resource-copy";
import styles from "./utility-page.module.css";

/** Shared metadata constants — the /changelog and /[locale]/changelog routes. */
export const changelogPageMeta = {
  path: "/changelog",
  title: RESOURCE_COPY.en.changelog.title,
  description: RESOURCE_COPY.en.changelog.description,
} as const;

export function ChangelogPage({ locale = "en" }: { locale?: AppLocale } = {}) {
  const copy = RESOURCE_COPY[locale].changelog;
  // Deliberate scope: chrome (heading, intro, badge, date format) localizes via
  // RESOURCE_COPY — entry titles/points stay English because they are curated
  // data, not page copy.
  const entries = changelogEntries.map((entry, index) => ({
    meta: formatChangelogDate(entry.date, locale),
    title: entry.title,
    points: entry.points,
    ...(index === 0 ? { badge: copy.latestBadge } : {}),
  }));
  return (
    <main id="main" className={styles.main}>
      <header className={styles.intro}>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <ChangelogTimeline entries={entries} />
    </main>
  );
}
