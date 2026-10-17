import type { LegalDocument } from "./legal-content";
import styles from "./utility-page.module.css";

function formatUpdated(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <main id="main" className={styles.main}>
      <header className={styles.intro}>
        <h1>{document.title}</h1>
        <p>
          <time dateTime={document.updated}>Updated {formatUpdated(document.updated)}</time>
        </p>
      </header>
      <div className={styles.prose}>
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
