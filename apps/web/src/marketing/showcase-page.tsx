import { hasShowcaseEntries, showcaseEntries } from "./showcase-entries";
import styles from "./utility-page.module.css";

export function ShowcasePage() {
  return (
    <main id="main" className={styles.main}>
      <header className={styles.intro}>
        <h1>Showcase</h1>
        <p>Products that use supastack, listed only when their teams ask to appear here.</p>
      </header>
      {hasShowcaseEntries(showcaseEntries) ? (
        <ul className={styles.prose}>
          {showcaseEntries.map((entry) => (
            <li key={entry.href}>
              <a href={entry.href}>{entry.name}</a>
              <p>{entry.summary}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>
          No public customer list yet. Products built on supastack will appear here when their teams
          choose to be listed.
        </p>
      )}
    </main>
  );
}
