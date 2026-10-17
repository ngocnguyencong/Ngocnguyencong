import { parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

describe("mailbox promotion adapter boundary", () => {
  function compose(emailVerified = false) {
    const events: string[] = [];
    const row = {
      id: "legacy",
      email: "legacy@example.test",
      emailVerified,
      twoFactorEnabled: true,
    };
    const update = vi.fn(async (input: { update: Record<string, unknown> }) => {
      events.push("promote");
      Object.assign(row, input.update);
      return row;
    });
    const deleteMany = vi.fn(async ({ model }: { model: string }) => {
      events.push(model);
      return 1;
    });
    const revocation = vi.fn(async () => {
      events.push("api-keys");
    });
    const adapter = { findOne: vi.fn(async () => row), deleteMany, update };
    const transaction = vi.fn(
      async (callback: (value: unknown, marker: string) => unknown, options?: unknown) => {
        return callback(adapter, String(options ?? "default"));
      },
    );
    const auth = createWebAuthWithFactories(
      {
        database: {},
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: async () => undefined,
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async () => undefined,
        serverConfig: config,
        revokeUserApiKeys: revocation,
      },
      { createAdapter: () => ({ ...adapter, transaction }), createAuth: (options) => options },
    );
    const database = auth.database as {
      update(input: unknown): Promise<unknown>;
      transaction(
        callback: (
          value: { update(input: unknown): Promise<unknown> },
          marker: string,
        ) => Promise<unknown>,
        options?: unknown,
      ): Promise<unknown>;
    };
    const promotion = {
      model: "user",
      where: [{ field: "id", value: "legacy" }],
      update: { emailVerified: true },
    };
    return { database, promotion, events, row, update, deleteMany, revocation, transaction };
  }

  it("removes factors before the exact id-only promotion and resets the MFA flag", async () => {
    const test = compose();
    await test.database.update(test.promotion);
    expect(test.events).toEqual(["passkey", "twoFactor", "api-keys", "promote"]);
    expect(test.row).toMatchObject({ emailVerified: true, twoFactorEnabled: false });
    expect(test.deleteMany.mock.calls).toEqual([
      [{ model: "passkey", where: [{ field: "userId", value: "legacy" }] }],
      [{ model: "twoFactor", where: [{ field: "userId", value: "legacy" }] }],
    ]);
  });

  it("does not promote if factor deletion fails", async () => {
    const test = compose();
    test.deleteMany.mockRejectedValueOnce(new Error("factor cleanup failed"));
    await expect(test.database.update(test.promotion)).rejects.toThrow("factor cleanup failed");
    expect(test.row.emailVerified).toBe(false);
    expect(test.update).not.toHaveBeenCalled();
    expect(test.revocation).not.toHaveBeenCalled();
  });

  it("does not promote if application API-key cleanup fails", async () => {
    const test = compose();
    test.revocation.mockRejectedValueOnce(new Error("key cleanup failed"));
    await expect(test.database.update(test.promotion)).rejects.toThrow("key cleanup failed");
    expect(test.row.emailVerified).toBe(false);
    expect(test.update).not.toHaveBeenCalled();
  });

  it("preserves credentials and MFA of an already verified owner", async () => {
    const test = compose(true);
    await test.database.update(test.promotion);
    expect(test.row.twoFactorEnabled).toBe(true);
    expect(test.deleteMany).not.toHaveBeenCalled();
    expect(test.revocation).not.toHaveBeenCalled();
  });

  it("wraps transaction adapters while preserving the transaction options and callback arguments", async () => {
    const test = compose();
    let marker = "";
    await test.database.transaction(async (adapter, value) => {
      marker = value;
      return adapter.update(test.promotion);
    }, "transaction-options");
    expect(marker).toBe("transaction-options");
    expect(test.transaction.mock.calls[0]?.[1]).toBe("transaction-options");
    expect(test.row.twoFactorEnabled).toBe(false);
  });
});

describe("recovery invalidates cached enrollment and linking sessions", () => {
  function compose(
    owner: Record<string, unknown> | null,
    liveSession: Record<string, unknown> | null,
  ) {
    const reads: string[] = [];
    const findUserById = vi.fn(async () => {
      reads.push("owner");
      return owner;
    });
    const findOne = vi.fn(async () => {
      reads.push("session");
      return liveSession;
    });
    const auth = createWebAuthWithFactories(
      {
        database: {},
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: async () => undefined,
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async () => undefined,
        serverConfig: config,
      },
      { createAdapter: () => ({}), createAuth: (options) => options },
    ) as {
      databaseHooks: {
        user: { update: { before: (user: unknown, context: unknown) => Promise<unknown> } };
        session: { create: { before: (session: unknown, context: unknown) => Promise<unknown> } };
        account: { create: { before: (account: unknown, context: unknown) => Promise<unknown> } };
      };
    };
    const context = {
      path: "/two-factor/verify-totp",
      context: {
        internalAdapter: { findUserById },
        adapter: { findOne },
        session: {
          user: { id: "owner", emailVerified: false },
          session: { id: "old-session", userId: "owner" },
        },
      },
    };
    return { hooks: auth.databaseHooks, context, reads, findOne };
  }

  it("denies pending TOTP activation before mutating a recovered owner", async () => {
    const test = compose({ id: "owner", email: "owner@example.test", emailVerified: true }, null);
    await expect(
      test.hooks.user.update.before({ twoFactorEnabled: true }, test.context),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    expect(test.reads).toEqual(["owner", "session"]);
  });

  it("denies a replacement TOTP session when its enrollment session was revoked", async () => {
    const test = compose({ id: "owner", email: "owner@example.test", emailVerified: true }, null);
    await expect(
      test.hooks.session.create.before({ userId: "owner" }, test.context),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("denies a late social link from a revoked legacy session", async () => {
    const test = compose({ id: "owner", email: "owner@example.test", emailVerified: true }, null);
    await expect(
      test.hooks.account.create.before(
        { userId: "owner", providerId: "google", accountId: "attacker-provider" },
        { ...test.context, path: "/link-social" },
      ),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    expect(test.reads).toEqual(["owner", "session"]);
  });

  it.each([
    { id: "owner", email: "owner@example.test", emailVerified: false },
    { id: "owner", email: "owner@example.test", emailVerified: true, banned: true },
  ])("rejects unverified/banned owners before trusting a cached linking session", async (owner) => {
    const test = compose(owner, { id: "old-session", userId: "owner" });
    await expect(
      test.hooks.account.create.before(
        { userId: "owner", providerId: "google" },
        { ...test.context, path: "/link-social" },
      ),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    expect(test.findOne).not.toHaveBeenCalled();
  });

  it("preserves verified active enrollment and social linking", async () => {
    const test = compose(
      { id: "owner", email: "owner@example.test", emailVerified: true },
      { id: "old-session", userId: "owner", expiresAt: new Date(Date.now() + 60_000) },
    );
    expect(
      await test.hooks.user.update.before({ twoFactorEnabled: true }, test.context),
    ).toBeUndefined();
    expect(
      await test.hooks.account.create.before(
        { userId: "owner", providerId: "google" },
        { ...test.context, path: "/link-social" },
      ),
    ).toBeUndefined();
    expect(test.findOne).toHaveBeenCalledWith({
      model: "session",
      where: [
        { field: "id", value: "old-session" },
        { field: "userId", value: "owner" },
      ],
    });
  });

  it("does not change ordinary OAuth account creation without a linking session", async () => {
    const test = compose(null, null);
    expect(
      await test.hooks.account.create.before(
        { userId: "new-owner", providerId: "google" },
        { path: "/callback/google" },
      ),
    ).toBeUndefined();
    expect(test.reads).toEqual([]);
  });
});

describe("native passkey session credential lifecycle", () => {
  function compose(
    owner: Record<string, unknown> | null,
    persistedPasskey: Record<string, unknown> | null,
  ) {
    const reads: string[] = [];
    const findUserById = vi.fn(async () => {
      reads.push("owner");
      return owner;
    });
    const findOne = vi.fn(async () => {
      reads.push("passkey");
      return persistedPasskey;
    });
    const auth = createWebAuthWithFactories(
      {
        database: {},
        admitAuthMail: async () => true,
        provisionPersonalWorkspace: async () => undefined,
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async () => undefined,
        serverConfig: config,
      },
      { createAdapter: () => ({}), createAuth: (options) => options },
    ) as {
      databaseHooks: {
        session: {
          create: { before?: (session: unknown, context: unknown) => Promise<false | undefined> };
        };
      };
    };
    const context = {
      path: "/passkey/verify-authentication",
      body: { response: { id: "attacker-key" } },
      context: { internalAdapter: { findUserById }, adapter: { findOne } },
    };
    return { before: auth.databaseHooks.session.create.before, context, findOne, reads };
  }

  it("denies a cached passkey after recovery removed its persisted credential", async () => {
    const test = compose({ id: "owner", email: "owner@example.test", emailVerified: true }, null);
    await expect(test.before!({ userId: "owner" }, test.context)).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    expect(test.reads).toEqual(["owner", "passkey"]);
  });

  it.each([
    { id: "owner", email: "owner@example.test", emailVerified: false },
    { id: "owner", email: "owner@example.test", emailVerified: true, banned: true },
    null,
  ])("denies an unproven/banned/missing owner before looking up the credential", async (owner) => {
    const test = compose(owner, { userId: "owner", credentialID: "attacker-key" });
    await expect(test.before!({ userId: "owner" }, test.context)).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    expect(test.findOne).not.toHaveBeenCalled();
  });

  it.each(["/two-factor/verify-totp", "/two-factor/verify-backup-code"])(
    "requires a current factor for primary second-factor sign-in through %s",
    async (path) => {
      const test = compose(
        { id: "owner", email: "owner@example.test", emailVerified: true },
        { id: "factor-1", userId: "owner", verified: true },
      );
      const context = { ...test.context, path };
      expect(await test.before?.({ userId: "owner" }, context)).toBeUndefined();
      expect(test.findOne).toHaveBeenCalledWith({
        model: "twoFactor",
        where: [{ field: "userId", value: "owner" }],
      });
      const removed = compose(
        { id: "owner", email: "owner@example.test", emailVerified: true },
        null,
      );
      await expect(
        removed.before!({ userId: "owner" }, { ...removed.context, path }),
      ).rejects.toMatchObject({
        status: "FORBIDDEN",
      });
    },
  );

  it("preserves a verified active owner's persisted passkey", async () => {
    const test = compose(
      { id: "owner", email: "owner@example.test", emailVerified: true },
      { userId: "owner", credentialID: "attacker-key" },
    );
    expect(await test.before?.({ userId: "owner" }, test.context)).toBeUndefined();
    expect(test.findOne).toHaveBeenCalledWith({
      model: "passkey",
      where: [
        { field: "credentialID", value: "attacker-key" },
        { field: "userId", value: "owner" },
      ],
    });
  });

  it("rejects a credential belonging to another user and leaves non-passkey sessions unchanged", async () => {
    const test = compose(
      { id: "owner", email: "owner@example.test", emailVerified: true },
      { userId: "another-user", credentialID: "attacker-key" },
    );
    await expect(test.before!({ userId: "owner" }, test.context)).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    expect(
      await test.before?.({ userId: "owner" }, { ...test.context, path: "/sign-in/email-otp" }),
    ).toBeUndefined();
  });
});

import { createDrizzlePersonalWorkspaceProvisioner, createWebAuthWithFactories } from "./server.js";

const config = parseServerConfig({
  APP_URL: "http://localhost:3000",
  AUTH_APPLE_ENABLED: "true",
  APPLE_CLIENT_ID: "apple-client-id",
  APPLE_CLIENT_SECRET: "apple-client-secret",
  AUTH_GOOGLE_ENABLED: "true",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
});

describe("createWebAuthWithFactories", () => {
  it("composes the schema adapter, transactional OTP sender, and first-user hook", async () => {
    const createAdapter = vi.fn(() => ({ adapter: "drizzle" }));
    const createAuth = vi.fn((options) => options);
    const provisionPersonalWorkspace = vi.fn(async () => undefined);
    const sendVerificationOTP = vi.fn(async () => undefined);
    const sendMagicLink = vi.fn(async () => undefined);

    const auth = createWebAuthWithFactories(
      {
        database: { connection: "not-used" },
        admitAuthMail: vi.fn(async () => true),
        provisionPersonalWorkspace,
        sendMagicLink,
        sendVerificationOTP,
        serverConfig: config,
      },
      { createAdapter, createAuth },
    ) as {
      database: unknown;
      databaseHooks: {
        user: {
          create: {
            after: (user: {
              id: string;
              name?: string | null;
              emailVerified?: boolean;
            }) => Promise<void>;
          };
        };
      };
      plugins: Array<{
        id: string;
        options?: {
          sendMagicLink?: (input: unknown) => Promise<void>;
          sendVerificationOTP?: (input: unknown) => Promise<void>;
        };
      }>;
    };

    expect(createAdapter).toHaveBeenCalledWith({ connection: "not-used" });
    expect(auth.database).toEqual({ adapter: "drizzle" });

    await auth.databaseHooks.user.create.after({
      id: "user_01",
      name: "Noah",
      emailVerified: true,
    });
    expect(provisionPersonalWorkspace).toHaveBeenCalledWith({ id: "user_01", name: "Noah" });

    await auth.plugins
      .find((plugin) => plugin.id === "email-otp")
      ?.options?.sendVerificationOTP?.({
        email: "noah@example.test",
        otp: "123456",
        type: "sign-in",
      });
    expect(sendVerificationOTP).toHaveBeenCalledWith({
      email: "noah@example.test",
      otp: "123456",
      type: "sign-in",
    });

    await auth.plugins
      .find((plugin) => plugin.id === "magic-link")
      ?.options?.sendMagicLink?.({
        email: "noah@example.test",
        token: "token-value",
        url: "http://localhost:3000/api/auth/magic-link/verify?token=token-value",
      });
    expect(sendMagicLink).toHaveBeenCalledWith({
      email: "noah@example.test",
      token: "token-value",
      url: "http://localhost:3000/api/auth/magic-link/verify?token=token-value",
    });
  });
});

describe("createDrizzlePersonalWorkspaceProvisioner", () => {
  it("uses stable workspace and membership keys on hook retries", async () => {
    const inserted: Array<{ record: Record<string, unknown> }> = [];
    const executor = {
      insert: () => ({
        values: (record: Record<string, unknown>) => ({
          onConflictDoNothing: async () => {
            inserted.push({ record });
          },
        }),
      }),
      transaction: async (run: (transaction: typeof executor) => Promise<void>) => run(executor),
    };
    const provision = createDrizzlePersonalWorkspaceProvisioner(executor, {
      now: () => new Date("2026-09-04T12:00:00.000Z"),
    });

    await provision({ id: "user_01", name: "Noah" });
    await provision({ id: "user_01", name: "Noah" });

    expect(inserted.map(({ record }) => record.id)).toEqual([
      "workspace_user_01",
      "membership_user_01",
      "workspace_user_01",
      "membership_user_01",
    ]);
    expect(inserted[0]?.record).toMatchObject({ type: "personal" });
    expect(inserted[1]?.record).toMatchObject({ role: "owner", userId: "user_01" });
  });
});

describe("early-access gate and redemption wiring", () => {
  const inviteOnlyConfig = parseServerConfig({
    APP_URL: "http://localhost:3000",
    EARLY_ACCESS_INVITE_ONLY: "true",
    ADMIN_EMAILS: "root@example.test",
  });
  const openConfig = parseServerConfig({ APP_URL: "http://localhost:3000" });

  const sanitize = (value: string | null | undefined) =>
    value && /^[a-z0-9_-]{1,64}$/i.test(value.trim()) ? value.trim().toLowerCase() : null;

  const ctxWithCookies = (jar: Record<string, string>) => ({
    getCookie: (key: string) => jar[key] ?? null,
  });

  function compose(options: {
    serverConfig: typeof inviteOnlyConfig;
    validateCode?: ReturnType<typeof vi.fn>;
    onCreated?: ReturnType<typeof vi.fn>;
    withEarlyAccess?: boolean;
  }) {
    const createAuth = vi.fn((opts) => opts);
    const provisionPersonalWorkspace = vi.fn(async () => undefined);
    const earlyAccess = {
      cookies: { invite: "supastack_invite", referral: "supastack_ref" },
      sanitize,
      validateCode: options.validateCode ?? vi.fn(async () => "valid" as const),
      onCreated: options.onCreated ?? vi.fn(async () => undefined),
    };
    const auth = createWebAuthWithFactories(
      {
        database: {},
        admitAuthMail: async () => true,
        provisionPersonalWorkspace,
        sendMagicLink: async () => undefined,
        sendVerificationOTP: async () => undefined,
        serverConfig: options.serverConfig,
        ...(options.withEarlyAccess === false ? {} : { earlyAccess }),
      },
      { createAdapter: () => ({}), createAuth },
    ) as {
      databaseHooks: {
        user: {
          create: {
            after: (
              user: { id: string; email: string; emailVerified?: boolean },
              ctx: unknown,
            ) => Promise<void>;
          };
          update: {
            after: (user: Record<string, unknown>, ctx: unknown) => Promise<void>;
          };
        };
      };
      user?: {
        validateUserInfo: (
          data: {
            user: { email?: string; emailVerified?: boolean };
            source: { action: string; method: string };
          },
          ctx: unknown,
        ) => Promise<{ error: string; errorDescription?: string } | void>;
      };
    };
    return { auth, earlyAccess, provisionPersonalWorkspace };
  }

  it("rejects create-user without an invite code when invite-only is on", async () => {
    const validateCode = vi.fn(async () => "valid" as const);
    const { auth } = compose({ serverConfig: inviteOnlyConfig, validateCode });
    const gate = auth.user!.validateUserInfo;

    const rejected = await gate(
      {
        user: { email: "new@x.test" },
        source: { action: "create-user", method: "email-password" },
      },
      ctxWithCookies({}),
    );
    expect(rejected).toMatchObject({ error: "invite_required" });
    expect(validateCode).not.toHaveBeenCalled();
  });

  it("accepts create-user when the invite cookie holds a valid code", async () => {
    const validateCode = vi.fn(async () => "valid" as const);
    const { auth } = compose({ serverConfig: inviteOnlyConfig, validateCode });
    const result = await auth.user!.validateUserInfo(
      {
        user: { email: "new@x.test", emailVerified: true },
        source: { action: "create-user", method: "email-otp" },
      },
      ctxWithCookies({ supastack_invite: "CODE9" }),
    );
    expect(result).toBeUndefined();
    expect(validateCode).toHaveBeenCalledWith({ code: "code9", email: "new@x.test" });
  });

  it("does not bind an invite before the mailbox has been verified", async () => {
    const validateCode = vi.fn(async () => "valid" as const);
    const { auth } = compose({ serverConfig: inviteOnlyConfig, validateCode });
    const result = await auth.user!.validateUserInfo(
      {
        user: { email: "new@x.test", emailVerified: false },
        source: { action: "create-user", method: "email-password" },
      },
      ctxWithCookies({ supastack_invite: "CODE9" }),
    );

    expect(result).toMatchObject({ error: "invite_required" });
    expect(validateCode).not.toHaveBeenCalled();
  });

  it("fails closed when invite-only mode is missing its early-access hooks", async () => {
    const { auth } = compose({ serverConfig: inviteOnlyConfig, withEarlyAccess: false });
    const gate = auth.user!.validateUserInfo;

    expect(
      await gate(
        {
          user: { email: "new@x.test", emailVerified: true },
          source: { action: "create-user", method: "email-otp" },
        },
        ctxWithCookies({}),
      ),
    ).toMatchObject({ error: "invite_required" });
    expect(
      await gate(
        {
          user: { email: "root@example.test", emailVerified: true },
          source: { action: "create-user", method: "email-otp" },
        },
        ctxWithCookies({}),
      ),
    ).toBeUndefined();
    expect(
      await gate(
        {
          user: { email: "new@x.test", emailVerified: false },
          source: { action: "create-user", method: "admin" },
        },
        ctxWithCookies({}),
      ),
    ).toBeUndefined();
  });

  it("rejects invalid/expired/redeemed/email-bound codes with invite_required", async () => {
    for (const status of ["unknown", "expired", "redeemed", "email-mismatch"] as const) {
      const { auth } = compose({
        serverConfig: inviteOnlyConfig,
        validateCode: vi.fn(async () => status),
      });
      const result = await auth.user!.validateUserInfo(
        {
          user: { email: "new@x.test", emailVerified: true },
          source: { action: "create-user", method: "oauth" },
        },
        ctxWithCookies({ supastack_invite: "code9" }),
      );
      expect(result).toMatchObject({ error: "invite_required" });
    }
  });

  it("does not require an invite for admin-created users, email-OTP sign-ins, or ADMIN_EMAILS", async () => {
    const validateCode = vi.fn(async () => "unknown" as const);
    const { auth } = compose({ serverConfig: inviteOnlyConfig, validateCode });
    const gate = auth.user!.validateUserInfo;
    const ctx = ctxWithCookies({});

    expect(
      await gate(
        { user: { email: "x@x.test" }, source: { action: "create-user", method: "admin" } },
        ctx,
      ),
    ).toBeUndefined();
    expect(
      await gate(
        { user: { email: "x@x.test" }, source: { action: "sign-in", method: "email-otp" } },
        ctx,
      ),
    ).toBeUndefined();
    expect(
      await gate(
        {
          user: { email: "Root@Example.Test" },
          source: { action: "create-user", method: "email-password" },
        },
        ctx,
      ),
    ).toBeUndefined();
    expect(validateCode).not.toHaveBeenCalled();
  });

  it("allows creation without an invite when invite-only is off", async () => {
    const { auth } = compose({ serverConfig: openConfig });
    expect(
      await auth.user!.validateUserInfo({
        user: { email: "new@example.test" },
        source: { action: "create-user", method: "email-password" },
      }),
    ).toBeUndefined();
  });

  it("forwards sanitized invite/referral cookies to onCreated after provisioning", async () => {
    const onCreated = vi.fn(async () => undefined);
    const { auth } = compose({ serverConfig: openConfig, onCreated });
    await auth.databaseHooks.user.create.after(
      { id: "u1", email: "new@x.test", emailVerified: true },
      ctxWithCookies({ supastack_invite: "CODE9", supastack_ref: "Ref42" }),
    );
    expect(onCreated).toHaveBeenCalledWith({
      user: { id: "u1", email: "new@x.test" },
      invite: "code9",
      referral: "ref42",
    });
  });

  it("passes null codes to onCreated for a cookie-less request context", async () => {
    const onCreated = vi.fn(async () => undefined);
    const { auth } = compose({ serverConfig: openConfig, onCreated });
    await auth.databaseHooks.user.create.after(
      { id: "u1", email: "n@x.test", emailVerified: true },
      null,
    );
    expect(onCreated).toHaveBeenCalledWith({
      user: { id: "u1", email: "n@x.test" },
      invite: null,
      referral: null,
    });
  });

  it("does not provision or redeem invite effects for an unverified created row", async () => {
    const { auth, earlyAccess, provisionPersonalWorkspace } = compose({ serverConfig: openConfig });
    await auth.databaseHooks.user.create.after(
      { id: "u1", email: "new@x.test", emailVerified: false },
      ctxWithCookies({ supastack_invite: "CODE9", supastack_ref: "Ref42" }),
    );
    expect(provisionPersonalWorkspace).not.toHaveBeenCalled();
    expect(earlyAccess.onCreated).not.toHaveBeenCalled();
  });

  it("provisions a personal workspace after a mailbox proof verifies a prior row", async () => {
    const { auth, provisionPersonalWorkspace } = compose({ serverConfig: openConfig });
    const findUserById = vi.fn(async () => ({
      id: "u1",
      email: "new@x.test",
      emailVerified: true,
      banned: false,
      role: "user",
    }));

    await auth.databaseHooks.user.update.after(
      { id: "u1", emailVerified: true },
      { context: { internalAdapter: { findUserById } } },
    );

    expect(provisionPersonalWorkspace).toHaveBeenCalledWith({ id: "u1" });
  });
});
