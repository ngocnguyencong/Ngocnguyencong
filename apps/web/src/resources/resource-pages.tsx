import { ArrowLeft, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import type { AppLocale } from "@supastack/i18n";

import {
  blogBreadcrumbJsonLd,
  blogPostingJsonLd,
  docsBreadcrumbJsonLd,
  JsonLd,
} from "../marketing/seo";
import {
  categories,
  docTabs,
  guides,
  readingMinutes,
  formatPostDate,
  type Guide,
  type Post,
  type Section,
} from "./content";
import { buildDocsIndex, guideToMarkdown } from "./docs-markdown";
import { DOCS_COPY, docsHref } from "./docs-copy";
import { guideContinuation, guideSetupFlow } from "./docs-continuation";
import { CopyMarkdownButton, DocsMotion, DocsSearchPalette, DocsSideScroll } from "./docs-tools";
import styles from "./resources.module.css";

export function ArticleArt({ post }: { post: Post }) {
  return (
    <div className={styles.art} aria-hidden="true">
      <span className={styles.coverBrand}>
        <span>supastack</span>
      </span>
      <span className={styles.coverTitle}>{post.title}</span>
    </div>
  );
}
export function PostMeta({ post }: { post: Post }) {
  return (
    <div className={styles.meta}>
      <span className={styles.byline}>supastack team</span>
      <time dateTime={post.date}>{formatPostDate(post.date)}</time>
      <span>{readingMinutes(post)} min read</span>
    </div>
  );
}
export function BlogIndex({ posts, category }: { posts: readonly Post[]; category: string }) {
  return (
    <main id="main" className={styles.blogMain}>
      <header className={styles.intro}>
        <h1>Blog</h1>
        <p>Practical guides for building and launching your SaaS.</p>
      </header>
      <div className={styles.blogBody}>
        <nav className={styles.filters} aria-label="Article categories">
          {categories.map((item) => (
            <Link
              key={item}
              aria-current={category === item ? "page" : undefined}
              href={
                item === "All articles" ? "/blog" : `/blog?category=${encodeURIComponent(item)}`
              }
            >
              {item}
            </Link>
          ))}
        </nav>
        <div className={styles.postList}>
          {posts.map((post) => (
            <article key={post.slug} className={styles.postCard}>
              <Link className={styles.postLink} href={`/blog/${post.slug}`} aria-label={post.title}>
                <ArticleArt post={post} />
                <div className={styles.postCopy}>
                  <span className={styles.category}>{post.category}</span>
                  <h2>{post.title}</h2>
                  <p>{post.description}</p>
                  <PostMeta post={post} />
                </div>
              </Link>
            </article>
          ))}
        </div>
        <aside className={styles.docsCta}>
          <div>
            <h2>Start building with supastack.</h2>
            <p>Everything you need to set up the foundation and make it yours.</p>
          </div>
          <Link className="website-control" href="/docs">
            Read the docs
          </Link>
        </aside>
      </div>
    </main>
  );
}
function DocText({ text, locale }: { text: string; locale: AppLocale }) {
  return text
    .split(/(`[^`]+`|\[[^\]]+\]\((?:\/docs[^\s)]*|https:\/\/[^\s)]+)\))/g)
    .map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      return link ? (
        <Link key={index} href={docsHref(locale, link[2]!)}>
          {link[1]}
        </Link>
      ) : (
        part
      );
    });
}
export function Sections({
  sections,
  locale = "en",
}: {
  sections: readonly Section[];
  locale?: AppLocale;
}) {
  return (
    <div className={styles.prose}>
      {sections.map((section) => (
        <section key={section.id} id={section.id}>
          <h2>
            <a href={`#${section.id}`}>{section.title}</a>
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>
              <DocText text={paragraph} locale={locale} />
            </p>
          ))}
          {section.code && (
            <pre
              tabIndex={0}
              aria-label={DOCS_COPY[locale].codeExample.replace("{title}", section.title)}
            >
              <code>{section.code}</code>
            </pre>
          )}
          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>
                  <DocText text={item} locale={locale} />
                </li>
              ))}
            </ul>
          )}
          {section.table && (
            <SectionTable table={section.table} title={section.title} locale={locale} />
          )}
          {section.links && (
            <ul>
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link href={docsHref(locale, link.href)}>{link.label}</Link>
                  {link.description ? <> — {link.description}</> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
function SectionTable({
  table,
  title,
  locale,
}: {
  table: NonNullable<Section["table"]>;
  title: string;
  locale: AppLocale;
}) {
  const rowHeaders = table.head[0] === "";
  return (
    <div
      className={styles.tableWrap}
      role="region"
      aria-label={DOCS_COPY[locale].table.replace("{title}", title)}
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {table.head.map((cell, index) =>
              cell === "" ? (
                <td key={index} />
              ) : (
                <th
                  key={index}
                  scope="col"
                  className={index === table.accentColumn ? styles.accentCell : undefined}
                >
                  <DocText text={cell} locale={locale} />
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 && rowHeaders ? (
                  <th key={cellIndex} scope="row">
                    <DocText text={cell} locale={locale} />
                  </th>
                ) : (
                  <td
                    key={cellIndex}
                    className={cellIndex === table.accentColumn ? styles.accentCell : undefined}
                  >
                    <DocText text={cell} locale={locale} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function TableOfContents({
  sections,
  locale = "en",
}: {
  sections: readonly Section[];
  locale?: AppLocale;
}) {
  return (
    <nav className={styles.toc} aria-label={DOCS_COPY[locale].onThisPage}>
      <p>{DOCS_COPY[locale].onThisPage}</p>
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`}>
          {section.title}
        </a>
      ))}
    </nav>
  );
}
export function BlogArticle({ post, related }: { post: Post; related: readonly Post[] }) {
  return (
    <main id="main" className={styles.articleMain}>
      <JsonLd data={[blogPostingJsonLd(post), blogBreadcrumbJsonLd(post)]} />
      <Link className={styles.back} href="/blog">
        <ArrowLeft aria-hidden="true" size={14} /> All articles
      </Link>
      <header className={styles.articleHeader}>
        <PostMeta post={post} />
        <h1>{post.title}</h1>
        <p>{post.description}</p>
        <div className={styles.author}>
          <span>supastack team</span>
        </div>
      </header>
      <ArticleArt post={post} />
      <div className={styles.readingGrid}>
        <article>
          <Sections sections={post.sections} />
          <aside className={styles.guideLink}>
            <p>Put it into practice</p>
            <Link href={`/docs/${post.guide}`}>Explore the related documentation ↗</Link>
          </aside>
        </article>
        <TableOfContents sections={post.sections} />
      </div>
      <section className={styles.related}>
        <h2>Keep reading</h2>
        {related.slice(0, 3).map((item) => (
          <Link key={item.slug} href={`/blog/${item.slug}`}>
            <span>{item.title}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
function SidebarLinks({
  guide,
  entries: allEntries,
  locale,
}: {
  guide: Guide;
  entries: readonly Guide[];
  locale: AppLocale;
}) {
  const entries = allEntries.filter((item) => item.tab === guide.tab);
  return (
    <nav aria-label={DOCS_COPY[locale].pages} className={styles.navTree}>
      {[...new Set(entries.map((item) => item.group))].map((group) => (
        <details className={styles.navGroup} key={group} open suppressHydrationWarning>
          <summary>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              className={styles.groupChevron}
            >
              <path
                d="m9 18 6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {group}
          </summary>
          <div className={styles.navItems}>
            {entries
              .filter((item) => item.group === group)
              .map((item) => (
                <Link
                  key={item.slug}
                  href={docsHref(locale, `/docs/${item.slug}`)}
                  aria-current={item.slug === guide.slug ? "page" : undefined}
                >
                  {item.slug === `${item.tab}/local-setup` && (
                    <Zap
                      size={13}
                      aria-hidden="true"
                      className={styles.quickstartIcon}
                      fill="currentColor"
                    />
                  )}
                  {item.title}
                </Link>
              ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
export function DocsPage({
  guide,
  query,
  results,
  entries = guides,
  locale = "en",
}: {
  guide: Guide;
  query: string;
  results?: readonly Guide[] | undefined;
  entries?: readonly Guide[];
  locale?: AppLocale;
}) {
  const copy = DOCS_COPY[locale];
  const siblings = entries.filter((item) => item.tab === guide.tab);
  const index = siblings.findIndex((item) => item.slug === guide.slug);
  const previous = entries.find((entry) => entry.continueTo === guide.slug) ?? siblings[index - 1];
  const next = guideContinuation(guide, entries);
  const setupFlow = guideSetupFlow(guide, entries)?.guide;
  const [setupBefore, setupAfter] = copy.setupSentence.split("{guide}");
  return (
    <main id="main" className={styles.docsMain}>
      {results === undefined ? <JsonLd data={docsBreadcrumbJsonLd(guide, locale)} /> : null}
      <DocsMotion />
      <DocsSideScroll />
      <div className={styles.docsTop}>
        <Link className={styles.docsWordmark} href={docsHref(locale, "/docs")}>
          {copy.documentation}
        </Link>
        <form
          action={docsHref(locale, "/docs")}
          method="get"
          role="search"
          className={styles.search}
        >
          <label className={styles.srOnly} htmlFor="docs-search">
            {copy.searchDocumentation}
          </label>
          <input
            id="docs-search"
            name="q"
            type="search"
            placeholder={copy.searchPlaceholder}
            defaultValue={query}
            maxLength={200}
          />
          <button type="submit">
            {copy.search} <span aria-hidden="true">↵</span>
          </button>
        </form>
        <DocsSearchPalette index={buildDocsIndex(entries)} locale={locale} />
      </div>
      <nav className={styles.docTabs} aria-label={copy.sections}>
        {docTabs.map((tab) => (
          <Link
            key={tab.slug}
            href={docsHref(locale, `/docs/${tab.slug}`)}
            aria-current={guide.tab === tab.slug && results === undefined ? "page" : undefined}
          >
            <span>{copy[tab.slug]}</span>
            <small>{tab.slug === "modules" ? copy.shared : tab.detail}</small>
          </Link>
        ))}
      </nav>
      <div className={styles.docsGrid}>
        <aside className={styles.sidebar}>
          <SidebarLinks guide={guide} entries={entries} locale={locale} />
        </aside>
        <details className={styles.mobileSidebar} suppressHydrationWarning>
          <summary>
            {copy.browse}
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              className={styles.groupChevron}
            >
              <path
                d="m9 18 6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <SidebarLinks guide={guide} entries={entries} locale={locale} />
        </details>
        {results !== undefined ? (
          <section className={styles.docContent}>
            <header className={styles.docHeader}>
              <p>{copy.searchContext}</p>
              <h1>{copy.searchTitle}</h1>
              <p>
                {(results.length === 1 ? copy.resultCountOne : copy.resultCount)
                  .replace("{count}", String(results.length))
                  .replace("{query}", query)}
              </p>
            </header>
            <div className={styles.searchResults}>
              {results.length ? (
                results.map((result) => (
                  <Link href={docsHref(locale, `/docs/${result.slug}`)} key={result.slug}>
                    <small>
                      {copy[result.tab]} / {result.group}
                    </small>
                    <h2>{result.title}</h2>
                    <p>{result.description}</p>
                    <span>{copy.readGuide} ↗</span>
                  </Link>
                ))
              ) : (
                <div className={styles.empty}>
                  <h2>{copy.noResults}</h2>
                  <p>{copy.noResultsHint}</p>
                  <Link href={docsHref(locale, "/docs")}>{copy.browseAll}</Link>
                </div>
              )}
            </div>
          </section>
        ) : (
          <>
            <article className={styles.docContent}>
              <header className={styles.docHeader}>
                <p>
                  {copy[guide.tab]} / {guide.group}
                </p>
                <h1>{guide.title}</h1>
                <p>{guide.description}</p>
                <CopyMarkdownButton
                  markdown={guideToMarkdown(
                    guide,
                    next
                      ? {
                          label: copy.next,
                          title: next.title,
                          href: docsHref(locale, `/docs/${next.slug}`),
                          ...(setupFlow
                            ? {
                                setupFlow: {
                                  sentence: copy.setupSentence,
                                  title: setupFlow.title,
                                  href: docsHref(locale, `/docs/${setupFlow.slug}`),
                                },
                              }
                            : {}),
                        }
                      : undefined,
                  )}
                  locale={locale}
                />
              </header>
              <Sections sections={guide.sections} locale={locale} />
              {setupFlow && (
                <p className={styles.setupFlow} data-setup-flow>
                  {setupBefore}
                  <Link href={docsHref(locale, `/docs/${setupFlow.slug}`)}>{setupFlow.title}</Link>
                  {setupAfter}
                </p>
              )}
              <nav aria-label={copy.adjacent} className={styles.pagination}>
                {previous ? (
                  <Link href={docsHref(locale, `/docs/${previous.slug}`)}>
                    <small>
                      <ArrowLeft aria-hidden="true" size={12} /> {copy.previous}
                    </small>
                    <span>{previous.title}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {next && (
                  <Link href={docsHref(locale, `/docs/${next.slug}`)}>
                    <small>
                      {copy.next} <ArrowRight aria-hidden="true" size={12} />
                    </small>
                    <span>{next.title}</span>
                  </Link>
                )}
              </nav>
            </article>
            <TableOfContents sections={guide.sections} locale={locale} />
          </>
        )}
      </div>
    </main>
  );
}
