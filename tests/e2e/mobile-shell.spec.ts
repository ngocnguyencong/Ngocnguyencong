import { expect, test } from "@playwright/test";

test("mobile workspace drawer keeps navigation and account actions reachable", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") throw new Error(`Unexpected write: ${path}`);
    if (path === "/api/auth/get-session") {
      await route.fulfill({
        json: {
          session: {
            id: "fixture",
            userId: "fixture",
            token: "fixture",
            expiresAt: "2099-01-01T00:00:00Z",
          },
          user: {
            id: "fixture",
            email: "demo@example.test",
            name: "Example account with a longer display name",
            emailVerified: true,
          },
        },
      });
    } else if (path === "/api/workspaces") {
      await route.fulfill({
        json: {
          activeWorkspaceId: "fixture",
          memberships: [
            {
              role: "owner",
              workspaceId: "fixture",
              workspaceLogo: null,
              workspaceName: "Example workspace",
              workspaceType: "personal",
            },
          ],
        },
      });
    } else {
      await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 740 },
    { width: 760, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/settings/general");
    const opener = page.getByRole("button", { name: "Open navigation", exact: true });
    await expect(opener).toBeVisible();
    for (const layout of ["sidebar", "topnav", "focused", "collapsible"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.layout = value;
      }, layout);
      await opener.click();
      const drawer = page.locator("dialog.shell-navigation-drawer");
      await expect(drawer).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
      await drawer
        .getByRole("link", { name: "Notifications", exact: true })
        .scrollIntoViewIfNeeded();
      await expect(
        drawer.getByRole("link", { name: "Notifications", exact: true }),
      ).toBeInViewport();
      const account = drawer.getByRole("button", { name: /Account menu/ });
      await account.click();
      const signOut = drawer.getByRole("button", { name: "Sign out", exact: true });
      await signOut.scrollIntoViewIfNeeded();
      await expect(signOut).toBeInViewport();
      expect(await drawer.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await signOut.focus();
      await page.keyboard.press("Escape");
      await expect(account).toBeFocused();
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      document.documentElement.dataset.layout = "sidebar";
    });
    await opener.click();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator("aside.workspace-rail")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    await page.setViewportSize(viewport);
    await expect(page.locator("dialog.shell-navigation-drawer")).not.toBeVisible();
  }
});

test("workspace navigation remains available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 568 },
  });
  try {
    const page = await context.newPage();
    await page.goto("/settings/general");
    await expect(page.locator('.primary-navigation a[href="/dashboard"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});
