import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { marketingStaticPaths } from "./marketing-sitemap";

const APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Every publicly indexable route must render per request. Static prerendering
// evaluates metadata (metadataBase → canonical, og:image, twitter:image,
// hreflang) while `next build` runs without APP_URL, so absolute URLs bake to
// http://localhost:3000 in every deployment and crawlers can never resolve
// them. `force-dynamic` resolves siteOrigin() at request time instead.

/** Routes whose page file doesn't follow the `app<route>/page.tsx` shape. */
const ROUTE_TO_FILE: Record<string, string> = {
  "/docs": "app/docs/[[...slug]]/page.tsx",
};

function pageFileFor(route: string): string {
  return ROUTE_TO_FILE[route] ?? `app${route === "/" ? "" : route}/page.tsx`;
}

describe("public marketing routes", () => {
  for (const route of marketingStaticPaths) {
    it(`${route} renders dynamically so absolute URLs resolve the runtime APP_URL`, () => {
      const file = path.join(APP_ROOT, pageFileFor(route));
      expect(existsSync(file), `missing page file for ${route}`).toBe(true);
      expect(readFileSync(file, "utf8")).toContain('export const dynamic = "force-dynamic"');
    });
  }

  it("parameterized public pages render dynamically too", () => {
    // /blog/[slug] posts and /docs/{guide} pages are sitemap members built on
    // top of the static paths — same runtime-origin requirement.
    for (const file of ["app/blog/[slug]/page.tsx", "app/docs/[[...slug]]/page.tsx"]) {
      const source = readFileSync(path.join(APP_ROOT, file), "utf8");
      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("metadata routes emitting absolute URLs render dynamically too", () => {
    // robots.ts/sitemap.ts/llms.txt embed siteOrigin() in every emitted URL; a
    // static build stamps localhost:3000 (or the deploy-time placeholder
    // origin) into robots.txt + sitemap.xml + llms.txt for every crawler.
    for (const file of ["app/robots.ts", "app/sitemap.ts", "app/llms.txt/route.ts"]) {
      const source = readFileSync(path.join(APP_ROOT, file), "utf8");
      expect(source).toContain('export const dynamic = "force-dynamic"');
    }
  });
});
