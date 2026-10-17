import { chromium } from "@playwright/test";
import type { FullConfig } from "@playwright/test";

// `next dev` compiles every route (and the auth API) on its first hit — and the
// client JS chunks again on the first real browser load. Under `fullyParallel`,
// eleven workers paying that compile cost at once pushed cold-cache runs past
// the default expect timeouts — most visibly the "Restoring your secure
// session…" gate on /auth and the "Restoring the current local reference
// session…" gate on /ai. Playwright starts config.webServer before
// global setup, so drive a real browser through every route family the suite
// touches, sequentially: each load compiles the route, its chunks, and its
// first-hit API calls for every later test. Dynamic routes only need one
// representative path — `/docs/[[...slug]]`, `/blog/[slug]` and
// `/api/local-reference/[action]` compile once for all of their pages/actions.
// Every distinct page module the suite navigates to — cold misses here are
// the historical source of CI e2e flakes (e.g. /legal/license clicking timed
// out because no test order guaranteed a compile before the 60s test cap).
const WARM_PATHS = [
  "/",
  "/auth",
  "/api/auth/get-session",
  "/settings",
  "/settings/appearance",
  "/docs",
  "/dashboard",
  "/ai",
  "/api/local-reference/hydrate",
  "/blog",
  "/blog/a-foundation-for-your-next-product",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/legal/license",
  "/legal/acceptable-use",
  "/legal/disclaimer",
  "/showcase",
  "/sitemap.xml",
  "/robots.txt",
];

/** Docs slugs share a catch-all module; keep each locale and all other paths. */
export function selectWarmPaths(paths: readonly string[], alreadyWarmed: readonly string[] = []) {
  const family = (path: string) =>
    /^(\/(?:[a-z]{2}(?:-[a-zA-Z]{2})?\/)?docs)(?:\/|$)/.exec(path)?.[1] ?? path;
  const seen = new Set(alreadyWarmed.map(family));
  return paths.filter((path) => {
    const key = family(path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Discover public routes from the sitemap so new page modules stay covered. */
async function listSitemapPaths(baseURL: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseURL}/sitemap.xml`, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const paths = new Set<string>();
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      try {
        const { pathname } = new URL(match[1]!);
        if (pathname && pathname !== "/sitemap.xml") paths.add(pathname);
      } catch {
        // skip malformed entries
      }
    }
    return [...paths];
  } catch {
    return [];
  }
}

/** Drives a real browser through `paths` so `next dev` compiles each route
 * (plus its client chunks and post-load API calls) before tests start. With
 * `sitemap: true` (default) it also warms every page module the app's sitemap
 * advertises, sharing one warm-up per documentation catch-all/locale so hundreds
 * of guide URLs do not exhaust the dev server's heap before tests begin. */
export async function warmRoutes(
  config: FullConfig,
  paths: readonly string[],
  { sitemap = true }: { sitemap?: boolean } = {},
) {
  const project = config.projects[0];
  const baseURL =
    project?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    `http://localhost:${process.env.PLAYWRIGHT_PORT ?? "3100"}`;
  const channel = typeof project?.use?.channel === "string" ? project.use.channel : undefined;
  const browser = await chromium.launch(channel ? { channel } : {});
  try {
    const page = await browser.newPage({ baseURL });
    const warm = async (path: string) => {
      if (path.startsWith("/api/")) {
        await page.request.get(path, { timeout: 120_000 });
        return;
      }
      await page.goto(path, { timeout: 120_000 });
      // Let post-load fetches (session restore, hydration) finish so the API
      // routes they hit are compiled too before the parallel run starts.
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    };
    for (const path of paths) {
      await warm(path);
    }
    // /sitemap.xml was warmed above; now it serves instantly and hands us the
    // public route list. Documentation slugs share a page module; every static
    // or unrecognized path still gets its own warm-up.
    if (sitemap) {
      for (const path of selectWarmPaths(await listSitemapPaths(baseURL), paths)) {
        await warm(path);
      }
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  await warmRoutes(config, WARM_PATHS);
}
