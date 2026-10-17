import { expect, test } from "@playwright/test";

test("legal, contact, showcase and crawler files are public", async ({ page }) => {
  await page.goto("/");
  const legal = page.getByRole("navigation", { name: "Legal" });
  await legal.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page.getByText(/audit entries are scoped by workspaceId/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "Terms" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paid plans" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "Acceptable use" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Acceptable use" })).toBeVisible();
  await expect(page.getByText(/Prohibited activity/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "Disclaimer" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Disclaimer" })).toBeVisible();
  await expect(page.getByText(/professional advice/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "License" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "License" })).toBeVisible();
  await expect(page.getByText(/non-exclusive, worldwide license/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "Showcase" })
    .click();
  await expect(page.getByText("No public customer list yet.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Legal" })
    .getByRole("link", { name: "Contact" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "This site would like to measure visits." }),
  ).toHaveCount(0);
});

test("contact form reports unconnected delivery without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/contact`);
  await page.getByLabel("Name").fill("Ada");
  await page.locator("#contact-email").fill("ada@example.com");
  await page.getByLabel("Message").fill("How do seats work?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Message delivery is not connected yet.",
  );
  await context.close();
});

test("sitemap and robots stay public and omit app routes", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("/privacy");
  expect(sitemapBody).toContain("/legal/acceptable-use");
  expect(sitemapBody).toContain("/legal/disclaimer");
  expect(sitemapBody).toContain("/legal/license");
  expect(sitemapBody).toContain("/showcase");
  expect(sitemapBody).not.toContain("/design-lab");
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const robotsBody = await robots.text();
  expect(robotsBody).toContain("sitemap.xml");
  expect(robotsBody).toContain("Disallow: /dashboard");
});

test("wave 1 routes stay usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const route of [
    "/privacy",
    "/terms",
    "/legal/license",
    "/legal/acceptable-use",
    "/legal/disclaimer",
    "/contact",
    "/showcase",
  ]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  }
});
