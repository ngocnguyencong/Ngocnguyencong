import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const adminDir = dirname(fileURLToPath(import.meta.url));

/** Every `page.tsx` under `app/admin`, recursively. */
function collectAdminPages(dir: string = adminDir): string[] {
  const pages: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      pages.push(...collectAdminPages(full));
    } else if (entry.isFile() && entry.name === "page.tsx") {
      pages.push(full);
    }
  }
  return pages;
}

/** An `/admin…` href is valid only when a matching `page.tsx` route exists. */
function adminRouteExists(href: string): boolean {
  const pathname = (href.split(/[?#]/)[0] ?? "").replace(/\/+$/, "");
  const segments = pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);
  return existsSync(join(adminDir, ...segments, "page.tsx"));
}

describe("platform admin pages", () => {
  const pageFiles = collectAdminPages();

  it("finds the admin page sources", () => {
    expect(pageFiles.length).toBeGreaterThan(1);
  });

  it("links only to /admin routes that exist", () => {
    const deadLinks: string[] = [];
    for (const file of pageFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/href="(\/admin[^"]*)"/g)) {
        const href = match[1] ?? "";
        if (!adminRouteExists(href)) {
          deadLinks.push(`${relative(adminDir, file)} -> ${href}`);
        }
      }
    }
    expect(deadLinks, deadLinks.join("\n")).toEqual([]);
  });
});
