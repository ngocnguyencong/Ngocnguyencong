import { expect, test, type Page, type Route } from "@playwright/test";

import { fulfillInertShellRead } from "./shell-api";

const taskPrompt = "Summarize this offline production-reference fixture.";
const taskId = "task_offline_reference_001";
const restoreTaskId = "task_offline_restore_002";
const workspaceId = "workspace_offline_reference";
const completedText = "Offline fixture completion: the durable result is visible.";

type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type TerminalTaskStatus = Extract<TaskStatus, "failed" | "cancelled">;

type TaskFixture = Readonly<{
  completedAt: string | null;
  id: string;
  result: Readonly<{ text: string }> | null;
  status: TaskStatus;
  workspaceId: string;
}>;

type ApiFixtureOptions = Readonly<{
  create?: (route: Route) => Promise<void>;
  read?: (route: Route, taskId: string) => Promise<void>;
}>;

async function installFailClosedApiFixtures(page: Page, options: ApiFixtureOptions = {}) {
  const unexpectedRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const taskPath = /^\/api\/ai\/tasks\/([^/]+)$/u.exec(url.pathname);

    if (url.pathname === "/api/ai/tasks" && request.method() === "POST" && options.create) {
      await options.create(route);
      return;
    }

    if (taskPath !== null && request.method() === "GET" && options.read) {
      const requestedTaskId = taskPath[1];
      if (requestedTaskId === undefined) {
        unexpectedRequests.push(`${request.method()} ${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      await options.read(route, decodeURIComponent(requestedTaskId));
      return;
    }

    if (await fulfillInertShellRead(route)) {
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.abort("blockedbyclient");
  });

  return {
    assertNoUnexpectedRequests() {
      expect(unexpectedRequests, "unexpected /api/** request").toEqual([]);
    },
  };
}

function jsonResponse(route: Route, status: number, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

function taskResponse(task: TaskFixture) {
  return { data: task };
}

function queuedTask(id = taskId): TaskFixture {
  return {
    completedAt: null,
    id,
    result: null,
    status: "queued",
    workspaceId,
  };
}

function completedTask(id = taskId): TaskFixture {
  return {
    completedAt: "2026-09-05T00:00:00.000Z",
    id,
    result: { text: completedText },
    status: "completed",
    workspaceId,
  };
}

function terminalTask(status: TerminalTaskStatus, id: string): TaskFixture {
  return {
    completedAt: null,
    id,
    result: null,
    status,
    workspaceId,
  };
}

function taskPromptField(page: Page) {
  return page.getByRole("textbox", { name: "Task prompt" });
}

function modelAliasField(page: Page) {
  return page.getByRole("combobox", { name: "Model alias" });
}

function minimumContextField(page: Page) {
  return page.getByRole("spinbutton", { name: "Minimum context tokens" });
}

function submitTaskButton(page: Page) {
  return page.getByRole("button", { name: /submit|queue|create.*task/i }).first();
}

function errorMessage(page: Page) {
  return page.getByRole("main").getByRole("alert").first();
}

test.describe("offline production Reference App", () => {
  test("recovers a lost create response after reload with the same submission key", async ({
    page,
  }) => {
    const keys: (string | undefined)[] = [];
    let creates = 0;
    const fixtures = await installFailClosedApiFixtures(page, {
      create: async (route) => {
        keys.push(route.request().headers()["idempotency-key"]);
        creates += 1;
        if (creates === 1) return route.abort("failed");
        expect(route.request().postDataJSON()).toEqual({ resume: true });
        await jsonResponse(route, 200, taskResponse(completedTask()));
      },
      read: async (route) => {
        await jsonResponse(route, 200, taskResponse(completedTask()));
      },
    });
    await page.goto("/ai");
    await taskPromptField(page).fill(taskPrompt);
    await submitTaskButton(page).click();
    await expect(errorMessage(page)).toBeVisible();
    await expect(page).toHaveURL(/submissionKey=/);
    await page.reload();
    await expect(page.getByText(completedText)).toBeVisible();
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(keys.every((key) => key === keys[0])).toBe(true);
    await expect(page).not.toHaveURL(/submissionKey=/);
    fixtures.assertNoUnexpectedRequests();
  });
  test("submits only narrow fields, polls status, refreshes, and renders the result", async ({
    page,
  }) => {
    let submittedBody: unknown;
    let statusReads = 0;
    const fixtures = await installFailClosedApiFixtures(page, {
      create: async (route) => {
        submittedBody = JSON.parse(route.request().postData() ?? "null") as unknown;
        await jsonResponse(route, 201, {
          data: {
            id: taskId,
            providerRunId: "run_offline_reference_001",
            status: "queued",
            workspaceId,
          },
        });
      },
      read: async (route, requestedTaskId) => {
        expect(requestedTaskId).toBe(taskId);
        statusReads += 1;
        await jsonResponse(
          route,
          200,
          taskResponse(statusReads < 3 ? queuedTask() : completedTask()),
        );
      },
    });

    await page.goto("/ai");
    await taskPromptField(page).fill(taskPrompt);
    await modelAliasField(page).click();
    await page.getByRole("option", { name: "smart", exact: true }).click();
    await minimumContextField(page).fill("32000");
    const structuredOutput = page.getByLabel(/structured output/i).first();
    await structuredOutput.check();
    await submitTaskButton(page).click();

    await expect
      .poll(() => submittedBody)
      .toEqual({
        alias: "smart",
        prompt: taskPrompt,
        requirements: expect.objectContaining({
          minContext: 32000,
          structuredOutput: true,
        }),
      });
    const submittedRecord = submittedBody as Record<string, unknown>;
    expect(Object.keys(submittedRecord).sort()).toEqual(["alias", "prompt", "requirements"]);
    expect(submittedRecord).not.toHaveProperty("workspaceId");
    expect(submittedRecord).not.toHaveProperty("provider");
    expect(submittedRecord).not.toHaveProperty("recipient");
    expect(submittedRecord).not.toHaveProperty("taskId");

    await expect(page).toHaveURL(/taskId=task_offline_reference_001/u);
    await expect(page.getByText(/queued/i).first()).toBeVisible();
    await expect.poll(() => statusReads, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);

    await expect(page.getByRole("button", { name: "Refresh status" })).toBeVisible();
    await page.getByRole("button", { name: "Refresh status" }).click();
    await expect.poll(() => statusReads).toBeGreaterThanOrEqual(3);
    await expect(page.getByText(/completed/i).first()).toBeVisible();
    await expect(page.getByText(completedText)).toBeVisible();

    fixtures.assertNoUnexpectedRequests();
  });

  test("restores a task from the taskId URL after reload", async ({ page }) => {
    const fixtures = await installFailClosedApiFixtures(page, {
      read: async (route, requestedTaskId) => {
        expect(requestedTaskId).toBe(restoreTaskId);
        await jsonResponse(route, 200, taskResponse(completedTask(restoreTaskId)));
      },
    });

    await page.goto(`/?taskId=${restoreTaskId}`);
    await expect(page.getByText(completedText)).toBeVisible();
    await expect(page.getByText(restoreTaskId)).toBeVisible();

    await page.reload();

    await expect(page.getByText(completedText)).toBeVisible();
    await expect(page.getByText(restoreTaskId)).toBeVisible();
    fixtures.assertNoUnexpectedRequests();
  });

  for (const terminalStatus of ["failed", "cancelled"] as const) {
    test(`renders ${terminalStatus} without completed output`, async ({ page }) => {
      const terminalTaskId = `task_offline_${terminalStatus}_003`;
      const fixtures = await installFailClosedApiFixtures(page, {
        read: async (route, requestedTaskId) => {
          expect(requestedTaskId).toBe(terminalTaskId);
          await jsonResponse(
            route,
            200,
            taskResponse(terminalTask(terminalStatus, terminalTaskId)),
          );
        },
      });

      await page.goto(`/?taskId=${terminalTaskId}`);

      await expect(page.getByText(new RegExp(`^${terminalStatus}$`, "iu")).first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "No output is available.", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Completed output", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText(completedText, { exact: true })).toHaveCount(0);

      fixtures.assertNoUnexpectedRequests();
    });
  }

  test("shows a server 401 response without exposing a local route", async ({ page }) => {
    const fixtures = await installFailClosedApiFixtures(page, {
      create: async (route) =>
        jsonResponse(route, 401, {
          error: { code: "unauthorized", message: "Authentication is required." },
        }),
    });

    await page.goto("/ai");
    await taskPromptField(page).fill(taskPrompt);
    await submitTaskButton(page).click();

    await expect(errorMessage(page)).toContainText("Authentication is required.");
    fixtures.assertNoUnexpectedRequests();
  });

  test("shows a server 403 response", async ({ page }) => {
    const fixtures = await installFailClosedApiFixtures(page, {
      create: async (route) =>
        jsonResponse(route, 403, {
          error: { code: "entitlementRequired", message: "An active AI entitlement is required." },
        }),
    });

    await page.goto("/ai");
    await taskPromptField(page).fill(taskPrompt);
    await submitTaskButton(page).click();

    await expect(errorMessage(page)).toContainText("An active AI entitlement is required.");
    fixtures.assertNoUnexpectedRequests();
  });

  test("shows a server 404 response while reading a task", async ({ page }) => {
    const fixtures = await installFailClosedApiFixtures(page, {
      read: async (route, requestedTaskId) => {
        expect(requestedTaskId).toBe(restoreTaskId);
        await jsonResponse(route, 404, {
          error: { code: "notFound", message: "The task was not found." },
        });
      },
    });

    await page.goto(`/?taskId=${restoreTaskId}`);

    await expect(errorMessage(page)).toContainText("The task was not found.");
    await expect(page.locator(".task-grid").getByText("Unknown", { exact: true })).toBeVisible();
    await expect(page.getByText("Queued", { exact: true })).toHaveCount(0);
    fixtures.assertNoUnexpectedRequests();
  });

  test("shows a network failure while reading a task", async ({ page }) => {
    const fixtures = await installFailClosedApiFixtures(page, {
      read: async (route, requestedTaskId) => {
        expect(requestedTaskId).toBe(restoreTaskId);
        await route.abort("failed");
      },
    });

    await page.goto(`/?taskId=${restoreTaskId}`);

    await expect(errorMessage(page)).toBeVisible();
    fixtures.assertNoUnexpectedRequests();
  });
});
