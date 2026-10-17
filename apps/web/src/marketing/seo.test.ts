import { afterEach, describe, expect, it, vi } from "vitest";

import type { Guide, Post } from "../resources/content";
import {
  absoluteUrl,
  blogBreadcrumbJsonLd,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  docsBreadcrumbJsonLd,
  faqPageJsonLd,
  homeLanguageAlternates,
  jsonLdScript,
  ogLocaleFor,
  organizationJsonLd,
  siteOrigin,
  webSiteJsonLd,
} from "./seo";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

const post: Post = {
  slug: "workspace-boundaries",
  title: "Your workspace is a security boundary.",
  description: "Why ownership checks belong in every read and write.",
  category: "Engineering",
  date: "2026-09-10",
  guide: "modules/workspaces",
  art: "boundary",
  sections: [],
};

const guide: Guide = {
  slug: "web/local-setup",
  tab: "web",
  group: "Getting started",
  title: "Local setup",
  description: "Install the workspace and run the local reference flow.",
  sections: [],
};

describe("siteOrigin", () => {
  it("uses APP_URL when configured", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    expect(siteOrigin()).toBe("https://example.com");
  });

  it("falls back to localhost", () => {
    vi.stubEnv("APP_URL", "");
    expect(siteOrigin()).toBe("http://localhost:3000");
  });
});

describe("absoluteUrl", () => {
  it("joins paths against the site origin", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    expect(absoluteUrl("/blog")).toBe("https://example.com/blog");
    expect(absoluteUrl("blog")).toBe("https://example.com/blog");
    expect(absoluteUrl("/")).toBe("https://example.com/");
  });
});

describe("jsonLdScript", () => {
  it("serializes JSON-LD with script-breaking characters escaped", () => {
    const json = jsonLdScript({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c");
    expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});

describe("organizationJsonLd", () => {
  it("describes the demo without an invented logo", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const data = organizationJsonLd();
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("Organization");
    expect(data.name).toBe("supastack");
    expect(data.url).toBe("https://example.com");
    expect(data).not.toHaveProperty("logo");
  });
});

describe("webSiteJsonLd", () => {
  it("describes the site at the configured origin", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const data = webSiteJsonLd();
    expect(data["@type"]).toBe("WebSite");
    expect(data.url).toBe("https://example.com");
    expect(data.inLanguage).toEqual(expect.arrayContaining(["en", "de", "es", "fr"]));
  });
});

describe("faqPageJsonLd", () => {
  it("maps FAQ items to Question/Answer entities", () => {
    const data = faqPageJsonLd([
      { question: "What is supastack?", answer: "A modular foundation." },
    ]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toEqual([
      {
        "@type": "Question",
        name: "What is supastack?",
        acceptedAnswer: { "@type": "Answer", text: "A modular foundation." },
      },
    ]);
  });
});

describe("blogPostingJsonLd", () => {
  it("describes an article with publisher and canonical page URL", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const data = blogPostingJsonLd(post);
    expect(data["@type"]).toBe("BlogPosting");
    expect(data.headline).toBe(post.title);
    expect(data.datePublished).toBe("2026-09-10");
    expect(data.mainEntityOfPage).toBe("https://example.com/blog/workspace-boundaries");
    expect(data.author).toMatchObject({ "@type": "Organization", name: "supastack" });
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers positions and resolves item URLs", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const data = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog" },
    ]);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://example.com/" },
      { "@type": "ListItem", position: 2, name: "Blog", item: "https://example.com/blog" },
    ]);
  });

  it("builds the docs trail Home > Docs > tab > guide", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const items = docsBreadcrumbJsonLd(guide).itemListElement as { name: string; item: string }[];
    expect(items.map((item) => item.name)).toEqual(["Home", "Docs", "Web", "Local setup"]);
    expect(items.at(-1)?.item).toBe("https://example.com/docs/web/local-setup");
  });

  it("keeps a localized docs breadcrumb in the same language", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const localizedGuide = { ...guide, tab: "mobile" as const, title: "Configuration mobile" };
    const items = docsBreadcrumbJsonLd(localizedGuide, "fr").itemListElement as {
      name: string;
      item: string;
    }[];
    expect(items.map((item) => item.name)).toEqual([
      "Accueil",
      "Documentation",
      "Mobile",
      "Configuration mobile",
    ]);
    expect(items.map((item) => item.item)).toEqual([
      "https://example.com/fr",
      "https://example.com/fr/docs",
      "https://example.com/fr/docs/mobile",
      "https://example.com/fr/docs/web/local-setup",
    ]);
  });

  it("builds the blog trail Home > Blog > post", () => {
    vi.stubEnv("APP_URL", "https://example.com");
    const items = blogBreadcrumbJsonLd(post).itemListElement as { name: string; item: string }[];
    expect(items.map((item) => item.name)).toEqual([
      "Home",
      "Blog",
      "Your workspace is a security boundary.",
    ]);
  });
});

describe("homeLanguageAlternates", () => {
  it("maps every supported locale plus x-default", () => {
    expect(homeLanguageAlternates()).toEqual({
      en: "/",
      de: "/de",
      es: "/es",
      fr: "/fr",
      "x-default": "/",
    });
  });
});

describe("ogLocaleFor", () => {
  it("maps app locales to Open Graph locales", () => {
    expect(ogLocaleFor("en")).toBe("en_US");
    expect(ogLocaleFor("de")).toBe("de_DE");
    expect(ogLocaleFor("fr")).toBe("fr_FR");
  });
});
