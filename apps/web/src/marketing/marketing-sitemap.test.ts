import { describe, expect, it } from "vitest";
import { buildMarketingSitemapEntries, buildMarketingSitemapPaths } from "./marketing-sitemap";

describe("buildMarketingSitemapPaths", () => {
  it("includes the new controlled app block guides in every locale", () => {
    const paths = buildMarketingSitemapPaths();
    for (const prefix of ["", "/de", "/es", "/fr"]) {
      for (const block of ["master-detail", "table-toolbar", "pagination"])
        expect(paths).toContain(`${prefix}/docs/components/${block}`);
    }
  });
  it("includes the published adoption and upgrade guides", () => {
    const paths = buildMarketingSitemapPaths();
    expect(paths).toContain("/docs/web/adopt-patterns");
    expect(paths).toContain("/docs/web/upgrading");
  });
  it("includes the same complete guide catalog in all supported locales", () => {
    const paths = buildMarketingSitemapPaths();
    for (const prefix of ["", "/de", "/es", "/fr"]) {
      expect(paths).toContain(`${prefix}/docs`);
      expect(paths).toContain(`${prefix}/docs/web/local-setup`);
      expect(paths).toContain(`${prefix}/docs/reference/guides`);
      expect(paths).toContain(`${prefix}/docs/desktop`);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("includes Wave 1 marketing routes and reading surfaces", () => {
    const paths = buildMarketingSitemapPaths({
      posts: [{ slug: "a-foundation-for-your-next-product" }],
      guides: [{ slug: "web/local-setup" }],
    });
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/faq",
        "/blog",
        "/docs",
        "/contact",
        "/privacy",
        "/terms",
        "/legal/acceptable-use",
        "/legal/disclaimer",
        "/legal/license",
        "/showcase",
        "/changelog",
        "/roadmap",
        "/api-reference",
        "/blog/a-foundation-for-your-next-product",
        "/docs/web/local-setup",
      ]),
    );
  });

  it("omits private application and design-lab routes", () => {
    const blob = buildMarketingSitemapPaths({ posts: [], guides: [] }).join(" ");
    expect(blob).not.toMatch(/design-lab|\/auth|\/dashboard|\/billing|\/settings|\/api\//);
  });
});

describe("buildMarketingSitemapEntries", () => {
  it("ranks the homepage highest and keeps legal pages lowest", () => {
    const entries = buildMarketingSitemapEntries({ posts: [], guides: [] });
    const byPath = new Map(entries.map((entry) => [entry.path, entry]));
    expect(byPath.get("/")?.priority).toBe(1);
    expect(byPath.get("/docs")?.priority).toBeGreaterThan(byPath.get("/privacy")?.priority ?? 1);
    expect(byPath.get("/terms")?.priority).toBeLessThanOrEqual(0.3);
    expect(entries.every((entry) => entry.priority > 0 && entry.priority <= 1)).toBe(true);
  });

  it("carries post dates into lastModified and marks legal pages yearly", () => {
    const entries = buildMarketingSitemapEntries({
      posts: [{ slug: "workspace-boundaries", date: "2026-09-10" }],
      guides: [],
    });
    const post = entries.find((entry) => entry.path === "/blog/workspace-boundaries");
    const privacy = entries.find((entry) => entry.path === "/privacy");
    const license = entries.find((entry) => entry.path === "/legal/license");
    expect(post?.lastModified).toBe("2026-09-10");
    expect(post?.changeFrequency).toBe("monthly");
    expect(privacy?.changeFrequency).toBe("yearly");
    expect(license?.changeFrequency).toBe("yearly");
    expect(license?.priority).toBeLessThanOrEqual(0.3);
  });
});
