import { parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

import { createBetterAuthOptions } from "./index.js";
import { createWebAuthWithFactories } from "./server.js";

const config = parseServerConfig({
  ADMIN_EMAILS: "root@example.test, ops@example.test",
  APP_URL: "http://localhost:3000",
});

function createCapturedAuth(serverConfig: typeof config) {
  const createAuth = vi.fn((options: unknown) => options);
  const auth = createWebAuthWithFactories(
    {
      database: { connection: "not-used" },
      admitAuthMail: vi.fn(async () => true),
      provisionPersonalWorkspace: vi.fn(async () => undefined),
      sendMagicLink: vi.fn(async () => undefined),
      sendVerificationOTP: vi.fn(async () => undefined),
      serverConfig,
    },
    { createAdapter: () => ({}), createAuth },
  ) as {
    databaseHooks: {
      user: {
        create: {
          before?: (user: {
            banned?: boolean;
            email: string;
            emailVerified?: boolean;
            id: string;
            name?: string;
          }) => Promise<unknown>;
        };
      };
    };
    plugins: Array<{ id: string }>;
  };
  return auth;
}

describe("platform admin plugin", () => {
  it("installs the Better Auth admin plugin", () => {
    const options = createBetterAuthOptions(config, {
      admitAuthMail: vi.fn(async () => true),
      sendMagicLink: vi.fn(async () => undefined),
      sendVerificationOTP: vi.fn(async () => undefined),
    });
    const plugins = options.plugins as Array<{ id: string }>;

    expect(plugins.map((plugin) => plugin.id)).toContain("admin");
  });
});

describe("admin bootstrap promotion", () => {
  it("promotes configured ADMIN_EMAILS to the admin role on user create", async () => {
    const auth = createCapturedAuth(config);
    const before = auth.databaseHooks.user.create.before;

    const promoted = (await before?.({
      email: "ROOT@example.test",
      emailVerified: true,
      id: "user_01",
      name: "Root",
    })) as { data?: { role?: string } } | undefined;
    expect(promoted?.data?.role).toBe("admin");

    expect(
      await before?.({
        banned: true,
        email: "root@example.test",
        emailVerified: true,
        id: "user_banned",
      }),
    ).toBeUndefined();

    const normal = await before?.({
      email: "member@example.test",
      id: "user_02",
      name: "Member",
    });
    expect(normal).toBeUndefined();
  });

  it("does not install a create.before hook when no admin emails are configured", async () => {
    const auth = createCapturedAuth(parseServerConfig({ APP_URL: "http://localhost:3000" }));
    expect(auth.databaseHooks.user.create.before).toBeUndefined();
  });
});
