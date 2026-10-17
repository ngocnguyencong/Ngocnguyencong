import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

test("navbar opens blog, categories filter and articles link to documentation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Page sections" })
    .getByRole("link", { name: "Blog", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Blog");
  await page
    .getByRole("navigation", { name: "Article categories" })
    .getByRole("link", { name: "Engineering" })
    .click();
  await expect(page.locator("main article").first()).toBeVisible();
  await page
    .getByRole("link", { name: "Your workspace is a security boundary.", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your workspace is a security boundary.",
  );
  await page.getByRole("link", { name: "Explore the related documentation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Workspaces");
  await expect(
    page
      .getByRole("navigation", { name: "Page sections" })
      .getByRole("link", { name: "Pricing", exact: true }),
  ).toHaveAttribute("href", "/#pricing");
});

test("documentation tabs, search, empty state and adjacent pages work", async ({ page }) => {
  await page.goto("/docs");
  const tabs = page.getByRole("navigation", { name: "Documentation sections" });
  await tabs.getByRole("link", { name: "Mobile Expo" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mobile overview");
  const nextMobileGuide = page
    .getByRole("navigation", { name: "Adjacent guides" })
    .getByRole("link", { name: "Next Set up Expo in 5 minutes", exact: true });
  await expect(nextMobileGuide).toHaveAttribute("href", "/docs/mobile/local-setup");
  await nextMobileGuide.click();
  await expect(page).toHaveURL(/\/docs\/mobile\/local-setup$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up Expo in 5 minutes");
  await tabs.getByRole("link", { name: "Modules Shared foundation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Module overview");
  await page.getByRole("searchbox").fill("workspaceId");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search results");
  await expect(
    page.locator("main").getByRole("heading", { name: "Workspaces", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("no-matching-guide-xyz");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No matching guides" })).toBeVisible();
  await page.getByRole("link", { name: "Browse all documentation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction");
});

test("mobile menu and native documentation disclosure remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/blog");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction");
  await page.getByText("Browse documentation", { exact: true }).click();
  await page.locator("details").getByRole("link", { name: "Set up in 5 minutes" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up in 5 minutes");
  for (const route of [
    "/blog",
    "/blog/a-foundation-for-your-next-product",
    "/docs/web/local-setup",
  ]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test("reading, search and header navigation work without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 800 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/blog`);
  await page
    .locator("header")
    .getByRole("link", { name: "Docs", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Introduction");
  await page.getByRole("searchbox").fill("authentication");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Search results");
  await context.close();
});

test("unknown article and documentation URLs return 404", async ({ page }) => {
  for (const path of ["/blog/missing-article", "/docs/web/missing-guide"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});

test("filtered articles fill tablet width and website controls share one radius", async ({
  page,
}) => {
  await page.setViewportSize({ width: 738, height: 900 });
  await page.goto("/blog?category=Architecture");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Blog");
  const card = page.locator("main article").first();
  expect((await card.boundingBox())!.width).toBeGreaterThan(650);
  const filterRadius = await page
    .getByRole("navigation", { name: "Article categories" })
    .getByRole("link")
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  const menuRadius = await page
    .getByRole("button", { name: "Open menu" })
    .evaluate((el) => getComputedStyle(el).borderRadius);
  await page.goto("/docs");
  const searchRadius = await page
    .getByRole("search")
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(filterRadius).toBe("12px");
  expect(menuRadius).toBe(filterRadius);
  expect(searchRadius).toBe(filterRadius);
});

const paletteDialog = (page: Page) => page.getByRole("dialog", { name: "Search documentation" });
const paletteTrigger = (page: Page) => page.getByRole("button", { name: /Search (Ctrl K|⌘K)/ });

// Holds the client chunks so a summary click lands before hydration — the
// native <details> toggle mutates `open` outside React's knowledge. Hydration
// must then accept the user-mutated state without a mismatch warning.
// `**/*.js*` (not `**/*.js`) also catches query-suffixed dev chunk URLs —
// otherwise a slipped chunk could hydrate early, handle the click through
// DocsMotion, and the test would pass without covering the race.
async function clickSummaryBeforeHydration(page: Page, summary: Locator) {
  const held: Route[] = [];
  let holding = true;
  await page.route("**/*.js*", (route) => {
    if (holding) held.push(route);
    else void route.continue().catch(() => {});
  });
  try {
    await page.goto("/docs", { waitUntil: "commit" });
    await summary.waitFor({ state: "visible" });
    await summary.click();
    // Self-verify the click really landed pre-hydration: the palette only
    // opens through React's onClick and pre-hydration clicks are not
    // replayed, so a still-closed dialog proves hydration has not run.
    await paletteTrigger(page).click();
    await expect(paletteDialog(page)).not.toBeVisible({ timeout: 500 });
  } finally {
    holding = false;
    for (const route of held.splice(0)) void route.continue().catch(() => {});
    await page.unroute("**/*.js*");
  }
}

// Proves hydration finished: the palette only opens through React's onClick.
async function waitForHydration(page: Page) {
  const dialog = paletteDialog(page);
  const trigger = paletteTrigger(page);
  await expect(async () => {
    if (!(await dialog.isVisible().catch(() => false))) await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 30000 });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
}

test("mobile docs disclosure opened before hydration stays open without a mismatch", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") hydrationErrors.push(message.text());
  });
  page.on("pageerror", (error) => hydrationErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 800 });
  const summary = page.getByText("Browse documentation", { exact: true });
  const disclosure = page.locator("details[class*=mobileSidebar]");
  await clickSummaryBeforeHydration(page, summary);
  await waitForHydration(page);

  // The user's pre-hydration open state is preserved, not reverted.
  await expect(disclosure).toHaveAttribute("open", "");
  // And the delegated DocsMotion enhancer still controls it afterwards.
  await summary.click();
  await expect(disclosure).not.toHaveAttribute("open");
  expect(hydrationErrors.filter((text) => /hydrat|didn't match/i.test(text))).toEqual([]);
});

test("sidebar nav group closed before hydration stays closed without a mismatch", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") hydrationErrors.push(message.text());
  });
  page.on("pageerror", (error) => hydrationErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  const group = page.locator("aside details[class*=navGroup]").first();
  await clickSummaryBeforeHydration(page, group.locator("summary"));
  await waitForHydration(page);

  await expect(group).not.toHaveAttribute("open");
  await group.locator("summary").click();
  await expect(group).toHaveAttribute("open", "");
  expect(hydrationErrors.filter((text) => /hydrat|didn't match/i.test(text))).toEqual([]);
});

test("FAQ closes the previous answer when another opens", async ({ page }) => {
  await page.goto("/faq");
  const faq = page.locator("main details");
  await faq.nth(0).locator("summary").click();
  await expect(faq.nth(0)).toHaveAttribute("open", "");
  await faq.nth(1).locator("summary").click();
  await expect(faq.nth(0)).not.toHaveAttribute("open");
  await expect(faq.nth(1)).toHaveAttribute("open", "");
});
