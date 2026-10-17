import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { pageSocialMetadata, rootOgImage } from "./seo";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Next.js merges metadata per top-level key: a segment that defines
 * `openGraph` or `twitter` REPLACES the layout's whole object — dropping
 * siteName/type/locale and any inherited card images. Compose through
 * `pageSocialMetadata` instead; this file pins both halves of the contract.
 */
describe("pageSocialMetadata", () => {
  it("keeps the shared site fields + card on page overrides", () => {
    const meta = pageSocialMetadata({
      siteName: "acme",
      title: "Post",
      description: "Desc",
      url: "/blog/post",
      locale: "de",
    });
    expect(meta.openGraph).toMatchObject({
      siteName: "acme",
      type: "website",
      title: "Post",
      description: "Desc",
      url: "/blog/post",
      locale: "de_DE",
    });
    expect(meta.openGraph?.alternateLocale).toContain("en_US");
    expect(meta.openGraph?.alternateLocale).not.toContain("de_DE");
    // The article segment owns a generated card and supplies its own image.
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Post",
      description: "Desc",
    });
  });

  it("passes explicit images through for segments without a convention file", () => {
    // Segments like [locale] own no opengraph-image file — a page-level
    // openGraph without `images` replaces the layout's and emits no card.
    const meta = pageSocialMetadata({
      siteName: "acme",
      title: "Home",
      description: "Desc",
      images: [rootOgImage],
    });
    expect(meta.openGraph?.images).toEqual([rootOgImage]);
    expect(rootOgImage).toMatchObject({ url: "/demo-social.png", width: 1200, height: 630 });
    expect(meta.twitter?.images).toEqual([rootOgImage]);
  });

  it("points the shared card at a real public PNG with matching dimensions", () => {
    const imagePath = path.join(APP_ROOT, "public", rootOgImage.url.slice(1));
    expect(rootOgImage.url).toMatch(/^\/[^?#]+\.png$/);
    expect(existsSync(imagePath), `expected ${imagePath} to exist`).toBe(true);
    const header = readFileSync(imagePath).subarray(0, 24);
    expect(header.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(header.readUInt32BE(16)).toBe(rootOgImage.width);
    expect(header.readUInt32BE(20)).toBe(rootOgImage.height);
    expect(rootOgImage.alt.length).toBeGreaterThan(0);
  });

  it("uses the shared card on the home page and keeps the article card generated", () => {
    const home = readFileSync(path.join(APP_ROOT, "app", "page.tsx"), "utf8");
    const layout = readFileSync(path.join(APP_ROOT, "app", "layout.tsx"), "utf8");
    expect(home).toContain("images: [rootOgImage]");
    expect(layout).toContain("images: [rootOgImage]");
    expect(existsSync(path.join(APP_ROOT, "app", "opengraph-image.tsx"))).toBe(false);
    expect(existsSync(path.join(APP_ROOT, "app", "blog", "[slug]", "opengraph-image.tsx"))).toBe(
      true,
    );
  });

  it("emits the article shape only for type:article", () => {
    const article = pageSocialMetadata({
      siteName: "acme",
      title: "Post",
      description: "Desc",
      type: "article",
      publishedTime: "2026-09-24",
    });
    expect(article.openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-09-24",
    });
    const page = pageSocialMetadata({ siteName: "acme", title: "P", description: "D" });
    expect(page.openGraph).not.toHaveProperty("publishedTime");
  });

  it("[locale]/page.tsx passes rootOgImage — its segment owns no convention file", () => {
    // Removing the images arg silently reintroduces the live bug: /de, /fr,
    // /es emitted no og:image because their page-level openGraph replaced the
    // layout's and no opengraph-image file exists under app/[locale]/.
    const source = readFileSync(path.join(APP_ROOT, "app", "[locale]", "page.tsx"), "utf8");
    expect(source).toContain("images: [rootOgImage]");
  });

  it("no app segment may write a bare openGraph/twitter object", () => {
    // Outside the root layout (which owns the shared base), `openGraph: {…}`
    // or `twitter: {…}` literals wipe the inherited fields — pages must
    // spread pageSocialMetadata() instead.
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/^(page|layout)\.tsx$/.test(entry.name)) continue;
        const rel = path.relative(APP_ROOT, full).split(path.sep).join("/");
        if (rel === "app/layout.tsx") continue; // root layout owns the base
        const source = readFileSync(full, "utf8");
        if (/\b(openGraph|twitter)\s*:\s*\{/.test(source)) {
          offenders.push(rel);
        }
      }
    };
    walk(path.join(APP_ROOT, "app"));
    expect(offenders).toEqual([]);
  });
});
