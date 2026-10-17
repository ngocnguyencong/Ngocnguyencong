import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// seo.tsx is server-only — stub it so Sections can be rendered in a test.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { guides, posts, type Section } from "./content";
import { DocsPage, Sections } from "./resource-pages";

const el = createElement as unknown as (
  component: unknown,
  props?: unknown,
  ...children: unknown[]
) => ReactElement;

const tableSection: Section = {
  id: "glance",
  title: "At a glance",
  paragraphs: ["Intro paragraph."],
  table: {
    head: ["", "supastack", "Competitor"],
    accentColumn: 1,
    rows: [
      ["Mobile", "Expo (iOS + Android)", "No"],
      ["Tests", "144", "15"],
    ],
  },
};

describe("setup flow and topic navigation", () => {
  it("offers payments separately from deeper database reading", () => {
    const guide = guides.find((entry) => entry.slug === "web/database")!;
    const html = renderToStaticMarkup(
      el(DocsPage, { guide, entries: guides, query: "", locale: "en" }),
    );
    const flow = html.match(/<p[^>]*data-setup-flow[^>]*>(.*?)<\/p>/s)?.[1];
    expect(flow).toContain('href="/docs/modules/billing-configuration"');
    const navigation = html.match(/<nav[^>]*class="[^"]*pagination[^>]*>(.*?)<\/nav>/s)?.[1];
    expect(navigation).toContain('href="/docs/deploy/supabase-cloud"');
    expect(navigation).not.toContain('href="/docs/modules/billing-configuration"');
  });
});

describe("Sections", () => {
  it("renders actual locale-preserving continuation links and inline code as content", () => {
    const section: Section = {
      id: "next",
      title: "Next step",
      paragraphs: ["Read [the database guide](/docs/web/database) and set `DATABASE_URL`."],
      links: [{ href: "/docs/modules/auth", label: "Configure authentication" }],
    };
    const html = renderToStaticMarkup(el(Sections, { sections: [section], locale: "de" }));
    expect(html).toContain('href="/de/docs/web/database"');
    expect(html).toContain('href="/de/docs/modules/auth"');
    expect(html).toContain("<code>DATABASE_URL</code>");
  });
  it("renders a section table with column and row headers", () => {
    const html = renderToStaticMarkup(el(Sections, { sections: [tableSection] }));
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain("supastack");
    expect(html).toContain('scope="row"');
    expect(html).toContain("Expo (iOS + Android)");
    // The scrollable wrapper is a named, keyboard-focusable region.
    expect(html).toContain('role="region"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="At a glance table"');
  });

  it("accents the configured column", () => {
    const html = renderToStaticMarkup(el(Sections, { sections: [tableSection] }));
    // Header cell and both body cells of column 1 carry the accent class.
    const accented = html.match(/accentCell/g) ?? [];
    expect(accented.length).toBe(3);
  });

  it("renders a plain data first column when the corner header is named", () => {
    const section: Section = {
      id: "pick",
      title: "Who should pick which",
      paragraphs: [],
      table: {
        head: ["You are building", "Pick"],
        rows: [["A product with a mobile app", "supastack"]],
      },
    };
    const html = renderToStaticMarkup(el(Sections, { sections: [section] }));
    // First column is data, not a row header, when the corner cell has a name.
    expect(html).not.toContain('scope="row"');
    expect(html).toContain("A product with a mobile app");
  });
});

describe("post table data", () => {
  it("keeps every table row as wide as its header", () => {
    for (const post of posts) {
      for (const section of post.sections) {
        if (!section.table) continue;
        for (const [index, row] of section.table.rows.entries()) {
          expect(row.length, `${post.slug}#${section.id} row ${index} width`).toBe(
            section.table.head.length,
          );
        }
        if (section.table.accentColumn !== undefined) {
          expect(section.table.accentColumn).toBeGreaterThanOrEqual(0);
          expect(section.table.accentColumn).toBeLessThan(section.table.head.length);
        }
      }
    }
  });
});
