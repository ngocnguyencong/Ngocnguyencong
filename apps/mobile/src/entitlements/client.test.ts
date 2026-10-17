import { expect, test } from "vitest";

import { createMobileEntitlementActions } from "./client";

test("forwards the restored Better Auth cookie to the fixed entitlement BFF endpoint", async () => {
  let request: { init: unknown; url: string } | undefined;
  const actions = createMobileEntitlementActions(
    {
      getCookie: async () => "better-auth.session_token=opaque-session",
      apiUrl: "https://api.example.test",
    },
    async (url, init) => {
      request = { init, url };
      return {
        json: async () => ({
          data: {
            entitlement: {
              expiresAt: null,
              productName: "supastack Pro",
              status: "active",
              workspaceId: "workspace-1",
            },
            workspaceId: "workspace-1",
          },
        }),
        ok: true,
        status: 200,
      };
    },
  );

  await expect(actions.fetchEntitlement()).resolves.toEqual({
    expiresAt: null,
    productName: "supastack Pro",
    status: "active",
    workspaceId: "workspace-1",
  });
  expect(request).toEqual({
    init: {
      headers: {
        Accept: "application/json",
        Cookie: "better-auth.session_token=opaque-session",
      },
      method: "GET",
    },
    url: "https://api.example.test/api/mobile/entitlement",
  });
});

test("rejects an entitlement whose workspace differs from the authenticated BFF workspace", async () => {
  const actions = createMobileEntitlementActions(
    {
      getCookie: async () => "better-auth.session_token=opaque-session",
      apiUrl: "https://api.example.test",
    },
    async () => ({
      json: async () => ({
        data: {
          entitlement: {
            expiresAt: null,
            productName: "supastack Pro",
            status: "active",
            workspaceId: "workspace-other",
          },
          workspaceId: "workspace-1",
        },
      }),
      ok: true,
      status: 200,
    }),
  );

  await expect(actions.fetchEntitlement()).rejects.toThrow(
    "The entitlement response did not match its workspace.",
  );
});
