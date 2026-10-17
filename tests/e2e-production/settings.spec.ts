import { expect, test, type Page } from "@playwright/test";

import { fulfillInertShellRead } from "./shell-api";

async function fixture(
  page: Page,
  options: {
    signedOut?: boolean;
    sessionError?: boolean;
    saveError?: boolean;
    sessionGate?: Promise<void>;
    saveGate?: Promise<void>;
  } = {},
) {
  let signedOut = options.signedOut ?? false;
  let name = "Original Name";
  const updates: unknown[] = [];
  const unexpected: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/get-session" && request.method() === "GET") {
      await options.sessionGate;
      if (options.sessionError) {
        await route.fulfill({ status: 500, json: { message: "private-session-detail" } });
      } else {
        await route.fulfill({
          json: signedOut
            ? null
            : {
                session: {
                  id: "session_test",
                  userId: "user_test",
                  token: "fixture",
                  expiresAt: "2099-01-01T00:00:00.000Z",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
                user: {
                  id: "user_test",
                  email: "test@example.test",
                  name,
                  emailVerified: true,
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              },
        });
      }
      return;
    }
    if (path === "/api/auth/update-user" && request.method() === "POST") {
      const input = request.postDataJSON() as { name: string };
      updates.push(input);
      await options.saveGate;
      if (options.saveError) {
        await route.fulfill({ status: 400, json: { message: "private-save-detail" } });
      } else {
        name = input.name;
        await route.fulfill({ json: { status: true } });
      }
      return;
    }
    if (path === "/api/auth/sign-out" && request.method() === "POST") {
      signedOut = true;
      await route.fulfill({ json: { success: true } });
      return;
    }
    if (await fulfillInertShellRead(route)) {
      return;
    }
    unexpected.push(`${request.method()} ${path}`);
    await route.abort("blockedbyclient");
  });
  return { updates, unexpected };
}

test("settings saves only name, restores after reload and signs out", async ({ page }) => {
  const state = await fixture(page);
  await page.goto("/settings");
  await expect(page.getByLabel("Display name")).toHaveValue("Original Name");
  await page.getByLabel("Display name").fill("  Updated Name  ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Profile saved.");
  expect(state.updates).toEqual([{ name: "Updated Name" }]);
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Updated Name");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test("session loading never exposes the profile form", async ({ page }) => {
  const held = gate();
  const state = await fixture(page, { sessionGate: held.promise });
  try {
    await page.goto("/settings");
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Restoring your session…");
    await expect(page.getByLabel("Display name")).toHaveCount(0);
    held.release();
    await expect(page.getByLabel("Display name")).toHaveValue("Original Name");
    expect(state.unexpected).toEqual([]);
  } finally {
    held.release();
  }
});

test("pending save disables controls and rejects repeated form submission", async ({ page }) => {
  const held = gate();
  const state = await fixture(page, { saveGate: held.promise });
  try {
    await page.goto("/settings");
    await page.getByLabel("Display name").fill("One Save");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect.poll(() => state.updates.length).toBe(1);
    await expect(page.getByLabel("Display name")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save profile" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeDisabled();
    await page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Save profile" }) })
      .evaluate((form) => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    held.release();
    await expect(page.getByRole("main").getByRole("status")).toHaveText("Profile saved.");
    expect(state.updates).toEqual([{ name: "One Save" }]);
    expect(state.unexpected).toEqual([]);
  } finally {
    held.release();
  }
});

test("signed-out settings does not expose an editable profile", async ({ page }) => {
  const state = await fixture(page, { signedOut: true });
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save profile" })).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("session errors fail closed without exposing server details", async ({ page }) => {
  const state = await fixture(page, { sessionError: true });
  await page.goto("/settings");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Your session could not be loaded",
  );
  await expect(page.getByLabel("Display name")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("private-session-detail");
  expect(state.unexpected).toEqual([]);
});

test("save errors remain generic and do not persist the rejected name", async ({ page }) => {
  const state = await fixture(page, { saveError: true });
  await page.goto("/settings");
  await page.getByLabel("Display name").fill("Rejected Name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Profile could not be saved. Please try again.",
  );
  await expect(page.locator("body")).not.toContainText("private-save-detail");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Original Name");
  expect(state.unexpected).toEqual([]);
});
