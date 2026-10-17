import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font" }),
}));
// The unprefixed routes resolve the visitor locale from this header (set by
// proxy.ts); fixing it to "de" exercises the redirect-to-locale branch.
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-supastack-locale": "de" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));

import ApiReferenceRoutePage from "../../app/api-reference/page";
import ChangelogRoutePage from "../../app/changelog/page";
import RoadmapRoutePage from "../../app/roadmap/page";
import LocaleApiReferencePage, {
  generateMetadata as localeApiReferenceMetadata,
} from "../../app/[locale]/api-reference/page";
import LocaleChangelogPage, {
  generateMetadata as localeChangelogMetadata,
} from "../../app/[locale]/changelog/page";
import LocaleRoadmapPage, {
  generateMetadata as localeRoadmapMetadata,
} from "../../app/[locale]/roadmap/page";
import { apiReferenceGroups } from "./api-reference";
import { ApiReferencePage } from "./api-reference-page";
import { ChangelogPage } from "./changelog-page";
import { RoadmapPage } from "./roadmap-page";
import { rootOgImage } from "./seo";

describe("public pages render", () => {
  it("changelog renders the timeline with entries", () => {
    const html = renderToStaticMarkup(<ChangelogPage />);
    expect(html).toContain("<h1>Changelog</h1>");
    expect(html).toContain("October 9, 2026");
    expect(html).toContain("Latest");
  });

  it("roadmap renders status groups and the feedback CTA", () => {
    const html = renderToStaticMarkup(<RoadmapPage />);
    for (const label of ["Shipped", "In progress", "Planned"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('href="/feedback"');
  });

  it("api-reference renders groups from the OpenAPI document", () => {
    const html = renderToStaticMarkup(<ApiReferencePage groups={apiReferenceGroups()} />);
    expect(html).toContain("/api/v1/workspaces/current");
    expect(html).toContain(">POST<");
    expect(html).toContain("Session or Bearer sk_ key");
    expect(html).toContain('href="/api/v1/openapi"');
  });
});

describe("public pages localize their chrome", () => {
  it("changelog renders German heading, badge, and dates", () => {
    const html = renderToStaticMarkup(<ChangelogPage locale="de" />);
    expect(html).toContain(">Neueste<");
    expect(html).toContain("Oktober 2026");
    expect(html).not.toContain(">Latest<");
    // Entry titles/points stay English by deliberate scope.
    expect(html).toContain("Prepaid credits, push notifications");
  });

  it("roadmap renders German status labels and a localized /feedback link", () => {
    const html = renderToStaticMarkup(<RoadmapPage locale="de" />);
    for (const label of ["Veröffentlicht", "In Arbeit", "Geplant"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('href="/de/feedback"');
    expect(html).not.toContain(">Shipped<");
  });

  it("api-reference renders German heading, auth explainer, and access labels", () => {
    const html = renderToStaticMarkup(
      <ApiReferencePage groups={apiReferenceGroups()} locale="de" />,
    );
    expect(html).toContain("<h1>API-Referenz</h1>");
    expect(html).toContain("Authentifizierung");
    expect(html).toContain("Sitzung oder Bearer-sk_-Schlüssel");
    // Endpoint data mirrors the English OpenAPI document verbatim.
    expect(html).toContain("/api/v1/workspaces/current");
  });
});

describe("deep-link anchors", () => {
  it("puts section ids on the section element with heading labelled-by ids", () => {
    const html = renderToStaticMarkup(<ApiReferencePage groups={apiReferenceGroups()} />);
    expect(html).toContain('id="api-auth"');
    expect(html).toContain('aria-labelledby="api-auth-heading"');
    const roadmap = renderToStaticMarkup(<RoadmapPage />);
    expect(roadmap).toContain('id="roadmap-shipped"');
    expect(roadmap).toContain('aria-labelledby="roadmap-shipped-heading"');
  });

  it("dedupes tag anchors that slug to the same id", () => {
    const html = renderToStaticMarkup(
      <ApiReferencePage
        groups={[
          { tag: "AI tasks", endpoints: [] },
          { tag: "AI-tasks", endpoints: [] },
        ]}
      />,
    );
    expect(html).toContain('id="api-ai-tasks"');
    expect(html).toContain('id="api-ai-tasks-2"');
  });
});

describe("unprefixed routes redirect a resolved non-English locale", () => {
  const cases = [
    { name: "changelog", page: ChangelogRoutePage, to: "/de/changelog" },
    { name: "roadmap", page: RoadmapRoutePage, to: "/de/roadmap" },
    { name: "api-reference", page: ApiReferenceRoutePage, to: "/de/api-reference" },
  ] as const;

  for (const { name, page, to } of cases) {
    it(`${name}: x-supastack-locale: de redirects to ${to}`, async () => {
      const error: unknown = await page().then(
        () => null,
        (caught: unknown) => caught,
      );
      const digest = String((error as { digest?: unknown } | null)?.digest ?? error);
      expect(digest).toContain("NEXT_REDIRECT");
      expect(digest).toContain(to);
      // Next's redirect() defaults to a temporary (307) status.
      expect(digest).toMatch(/30[78]/);
    });
  }
});

describe("locale-prefixed public pages", () => {
  const cases = [
    {
      name: "changelog",
      page: LocaleChangelogPage,
      generateMetadata: localeChangelogMetadata,
      unprefixed: "/changelog",
    },
    {
      name: "roadmap",
      page: LocaleRoadmapPage,
      generateMetadata: localeRoadmapMetadata,
      unprefixed: "/roadmap",
    },
    {
      name: "api-reference",
      page: LocaleApiReferencePage,
      generateMetadata: localeApiReferenceMetadata,
      unprefixed: "/api-reference",
    },
  ] as const;

  for (const { name, page, generateMetadata, unprefixed } of cases) {
    it(`${name}: renders inside localized shell chrome for non-default locales`, async () => {
      const tree = await page({ params: Promise.resolve({ locale: "de" }) });
      expect((tree.props as { locale?: unknown }).locale).toBe("de");
    });

    it(`${name}: redirects the English prefix to the unprefixed route`, async () => {
      const error: unknown = await page({ params: Promise.resolve({ locale: "en" }) }).then(
        () => null,
        (caught: unknown) => caught,
      );
      const digest = String((error as { digest?: unknown } | null)?.digest ?? error);
      expect(digest).toContain("NEXT_REDIRECT");
      expect(digest).toContain(unprefixed);
    });

    it(`${name}: notFound for unsupported locales`, async () => {
      await expect(page({ params: Promise.resolve({ locale: "unsupported" }) })).rejects.toThrow(
        /NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/,
      );
    });

    it(`${name}: generateMetadata returns {} for unsupported locales`, async () => {
      await expect(
        generateMetadata({ params: Promise.resolve({ locale: "unsupported" }) }),
      ).resolves.toEqual({});
    });
  }

  it("localizes metadata and stamps the og locale + shared card", async () => {
    const meta = await localeApiReferenceMetadata({
      params: Promise.resolve({ locale: "de" }),
    });
    expect(meta.title).toBe("API-Referenz");
    expect(meta.openGraph?.locale).toBe("de_DE");
    expect(meta.openGraph?.alternateLocale).toContain("en_US");
    expect(meta.openGraph?.images).toEqual([rootOgImage]);
  });
});
