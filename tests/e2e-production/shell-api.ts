import type { Route } from "@playwright/test";

const shellReadPaths = new Set([
  "/api/announcements",
  "/api/notifications",
  "/api/workspace/metrics",
  "/api/workspaces",
]);

/** Give unrelated app-shell reads an inert offline response. */
export async function fulfillInertShellRead(route: Route): Promise<boolean> {
  const request = route.request();
  if (request.method() !== "GET" || !shellReadPaths.has(new URL(request.url()).pathname)) {
    return false;
  }

  await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
  return true;
}
