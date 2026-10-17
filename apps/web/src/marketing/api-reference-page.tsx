import type { AppLocale } from "@supastack/i18n";

import type { ApiReferenceGroup } from "./api-reference";
import { RESOURCE_COPY } from "./resource-copy";
import styles from "./api-reference.module.css";
import utility from "./utility-page.module.css";

/** Shared metadata constants — the /api-reference and /[locale]/api-reference routes. */
export const apiReferencePageMeta = {
  path: "/api-reference",
  title: RESOURCE_COPY.en.apiReference.title,
  description: RESOURCE_COPY.en.apiReference.description,
} as const;

/**
 * Slug for a tag's deep-link anchor. Distinct tags can collapse to the same
 * slug ("AI tasks" / "AI-tasks"), so repeats get a numeric suffix — first use
 * keeps the bare slug, later ones become `${base}-2`, `-3`, …
 */
function anchorFor(tag: string, used: Map<string, number>): string {
  const base = `api-${tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

export function ApiReferencePage({
  groups,
  locale = "en",
}: {
  groups: readonly ApiReferenceGroup[];
  locale?: AppLocale;
}) {
  const copy = RESOURCE_COPY[locale].apiReference;
  const [introBefore = "", introRest = ""] = copy.intro.split("{openApiLink}");
  const [introMiddle = "", introAfter = ""] = introRest.split("{docsLink}");
  const [authBefore = "", authAfter = ""] = copy.authBody.split("{bearerKey}");
  // Seed the auth section's anchor so a tag slugging to "auth" can't collide.
  const usedAnchors = new Map<string, number>([["api-auth", 1]]);
  return (
    <main id="main" className={utility.main}>
      <header className={utility.intro}>
        <h1>{copy.title}</h1>
        <p>
          {introBefore}
          <a href="/api/v1/openapi">{copy.introOpenApiLink}</a>
          {introMiddle}
          <a href="/api/docs">{copy.introDocsLink}</a>
          {introAfter}
        </p>
      </header>
      <div className={utility.prose}>
        {/* Deep-link anchors + scroll-margin live on sections (.home
        section[id]); headings keep separate labelled-by ids. */}
        <section className={styles.auth} id="api-auth" aria-labelledby="api-auth-heading">
          <h2 id="api-auth-heading">{copy.authHeading}</h2>
          <p>
            {authBefore}
            <code>{copy.authBearerKey}</code>
            {authAfter}
          </p>
        </section>
        {groups.map((group) => {
          const anchor = anchorFor(group.tag, usedAnchors);
          return (
            <section
              key={group.tag}
              id={anchor}
              className={styles.group}
              aria-labelledby={`${anchor}-heading`}
            >
              <h2 id={`${anchor}-heading`}>{group.tag}</h2>
              <ul className={styles.endpoints}>
                {/* Endpoint method/path/summary stay English — they mirror the
                published OpenAPI document verbatim. */}
                {group.endpoints.map((endpoint) => (
                  <li key={`${endpoint.method} ${endpoint.path}`} className={styles.endpoint}>
                    <div className={styles.endpointHead}>
                      <span className={styles.method} data-method={endpoint.method.toLowerCase()}>
                        {endpoint.method}
                      </span>
                      <code className={styles.path}>{endpoint.path}</code>
                      <span className={styles.access}>{copy.accessLabels[endpoint.auth]}</span>
                    </div>
                    {endpoint.summary ? <p>{endpoint.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
