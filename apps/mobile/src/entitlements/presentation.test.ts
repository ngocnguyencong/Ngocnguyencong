import { expect, test } from "vitest";

const loadPresentation = () => import("./presentation");

test("shows the server-verified entitlement and its recorded expiration without assuming renewal", async () => {
  const { toEntitlementPresentation } = await loadPresentation();

  expect(
    toEntitlementPresentation({
      expiresAt: "2026-12-31T00:00:00.000Z",
      productName: "supastack Pro",
      status: "active",
      workspaceId: "workspace-1",
    }),
  ).toEqual({
    detail: "Server-verified access. Recorded expiration date: Dec 31, 2026.",
    status: "Active",
    title: "supastack Pro",
    workspaceId: "workspace-1",
  });
});

test("explains that no server-verified entitlement is active for the workspace", async () => {
  const { toEntitlementPresentation } = await loadPresentation();

  expect(toEntitlementPresentation(null)).toEqual({
    detail: "No server-verified entitlement is active for this workspace.",
    status: "No active entitlement",
    title: "supastack",
    workspaceId: null,
  });
});

test("does not infer a lifetime or renewal term when the server has no expiration date", async () => {
  const { toEntitlementPresentation } = await loadPresentation();

  expect(
    toEntitlementPresentation({
      expiresAt: null,
      productName: "supastack Pro",
      status: "active",
      workspaceId: "workspace-1",
    }).detail,
  ).toBe("Server-verified access. No expiration date is recorded.");
});
