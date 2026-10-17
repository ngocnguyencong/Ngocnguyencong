import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDrizzlePersonalWorkspaceProvisioner, createWebAuth } from "@supastack/auth/server";
import { parseServerConfig } from "@supastack/config";
import { createPostgresDatabase, user, workspace, workspaceMembership } from "@supastack/db";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { describe, expect, it } from "vitest";

const databaseUrl = process.env.TEST_AUTH_DATABASE_URL;

describe.skipIf(!databaseUrl)("real auth profile with Postgres", () => {
  it("persists profile changes across auth instances and provisions isolated personal workspaces", async () => {
    const lifecycle = createPostgresDatabase({ databaseUrl: databaseUrl! });
    const origin = "http://localhost:3000";
    const suffix = randomUUID();
    const emails = [`auth-first-${suffix}@example.test`, `auth-second-${suffix}@example.test`];
    const createdIds = new Set<string>();
    const provision = createDrizzlePersonalWorkspaceProvisioner(lifecycle.database);
    let deliveredOtp = "";
    const createAuth = () =>
      createWebAuth({
        database: lifecycle.database,
        admitAuthMail: async () => true,
        serverConfig: parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
        sendMagicLink: async () => {
          throw new Error("Unexpected email delivery in profile test");
        },
        sendVerificationOTP: async ({ otp }) => {
          deliveredOtp = otp;
        },
        provisionPersonalWorkspace: async (identity) => {
          createdIds.add(identity.id);
          await provision(identity);
        },
      });
    function request(
      auth: ReturnType<typeof createAuth>,
      path: string,
      cookie?: string,
      body?: unknown,
    ) {
      return auth.handler(
        new Request(`${origin}/api/auth/${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
    }
    try {
      await migrate(lifecycle.database, {
        migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
      });
      const auth = createAuth();
      const cookies: string[] = [];
      for (const [index, email] of emails.entries()) {
        expect(
          (
            await request(auth, "email-otp/send-verification-otp", undefined, {
              email,
              type: "sign-in",
            })
          ).status,
        ).toBe(200);
        const response = await request(auth, "sign-in/email-otp", undefined, {
          email,
          name: `Person ${index}`,
          otp: deliveredOtp,
        });
        expect(response.status).toBe(200);
        cookies.push(
          response.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; "),
        );
      }
      expect(createdIds.size).toBe(2);
      for (const id of createdIds) {
        // Replaying the production hook must not duplicate workspace or membership.
        await provision({ id });
        const memberships = await lifecycle.database
          .select()
          .from(workspaceMembership)
          .where(eq(workspaceMembership.userId, id));
        expect(memberships).toHaveLength(1);
        expect(memberships[0]).toMatchObject({ workspaceId: `workspace_${id}`, role: "owner" });
        const workspaces = await lifecycle.database
          .select()
          .from(workspace)
          .where(eq(workspace.id, `workspace_${id}`));
        expect(workspaces).toHaveLength(1);
        expect(workspaces[0]?.type).toBe("personal");
      }
      expect((await request(auth, "update-user", cookies[0], { name: "Saved name" })).status).toBe(
        200,
      );
      const restarted = createAuth();
      expect(await (await request(restarted, "get-session", cookies[0])).json()).toMatchObject({
        user: { name: "Saved name", email: emails[0] },
      });
      expect(await (await request(restarted, "get-session", cookies[1])).json()).toMatchObject({
        user: { name: "Person 1", email: emails[1] },
      });
      expect(
        (await request(restarted, "update-user", undefined, { name: "Anonymous" })).status,
      ).toBe(401);
      const stored = await lifecycle.database
        .select({ name: user.name })
        .from(user)
        .where(eq(user.email, emails[0]!));
      expect(stored).toEqual([{ name: "Saved name" }]);
    } finally {
      try {
        for (const id of createdIds) {
          await lifecycle.database.delete(workspace).where(eq(workspace.id, `workspace_${id}`));
        }
        await lifecycle.database.delete(user).where(inArray(user.email, emails));
      } finally {
        await lifecycle.close();
      }
    }
  });
});
