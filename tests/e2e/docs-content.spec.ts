import { expect, test } from "@playwright/test";

test("first-run steps show executable commands and beginner preparation links", async ({
  page,
}) => {
  for (const [surface, command, environment] of [
    ["web", "corepack pnpm --filter @supastack/web dev", "apps/web/.env.local"],
    ["mobile", "corepack pnpm --filter @supastack/mobile start", "apps/mobile/.env.local"],
    ["desktop", "corepack pnpm --filter @supastack/desktop dev", "SUPASTACK_APP_URL"],
  ]) {
    await page.goto(`/docs/${surface}/local-setup`);
    const article = page.locator("main article");
    await expect(article.locator("pre").filter({ hasText: command }).first()).toBeVisible();
    await expect(article).toContainText(environment!);
    await expect(article.locator("a[href='/docs/web/before-you-start']")).toBeVisible();
    await expect(article.locator("a[href='/docs/web/terminal-basics']")).toBeVisible();
  }
  await page.goto("/docs/web/before-you-start");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Before you start");
  await expect(page.locator("main article")).toContainText("git clone YOUR_COPIED_HTTPS_ADDRESS");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/docs\/web\/before-you-start$/,
  );
});

test("database setup separates payments from deeper database navigation", async ({ page }) => {
  await page.goto("/docs/web/database");
  const flow = page.locator("article [data-setup-flow]");
  await expect(flow.getByRole("link")).toHaveAttribute(
    "href",
    "/docs/modules/billing-configuration",
  );
  await expect(
    page.getByRole("navigation", { name: "Adjacent guides" }).getByRole("link").last(),
  ).toHaveAttribute("href", "/docs/deploy/supabase-cloud");
  await flow.getByRole("link").click();
  await expect(page).toHaveURL(/\/docs\/modules\/billing-configuration$/);
});

test("web, Expo and desktop each put five-minute setup first", async ({ page }) => {
  for (const surface of ["web", "mobile", "desktop"]) {
    await page.goto(`/docs/${surface}/local-setup`);
    const firstGuide = page.locator("aside nav[class*='navTree'] [class*='navItems'] a").first();
    await expect(firstGuide).toHaveAttribute("href", `/docs/${surface}/local-setup`);
    await expect(firstGuide.locator("svg.lucide-zap")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("5 minutes");
  }
});

test("five-minute local setup leads to the correct database step", async ({ page }) => {
  await page.goto("/docs/web/local-setup");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up in 5 minutes");
  await expect(page.locator("main")).toContainText("corepack pnpm dev");
  const next = page.locator("article [data-setup-flow]").getByRole("link");
  await expect(next).toHaveAttribute("href", "/docs/web/database");
  await expect(
    page.getByRole("navigation", { name: "Adjacent guides" }).getByRole("link", { name: /Next/ }),
  ).toHaveAttribute("href", "/docs/web/project-structure");
  await next.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Database and migrations");
});

test("complete docs index links providers, components and desktop", async ({ page }) => {
  await page.goto("/docs/reference/guides");
  const content = page.locator("main article");
  for (const slug of [
    "providers/stripe",
    "components/hero-centered",
    "desktop",
    "reference/environment",
  ]) {
    await expect(content.locator(`a[href='/docs/${slug}']`)).toBeVisible();
  }
});

for (const [locale, title, action, searchLabel, searchButton, searchTitle] of [
  [
    "de",
    "Einrichtung in 5 Minuten",
    "Weiter",
    "Dokumentation durchsuchen",
    "Suchen",
    "Suchergebnisse",
  ],
  [
    "es",
    "Configuración en 5 minutos",
    "Siguiente",
    "Buscar en la documentación",
    "Buscar",
    "Resultados de búsqueda",
  ],
  [
    "fr",
    "Configuration en 5 minutes",
    "Suivant",
    "Rechercher dans la documentation",
    "Rechercher",
    "Résultats de recherche",
  ],
] as const) {
  test(`${locale} docs preserve language through setup and search`, async ({ page }) => {
    await page.goto(`/${locale}/docs/web/local-setup`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    const next = page.locator("article [data-setup-flow]").getByRole("link");
    await expect(next).toHaveAttribute("href", `/${locale}/docs/web/database`);
    await expect(
      page.locator("main article nav").getByRole("link", { name: new RegExp(action) }),
    ).toHaveAttribute("href", `/${locale}/docs/web/project-structure`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/${locale}/docs/web/local-setup$`),
    );
    await page.getByRole("searchbox", { name: searchLabel }).fill("SMTP_PORT");
    await page.getByRole("search").getByRole("button", { name: searchButton, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(searchTitle);
    await expect(
      page.locator(`main a[href='/${locale}/docs/reference/environment']`),
    ).toBeVisible();
  });
}

test("localized documentation is readable without JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/fr/docs/web/local-setup`);
  const next = page.locator("article [data-setup-flow]").getByRole("link");
  await expect(next).toHaveAttribute("href", "/fr/docs/web/database");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "test-results/platform-docs-mobile-fr.png", fullPage: true });
  await next.click();
  await expect(page).toHaveURL(/\/fr\/docs\/web\/database$/);
  await context.close();
});
