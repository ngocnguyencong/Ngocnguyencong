import styles from "./changelog-timeline.module.css";

export type ChangelogItem = {
  /** Bold lead line for roadmap-style upcoming work. */
  title: string;
  /** Muted paragraph under the item title. */
  body: string;
};

export type ChangelogEntry = {
  /** Rail top line — release date ("Sep 18, 2026") or a roadmap eyebrow ("Coming soon"). */
  meta: string;
  /** Rail secondary lines — framework tags or a kind label like "Roadmap". */
  tags?: readonly string[] | undefined;
  /** Pill above the title — e.g. "Latest". */
  badge?: string | undefined;
  /** Entry heading — release name or "Work in progress". */
  title: string;
  /** Accent kind line under the title — "New", "Improved", "Fixed". */
  kind?: string | undefined;
  /** Intro paragraph between the title and the change list. */
  summary?: string | undefined;
  /** Bullet list of shipped changes. */
  points?: readonly string[] | undefined;
  /** Titled paragraphs — roadmap-style upcoming items. */
  items?: readonly ChangelogItem[] | undefined;
  /** Trailing muted line — e.g. "… and smaller fixes". */
  more?: string | undefined;
  /** Marks the entry as not-yet-shipped — the timeline dot stays a hollow accent ring. */
  upcoming?: boolean | undefined;
};

/**
 * Kit block — changelog timeline. An ordered list of releases on a rail +
 * body grid with a vertical spine: the left rail carries meta/tags, the body
 * carries badge, title, kind, summary, bullet points, and titled item groups.
 * An `upcoming` entry pinned first turns the same list into a roadmap ledger.
 */
export function ChangelogTimeline({ entries }: { entries: readonly ChangelogEntry[] }) {
  return (
    <ol className={styles.list}>
      {entries.map((entry) => (
        <li
          className={styles.entry}
          data-upcoming={entry.upcoming ? "true" : undefined}
          key={`${entry.meta}:${entry.title}`}
        >
          <div className={styles.rail}>
            <p className={styles.meta}>{entry.meta}</p>
            {entry.tags?.length ? (
              <ul className={styles.tags}>
                {entry.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className={styles.body}>
            {entry.badge ? <span className={styles.badge}>{entry.badge}</span> : null}
            <h2 className={styles.title}>{entry.title}</h2>
            {entry.kind ? <p className={styles.kind}>{entry.kind}</p> : null}
            {entry.summary ? <p className={styles.summary}>{entry.summary}</p> : null}
            {entry.points?.length ? (
              <ul className={styles.points}>
                {entry.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
            {entry.items?.length ? (
              <div className={styles.items}>
                {entry.items.map((item) => (
                  <div className={styles.item} key={item.title}>
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                    <p className={styles.itemBody}>{item.body}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {entry.more ? <p className={styles.more}>{entry.more}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
