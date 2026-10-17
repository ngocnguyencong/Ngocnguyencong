import { expect, test } from "@playwright/test";

test("application inherits homepage identity and remains usable on narrow screens", async ({
  page,
}) => {
  await page.goto("/");
  const homepageFont = await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily);
  await page.goto("/ai");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.locator(".token-root")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("h1")).toHaveCSS("font-family", homepageFont);
  const brand = page.getByRole("link", { name: "supastack home", exact: true });
  await expect(brand.locator("svg, img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start local reference flow" })).toHaveCSS(
    "background-color",
    "rgb(239, 183, 121)",
  );
  await page.getByRole("button", { name: "Start local reference flow" }).click();
  await expect(
    page.getByRole("heading", { name: "Your local path is ready to trace.", exact: true }),
  ).toBeVisible();
  await expect(brand.locator("svg, img")).toHaveCount(0);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(page.getByRole("button", { name: "Create AI task", exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Create AI task", exact: true }).click();
  await expect(page.getByLabel("Task prompt")).toHaveCSS("font-size", "16px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".token-root")
      .evaluate(
        (el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
});

test("auth uses homepage chrome and fonts", async ({ page }) => {
  await page.goto("/");
  const homepageFont = await page
    .locator("h1")
    .evaluate((el) => getComputedStyle(el).fontFamily);
  await page.goto("/auth");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "supastack home", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" }).first()).toBeVisible();
  const signInHeading = page.getByRole("heading", { name: "Sign in to your workspace." });
  // Session restore can briefly park on "Restoring your secure session…" under parallel load.
  await expect(signInHeading).toBeVisible({ timeout: 15000 });
  await expect(signInHeading).toHaveCSS("font-family", homepageFont);
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("settings offers premade kit theme packs for app surfaces", async ({ page }) => {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("radio", { name: "Paper", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("radio", { name: "Glacier", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kit UI gallery" })).toBeVisible();
  await expect(page.locator('[data-gallery-section="buttons"]')).toBeVisible();
  await expect(page.locator('[data-gallery-section="inputs"]')).toBeVisible();
  await expect(page.locator('[data-gallery-section="cards"]')).toBeVisible();
  await expect(page.locator('[data-gallery-section="badges"]')).toBeVisible();
  await expect(page.locator('[data-gallery-section="dialogs"]')).toBeVisible();
  await page.getByRole("radio", { name: "Paper", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await expect(page.locator(".app-theme").first()).toHaveCSS(
    "background-color",
    "rgb(244, 239, 230)",
  );
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(244, 239, 230)");
  await expect(page.getByRole("button", { name: "Primary action" })).toHaveCSS(
    "background-color",
    "rgb(196, 92, 38)",
  );
  await page.getByRole("radio", { name: "Obsidian", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "obsidian");
  await expect(page.locator(".app-theme").first()).toHaveCSS("background-color", "rgb(0, 0, 0)");
});

test("marketing homepage inherits the selected product pack", async ({ page }) => {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("radio", { name: "Paper", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("radio", { name: "Paper", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "paper");
  await page.goto("/");
  await expect(page.locator(".marketing-theme").first()).toHaveCSS(
    "background-color",
    "rgb(244, 239, 230)",
  );
  const accent = await page
    .locator(".marketing-theme")
    .first()
    .evaluate((el) => getComputedStyle(el).getPropertyValue("--accent").trim().toLowerCase());
  expect(accent).toBe("#c45c26");
});

test("settings offers density, radius, and font presets", async ({ page }) => {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("radio", { name: "Compact", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.getByRole("radio", { name: "Sharp", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-radius", "sharp");
  await page.getByRole("radio", { name: "Geometric", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-font", "geometric");
  await page.getByRole("radio", { name: "Comfortable", exact: true }).check();
  await page
    .getByRole("radiogroup", { name: "Corner radius" })
    .getByRole("radio", { name: "Soft", exact: true })
    .check();
  await page.getByRole("radio", { name: "Editorial", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
  await expect(page.locator("html")).toHaveAttribute("data-radius", "soft");
  await expect(page.locator("html")).toHaveAttribute("data-font", "editorial");
});

test("narrow shell exposes Appearance and keeps ThemePicker usable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/ai");
  // Local AI console starts on AuthScreen; mobile shell actions live on the post-auth chrome.
  await page.getByRole("button", { name: "Start local reference flow" }).click();
  await expect(
    page.getByRole("heading", { name: "Your local path is ready to trace.", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".mobile-shell-appearance")).toBeVisible();
  await expect(page.locator(".mobile-shell-settings")).toBeVisible();
  await page.locator(".mobile-shell-appearance").click();
  await expect(page).toHaveURL(/\/settings\/appearance/);
  await expect(
    page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", {
      name: "Appearance",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Paper", exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Kit UI gallery" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  // ThemePicker radios are controlled inputs — a click that lands before
  // hydration finishes is silently reconciled back, so retry the whole
  // interaction + outcome via public API instead of probing React internals.
  await expect(async () => {
    await page.getByRole("radio", { name: "Paper", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "paper", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
});
