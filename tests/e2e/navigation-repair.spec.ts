import { expect, test } from "@playwright/test";

test("public navigation stays centered and uses color without active underlines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/docs");
  const nav = page.locator("header nav").first();
  const current = nav.locator('a[aria-current="page"]');
  await expect(current).toBeVisible();
  await expect(current).toHaveCSS("text-decoration-line", "none");
  await current.hover();
  await expect(current).toHaveCSS("text-decoration-line", "none");
  const centers = await nav.locator("a").evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect();
      return box.y + box.height / 2;
    }),
  );
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
  await page.screenshot({ path: "tmp/navigation-kit-desktop.png" });
  await nav.getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(page.locator('header nav a[aria-current="page"]').first()).toHaveCSS(
    "text-decoration-line",
    "none",
  );
});

test("compact public navigation keeps current links clickable without underlines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/docs");
  await page.locator('header button[aria-haspopup="dialog"]').click();
  const menu = page.locator("header dialog");
  await expect(menu.locator('a[aria-current="page"]')).toHaveCSS("text-decoration-line", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "tmp/navigation-kit-mobile.png" });
  await menu.getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page).toHaveURL(/\/blog$/);
});
