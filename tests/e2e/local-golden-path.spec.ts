import { expect, test } from "@playwright/test";

test("reports session restoration failure on the local sign-in form", async ({ page }) => {
  await page.route("**/api/local-reference/hydrate", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Local session is unavailable." } } }),
  );
  await page.goto("/ai");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Local session is unavailable.",
  );
  await expect(page.getByRole("button", { name: "Start local reference flow" })).toBeEnabled();
});

test("reports authentication failure and allows a successful local retry", async ({ page }) => {
  await page.route("**/api/local-reference/authenticate", (route) =>
    route.fulfill({ status: 503, json: { error: { message: "Local sign-in is unavailable." } } }),
  );
  await page.goto("/ai");
  const submit = page.getByRole("button", { name: "Start local reference flow" });
  await submit.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Local sign-in is unavailable.",
  );
  await expect(submit).toBeEnabled();
  await page.unroute("**/api/local-reference/authenticate");
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "Your local path is ready to trace." }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("local registration/login reaches an entitled AI result and completion email", async ({
  page,
}) => {
  await page.goto("/ai");

  await page.getByLabel("Your name").fill("Avery");
  await page.getByLabel("Email address").fill("avery@example.test");
  await page.getByRole("button", { name: "Start local reference flow" }).click();

  await expect(
    page.getByRole("heading", { name: "Your local path is ready to trace." }),
  ).toBeVisible();
  await expect(page.getByText("Reference AI active")).toBeVisible();
  await expect(page.getByText("Avery's workspace")).toBeVisible();

  await page.getByRole("button", { name: "Create AI task" }).click();
  await page
    .getByLabel("Task prompt")
    .fill("Summarize the local acceptance criteria for this browser run.");
  await page.getByRole("button", { name: "Queue local task" }).click();

  await expect(page.getByRole("button", { name: "Run local task" })).toBeEnabled();
  await page.getByRole("button", { name: "Run local task" }).click();

  await expect(
    page.getByRole("heading", { name: "The local completion is recorded." }),
  ).toBeVisible();
  await expect(
    page.getByText("Summarize the local acceptance criteria for this browser run."),
  ).toBeVisible();
  await expect(page.getByText("Transactional local outbox")).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toContainText("queued");

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "The local completion is recorded." }),
  ).toBeVisible();
  await expect(page.getByText("Avery's workspace")).toBeVisible();
  await expect(
    page.getByText("Summarize the local acceptance criteria for this browser run."),
  ).toBeVisible();
  await expect(page.getByText("Transactional local outbox")).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toContainText("queued");

  await page.getByRole("button", { name: "Dashboard" }).click();
  await expect(page.getByText("Reference AI active")).toBeVisible();
});
