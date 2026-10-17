import { expect, test } from "vitest";

import { createMobileEntitlementBff } from "./mobile-entitlement-bff.js";

test("rejects a request without a Better Auth session before querying workspace data", async () => {
  let lookedUpUser = false;
  const bff = createMobileEntitlementBff({
    findWorkspaceEntitlement: async () => {
      lookedUpUser = true;
      return null;
    },
    getSession: async () => null,
  });

  await expect(bff.get(new Headers())).resolves.toEqual({
    body: {
      error: {
        code: "unauthorized",
        message: "Sign in before viewing your entitlement.",
      },
    },
    status: 401,
  });
  expect(lookedUpUser).toBe(false);
});

test("uses the authenticated user's server-derived workspace entitlement", async () => {
  let lookedUpUserId: string | undefined;
  const bff = createMobileEntitlementBff({
    findWorkspaceEntitlement: async (userId) => {
      lookedUpUserId = userId;
      return {
        entitlement: {
          expiresAt: "2026-12-31T00:00:00.000Z",
          productName: "supastack Pro",
          status: "active",
          workspaceId: "workspace-1",
        },
        workspaceId: "workspace-1",
      };
    },
    getSession: async () => ({ user: { id: "user-1" } }),
  });

  await expect(
    bff.get(new Headers({ Cookie: "better-auth.session_token=opaque-session" })),
  ).resolves.toEqual({
    body: {
      data: {
        entitlement: {
          expiresAt: "2026-12-31T00:00:00.000Z",
          productName: "supastack Pro",
          status: "active",
          workspaceId: "workspace-1",
        },
        workspaceId: "workspace-1",
      },
    },
    status: 200,
  });
  expect(lookedUpUserId).toBe("user-1");
});

test("does not expose an unexpected reader error", async () => {
  const bff = createMobileEntitlementBff({
    findWorkspaceEntitlement: async () => {
      throw new Error("database connection string");
    },
    getSession: async () => ({ user: { id: "user-1" } }),
  });

  await expect(bff.get(new Headers())).resolves.toEqual({
    body: {
      error: {
        code: "internalError",
        message: "Your entitlement could not be loaded.",
      },
    },
    status: 500,
  });
});

test("does not return an entitlement from a different workspace than the reader selected", async () => {
  const bff = createMobileEntitlementBff({
    findWorkspaceEntitlement: async () => ({
      entitlement: {
        expiresAt: null,
        productName: "supastack Pro",
        status: "active",
        workspaceId: "workspace-other",
      },
      workspaceId: "workspace-1",
    }),
    getSession: async () => ({ user: { id: "user-1" } }),
  });

  await expect(bff.get(new Headers())).resolves.toEqual({
    body: {
      error: {
        code: "internalError",
        message: "Your entitlement could not be loaded.",
      },
    },
    status: 500,
  });
});
