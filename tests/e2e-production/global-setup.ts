import type { FullConfig } from "@playwright/test";

import { warmRoutes } from "../e2e/global-setup";

// The production suite also runs `next dev` (local-reference APIs are
// dev-only), so its routes compile on first hit inside each test's own
// timeout — CI runners under load failed settings.spec.ts 6/6 that way.
// Warm the only page families the suite touches: the reference app shell
// (`/` and `/ai`) and `/settings` (redirects through `settings/page`
// to `settings/[section]` = "general"). All `/api/**` calls are intercepted
// by the specs' route fixtures and never reach the dev server, and no public
// route is navigated — so sitemap expansion is skipped.
const WARM_PATHS = ["/", "/ai", "/settings"];

export default async function globalSetup(config: FullConfig) {
  await warmRoutes(config, WARM_PATHS, { sitemap: false });
}
