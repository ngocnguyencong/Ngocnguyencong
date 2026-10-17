import { randomUUID } from "node:crypto";

import { parseServerConfig } from "@supastack/config";
import { createPostgresDatabase } from "@supastack/db";
import { describe, expect, it } from "vitest";

import { createDrizzlePersonalWorkspaceProvisioner, createWebAuth } from "./server";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

/**
 * Golden path: verified OTP signup followed by server-only setPassword writes the
 * user and a credential account row (with issuer) over the real Drizzle
 * adapter, then provision the personal workspace. Requires TEST_DATABASE_URL
 * pointing at a database that already ran `pnpm db:migrate`.
 */
integrationDescribe("PostgreSQL Better Auth sign-up", () => {
  it("registers a credential account with an issuer and provisions the workspace", async () => {
    const origin = "http://localhost:3000";
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });
    const email = `signup-${randomUUID()}@example.test`;
    let deliveredOtp = "";

    try {
      const auth = createWebAuth({
        database: lifecycle.database,
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: createDrizzlePersonalWorkspaceProvisioner(lifecycle.database),
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async ({ otp }) => {
          deliveredOtp = otp;
        },
        serverConfig: parseServerConfig({ APP_URL: origin, EXPO_PUBLIC_API_URL: origin }),
      });

      expect(
        (
          await auth.handler(
            new Request(`${origin}/api/auth/email-otp/send-verification-otp`, {
              method: "POST",
              headers: { origin, "content-type": "application/json" },
              body: JSON.stringify({ email, type: "sign-in" }),
            }),
          )
        ).status,
      ).toBe(200);

      const response = await auth.handler(
        new Request(`${origin}/api/auth/sign-in/email-otp`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ email, name: "Signup Test", otp: deliveredOtp }),
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie().join(";")).toContain("session_token");
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      await auth.api.setPassword({
        headers: new Headers({ origin, cookie }),
        body: { newPassword: "Sup3rSecret!x" },
      });

      const accounts = await lifecycle.client<
        { account_id: string; issuer: string; provider_id: string }[]
      >`
        SELECT a.account_id, a.issuer, a.provider_id
        FROM account a JOIN "user" u ON u.id = a.user_id
        WHERE u.email = ${email}`;
      expect(accounts).toEqual([
        { account_id: expect.any(String), issuer: "local:credential", provider_id: "credential" },
      ]);

      const memberships = await lifecycle.client<{ role: string; workspace_id: string }[]>`
        SELECT m.role, m.workspace_id
        FROM workspace_membership m JOIN "user" u ON u.id = m.user_id
        WHERE u.email = ${email}`;
      expect(memberships).toEqual([{ role: "owner", workspace_id: expect.any(String) }]);
    } finally {
      // user delete cascades account/session/membership; the workspace row is
      // user-independent so it is removed explicitly.
      await lifecycle.client`
        DELETE FROM workspace WHERE id IN (
          SELECT m.workspace_id FROM workspace_membership m
          JOIN "user" u ON u.id = m.user_id WHERE u.email = ${email})`;
      await lifecycle.client`DELETE FROM "user" WHERE email = ${email}`;
      await lifecycle.close();
    }
  });
});
