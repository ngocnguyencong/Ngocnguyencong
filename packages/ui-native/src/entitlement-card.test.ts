import { expect, test } from "vitest";

const loadEntitlementCard = () => import("./entitlement-card");

test("creates a non-purchasing native card for an active entitlement", async () => {
  const { createEntitlementCard } = await loadEntitlementCard();

  expect(
    createEntitlementCard({
      action: { kind: "manage_on_web", label: "Manage on the web" },
      detail: "Renews on Dec 31, 2026",
      status: "Active",
      title: "supastack Pro",
      workspaceId: "workspace-1",
    }),
  ).toEqual({
    accessibilityLabel: "supastack Pro. Active. Renews on Dec 31, 2026",
    action: { kind: "manage_on_web", label: "Manage on the web" },
    detail: "Renews on Dec 31, 2026",
    status: "Active",
    title: "supastack Pro",
  });
});
