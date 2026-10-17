import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
}

test("auth choose screen only shows the method chooser", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Email me a code/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Email me a link/ })).toBeVisible();
  // No signup exists, so no password path is offered.
  await expect(page.getByRole("button", { name: /password/i })).toHaveCount(0);
  await expect(page.locator("#auth-email")).toHaveCount(0);
  await expect(page.locator("#auth-password")).toHaveCount(0);

  await page.getByRole("button", { name: /Email me a link/ }).click();
  await expect(page.getByRole("heading", { name: /sign-in link|email me a link/i })).toBeVisible();
  await expect(page.locator("#auth-email")).toBeVisible();
  await expect(page.getByRole("button", { name: /Email me a link/ })).toBeVisible();
  await page.getByRole("button", { name: "Choose another method" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace." })).toBeVisible();

  await page.getByRole("button", { name: /Email me a code/ }).click();
  await expect(page.getByRole("heading", { name: "Email me a code." })).toBeVisible();
  await expect(page.locator("#auth-email")).toBeVisible();
  await page.getByRole("button", { name: "Choose another method" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace." })).toBeVisible();
});

test("auth and AI task reference gate stay within viewport widths", async ({ page }) => {
  for (const path of ["/auth", "/ai"] as const) {
    await page.goto(path);
    if (path === "/ai") {
      await expect(page.getByLabel("Your name")).toBeVisible();
      await expect(page.locator(".auth-card")).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Sign in to your workspace." })).toBeVisible();
    }
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await noHorizontalOverflow(page)).toBe(true);
      if (path === "/ai") {
        const card = page.locator(".auth-card");
        const box = await card.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      }
    }
  }
});

test("theme picker updates html data-theme and CSS variables", async ({ page }) => {
  await page.goto("/settings/appearance");
  const before = await page
    .locator("html")
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim());
  await page.getByRole("radio", { name: "Paper", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  const paper = await page.locator("html").evaluate((el) => ({
    accent: getComputedStyle(el).getPropertyValue("--accent").trim(),
    page: getComputedStyle(el).getPropertyValue("--page").trim(),
  }));
  expect(paper.accent.toLowerCase()).toBe("#c45c26");
  expect(paper.page.toLowerCase()).toBe("#f4efe6");
  expect(paper.accent).not.toBe(before);

  await page.getByRole("radio", { name: "Obsidian", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "obsidian");
  const obsidian = await page.locator("html").evaluate((el) => ({
    accent: getComputedStyle(el).getPropertyValue("--accent").trim(),
    page: getComputedStyle(el).getPropertyValue("--page").trim(),
  }));
  expect(obsidian.accent.toLowerCase()).toBe("#efb779");
  expect(obsidian.page.toLowerCase()).toBe("#000000");

  await page.goto("/auth");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "obsidian");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});
