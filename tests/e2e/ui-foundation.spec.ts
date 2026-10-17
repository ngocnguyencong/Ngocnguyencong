import { expect, test } from "@playwright/test";

test("all packs keep rendered selected navigation text readable", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const packs = await page
    .locator('input[name="supastack-theme"]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value));
  expect(packs.length).toBeGreaterThanOrEqual(21);
  for (const pack of packs) {
    await page.evaluate((id) => {
      document.documentElement.dataset.theme = id;
    }, pack);
    const ratio = await page.locator(".nav-item-active").evaluate((node) => {
      const style = getComputedStyle(node);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data]
          .slice(0, 3)
          .map((channel) => channel / 255)
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      };
      const ink = luminance(style.color),
        fill = luminance(style.backgroundColor);
      return (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05);
    });
    expect(ratio, pack).toBeGreaterThanOrEqual(4.5);
  }
});

test("both galleries retain state previews and narrow master detail navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of ["/settings/appearance", "/kit-blocks"]) {
    await page.goto(path);
    const preview = page.getByRole("region", { name: "Foundation block preview", exact: true });
    await preview.locator("summary", { hasText: "Preview states" }).click();
    for (const [label, state] of [
      ["Loading", "loading"],
      ["Empty", "empty"],
      ["Error", "error"],
    ]) {
      await preview.getByRole("radio", { name: label, exact: true }).check();
      await expect(preview.locator(`[data-state="${state}"][role="status"]`)).toBeVisible();
    }
    await preview.getByRole("radio", { name: "Ready", exact: true }).check();
    await preview.getByRole("checkbox", { name: "Disable table controls" }).check();
    await expect(preview.getByRole("button", { name: "Add sample record" })).toBeDisabled();
    await preview.getByRole("checkbox", { name: "Disable table controls" }).uncheck();
    await preview.getByRole("tab", { name: "Master and detail", exact: true }).click();
    const record = preview.getByRole("button", { name: "Draft handoff Open", exact: true });
    await record.click();
    const back = preview.getByRole("button", { name: "Back to records", exact: true });
    await expect(back).toBeFocused();
    await expect(record).not.toBeVisible();
    await back.click();
    await expect(record).toBeFocused();
    const bounds = await preview.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  }
});

test("hover feedback is smooth and reduced motion preserves its final state", async ({ page }) => {
  await page.goto("/settings/appearance");
  const button = page.getByRole("button", { name: "Primary action", exact: true });
  await button.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const resting = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await button.evaluate((node) => getComputedStyle(node).transitionDuration)).toContain(
    "0.12s",
  );
  await button.hover();
  await expect
    .poll(() => button.evaluate((node) => getComputedStyle(node).backgroundColor))
    .not.toBe(resting);
  await expect
    .poll(() =>
      button.evaluate(
        (node) =>
          node.getAnimations().filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
  const hovered = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(button).toHaveCSS("transition-duration", "0s");
  await expect(button).toHaveCSS("background-color", hovered);
  await button.focus();
  await expect(button).toBeFocused();
  expect(await button.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
});

test("light and dark previews reflow at narrow widths and 200 percent CSS zoom", async ({
  page,
}, testInfo) => {
  await page.goto("/settings/appearance");
  for (const name of ["Obsidian Studio", "Ocean Workspace"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const style = page.getByRole("radio", { name, exact: true });
    await style.click();
    await expect(style).toBeChecked();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('[data-gallery-section="buttons"]').scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name.split(" ")[0].toLowerCase()}-${width}.png`),
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  const button = page.getByRole("button", { name: "Open sample dialog", exact: true });
  await button.focus();
  await button.press("Enter");
  await expect(page.getByRole("dialog", { name: "Sample dialog", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});

test("new component guides retain canonical metadata and sitemap coverage", async ({
  page,
  request,
}) => {
  for (const block of ["master-detail", "table-toolbar", "pagination"]) {
    const response = await page.goto(`/docs/components/${block}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toContain(
      `/docs/components/${block}`,
    );
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const block of ["master-detail", "table-toolbar", "pagination"])
    expect(xml).toContain(`/docs/components/${block}`);
});

test("docs search contains focus and restores its trigger", async ({ page }) => {
  await page.goto("/docs");
  const trigger = page.getByRole("button", { name: /^Search.*(Ctrl|⌘)/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search documentation" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("select enhances keyboard behavior and preserves submitted/reset values", async ({ page }) => {
  await page.goto("/settings/appearance");
  const field = page.locator('[data-gallery-section="inputs"]');
  const select = field.getByRole("combobox", { name: "Plan", exact: true });
  await select.focus();
  await select.press("End");
  await select.press("Enter");
  await expect(select).toContainText("Scale");
  expect(
    await field
      .locator("form")
      .evaluate((form) => new FormData(form as HTMLFormElement).get("kit-gallery-plan")),
  ).toBe("scale");
  await select.press("Home");
  await select.press("Escape");
  await expect(select).toContainText("Scale");
  await field.locator("form").evaluate((form) => (form as HTMLFormElement).reset());
  await expect(select).toContainText("Pro");
});

test("new bundles apply every axis and toasts inherit control corners", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, pack, layout] of [
    ["Ocean Workspace", "ocean", "collapsible"],
    ["Lavender Studio", "lavender", "topnav"],
    ["Cobalt Console", "cobalt", "collapsible"],
    ["Sand Editorial", "sand", "topnav"],
  ] as const) {
    await page.getByRole("radio", { name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", pack);
    await expect(page.locator("html")).toHaveAttribute("data-layout", layout);
  }
  await page.getByRole("radio", { name: "Sharp", exact: true }).check();
  await page.getByRole("button", { name: "Preview toast", exact: true }).click();
  await expect(page.locator("[data-toast-id]").last()).toHaveCSS("border-radius", "2px");
  await expect(page.locator('[data-gallery-section="buttons"] button').first()).toHaveCSS(
    "border-radius",
    "2px",
  );
});

test("all shell layouts retain compact mobile navigation and account access", async ({ page }) => {
  await page.goto("/settings/appearance");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const layout of ["Sidebar", "Top navigation", "Focused", "Collapsible sidebar"]) {
      await page.getByRole("radio", { name: layout, exact: true }).check();
      const opener = page.getByRole("button", { name: "Open navigation", exact: true });
      await expect(opener).toBeVisible();
      await opener.click();
      const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
      await expect(drawer.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
      await drawer.getByRole("button", { name: "Account menu", exact: true }).click();
      await expect(drawer.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await expect(opener).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
  }
});

test("collapsible sidebar persists and reduced motion keeps state visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/settings/appearance");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("radio", { name: "Collapsible sidebar", exact: true }).check();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.locator(".app-frame")).toHaveAttribute("data-sidebar-collapsed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open sample dialog", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sample dialog", exact: true });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
});

test("no JavaScript preserves navigation and public reading", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/settings/appearance`);
    await expect(
      page
        .getByRole("navigation", { name: "Workspace navigation" })
        .getByRole("link", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page.goto(`${baseURL}/`);
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});
