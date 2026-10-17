import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ default: vi.fn((config) => config) }));

import { account, user } from "@supastack/db";
import { hashPassword } from "better-auth/crypto";

import { createAuthJs, linkAuthJsSocialUser } from "./authjs-runtime";

function fakeDatabase(
  existingEmailUser: { id: string; [key: string]: unknown } | undefined,
  linkedUserId?: string,
  /** Tables whose insert always loses a uniqueness race (conflict skips the write). */
  conflictedInserts: ReadonlySet<"account" | "user"> = new Set(),
) {
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const updates: { table: unknown; values: Record<string, unknown> }[] = [];
  // Row stores make the transaction read-your-writes: landed inserts become
  // visible to later findFirst calls, matching read-committed snapshots.
  const accountRows: Record<string, unknown>[] =
    linkedUserId === undefined
      ? []
      : [{ accountId: "github-user-2", issuer: "authjs:github", userId: linkedUserId }];
  const userRows: Record<string, unknown>[] =
    existingEmailUser === undefined
      ? []
      : [
          {
            banned: false,
            email: "member@example.test",
            emailVerified: true,
            role: "user",
            ...existingEmailUser,
          },
        ];
  const findAccountLink = vi.fn(async () => accountRows[0]);
  const findUserByEmail = vi.fn(async (input?: { where: unknown }) => {
    const conditions = Array.isArray(input?.where) ? input.where : [input?.where];
    const matches = (row: Record<string, unknown>) =>
      conditions.every((condition) => {
        if (typeof condition !== "object" || condition === null || !("field" in condition))
          return true;
        const item = condition as { field: { name: string }; value: unknown };
        return row[item.field.name] === item.value;
      });
    return (
      userRows.find(matches) ??
      (conditions.some(
        (condition) =>
          typeof condition === "object" &&
          condition !== null &&
          "field" in condition &&
          (condition as { field: { name: string } }).field.name === "id",
      )
        ? undefined
        : userRows[0])
    );
  });
  const tx = {
    query: {
      account: { findFirst: findAccountLink },
      user: { findFirst: findUserByEmail },
    },
    insert: vi.fn((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        const landed = () => {
          inserts.push({ table, values });
          if (table === account) accountRows.push(values);
          if (table === user) userRows.push(values);
        };
        const conflicts =
          (table === account && conflictedInserts.has("account")) ||
          (table === user && conflictedInserts.has("user"));
        let skipInsert = false;
        const query = {
          onConflictDoNothing: vi.fn(() => {
            skipInsert = conflicts;
            return query;
          }),
          returning: vi.fn(async () => {
            if (!skipInsert) landed();
            return skipInsert ? [] : [{ id: values.id }];
          }),
          then(onFulfilled?: () => void) {
            if (!skipInsert) landed();
            return Promise.resolve().then(onFulfilled);
          },
        };
        return query;
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updates.push({ table, values });
          if (table === user && userRows[0] !== undefined) {
            Object.assign(userRows[0], values);
          }
        }),
      }),
    })),
  };
  const database = {
    ...tx,
    transaction: vi.fn(async (run: (transaction: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const transaction = vi.fn(async (operation: (tx: typeof database) => Promise<unknown>) =>
    operation(database),
  );
  return {
    accountRows,
    database: { ...database, transaction },
    findAccountLink,
    findUserByEmail,
    inserts,
    updates,
    userRows,
  };
}

const config = {
  admin: { emails: ["admin@example.test"] },
  earlyAccess: { inviteOnly: false },
} as Parameters<typeof linkAuthJsSocialUser>[1];

const serverConfig = {
  admin: { emails: ["admin@example.test"] },
  auth: {
    providers: {
      apple: { clientId: "", clientSecret: "", enabled: false },
      github: { clientId: "", clientSecret: "", enabled: false },
      google: { clientId: "", clientSecret: "", enabled: false },
      microsoft: { clientId: "", clientSecret: "", enabled: false },
      twitter: { clientId: "", clientSecret: "", enabled: false },
    },
    secret: "test-secret",
  },
  earlyAccess: { inviteOnly: false },
} as unknown as Parameters<typeof createAuthJs>[0]["serverConfig"];

const inviteOnlyServerConfig = {
  ...serverConfig,
  earlyAccess: { inviteOnly: true },
} as Parameters<typeof createAuthJs>[0]["serverConfig"];

const identity = {
  email: "victim@example.test",
  emailVerified: false,
  name: "Visitor",
  provider: "github",
  providerAccountId: "github-user-2",
};

describe("Auth.js social account linking", () => {
  it("does not attach an unverified email to an existing local user", async () => {
    const { database, inserts } = fakeDatabase({ id: "victim" });
    await expect(linkAuthJsSocialUser(database as never, config, identity)).resolves.toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("links a verified provider identity to an existing local user", async () => {
    const { database, inserts, updates, userRows } = fakeDatabase({
      banned: false,
      email: "admin@example.test",
      emailVerified: true,
      id: "victim",
      role: "user",
    });
    await expect(
      linkAuthJsSocialUser(database as never, config, {
        ...identity,
        email: "admin@example.test",
        emailVerified: true,
      }),
    ).resolves.toEqual({ id: "victim" });
    expect(updates).toContainEqual({
      table: user,
      values: { role: "admin" },
    });
    expect(userRows[0]).toMatchObject({ emailVerified: true, role: "admin" });
    expect(inserts).toContainEqual({
      table: account,
      values: expect.objectContaining({
        accountId: "github-user-2",
        issuer: "authjs:github",
        userId: "victim",
      }),
    });
  });

  it("does not activate or link a legacy unverified credential identity", async () => {
    const legacyCredential = {
      providerId: "credential",
      userId: "victim",
      password: "attacker-controlled-password-hash",
    };
    const { database, inserts, updates, userRows } = fakeDatabase({
      banned: false,
      email: "admin@example.test",
      emailVerified: false,
      id: "victim",
      role: "user",
    });
    await expect(
      linkAuthJsSocialUser(database as never, config, {
        ...identity,
        email: "admin@example.test",
        emailVerified: true,
      }),
    ).resolves.toBeNull();

    expect(userRows[0]).toMatchObject({ emailVerified: false, role: "user" });
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
    expect(legacyCredential).toMatchObject({
      password: "attacker-controlled-password-hash",
      providerId: "credential",
      userId: "victim",
    });
  });

  it("uses an existing provider link even if its email claim changes", async () => {
    const { database, inserts } = fakeDatabase({ id: "linked-user" }, "linked-user");
    await expect(linkAuthJsSocialUser(database as never, config, identity)).resolves.toEqual({
      id: "linked-user",
    });
    expect(inserts).toHaveLength(0);
  });

  it("denies a stale provider link removed while the mailbox owner recovers a legacy user", async () => {
    const { accountRows, database, findUserByEmail, userRows } = fakeDatabase(
      { emailVerified: false, id: "legacy-user" },
      "legacy-user",
    );
    findUserByEmail.mockImplementationOnce(async () => {
      // The email-code activation deletes attacker-created links before
      // verifying the recovered user. READ COMMITTED sees that new user
      // state even when the earlier provider-link read was stale.
      accountRows.splice(0);
      userRows[0]!.emailVerified = true;
      return userRows[0];
    });
    await expect(linkAuthJsSocialUser(database as never, config, identity)).resolves.toBeNull();
  });

  it("denies a new unverified email claim without creating a user row", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    await expect(linkAuthJsSocialUser(database as never, config, identity)).resolves.toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("denies a social identity that carries no email claim at all", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    await expect(
      linkAuthJsSocialUser(database as never, config, {
        ...identity,
        email: null,
        emailVerified: true,
      }),
    ).resolves.toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("creates a verified local user for a new verified email claim", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    await expect(
      linkAuthJsSocialUser(database as never, config, {
        ...identity,
        email: "admin@example.test",
        emailVerified: true,
      }),
    ).resolves.toMatchObject({ id: expect.stringMatching(/^usr_/) });
    expect(inserts).toContainEqual({
      table: user,
      values: expect.objectContaining({ email: "admin@example.test", emailVerified: true }),
    });
    expect(inserts).toContainEqual({
      table: account,
      values: expect.objectContaining({
        accountId: "github-user-2",
        issuer: "authjs:github",
        providerId: "github",
      }),
    });
  });

  it("returns the winning link when a concurrent sign-in wins the account race", async () => {
    // A doubled OAuth callback: the winner commits its account link between
    // our first read and our insert, so the insert conflicts on
    // `idx_account_issuer_account` and is skipped — the re-read must yield the
    // winner's user, not throw a 23505.
    const { accountRows, database, findAccountLink, findUserByEmail, userRows } = fakeDatabase(
      { id: "victim" },
      undefined,
      new Set(["account"]),
    );
    findAccountLink.mockImplementationOnce(async () => {
      accountRows.push({
        accountId: "github-user-2",
        issuer: "authjs:github",
        userId: "usr_winner",
      });
      return undefined;
    });
    findUserByEmail
      .mockImplementationOnce(async () => userRows[0])
      .mockImplementationOnce(async () => ({
        banned: false,
        emailVerified: true,
        id: "usr_winner",
      }));
    await expect(
      linkAuthJsSocialUser(database as never, config, { ...identity, emailVerified: true }),
    ).resolves.toEqual({ id: "usr_winner" });
    expect(findAccountLink).toHaveBeenCalledTimes(2);
  });

  it("adopts the winning user when a concurrent sign-in wins the email race", async () => {
    // Two providers racing one email: our user insert conflicts on
    // `idx_user_email`, so the winner's row owns the identity and our account
    // link must point at it.
    const { database, findUserByEmail, inserts, userRows } = fakeDatabase(
      undefined,
      undefined,
      new Set(["user"]),
    );
    findUserByEmail.mockImplementationOnce(async () => {
      userRows.push({ banned: false, emailVerified: true, id: "usr_winner" });
      return undefined;
    });
    await expect(
      linkAuthJsSocialUser(database as never, config, { ...identity, emailVerified: true }),
    ).resolves.toEqual({ id: "usr_winner" });
    expect(inserts.some((insert) => insert.table === user)).toBe(false);
    expect(inserts).toContainEqual({
      table: account,
      values: expect.objectContaining({ issuer: "authjs:github", userId: "usr_winner" }),
    });
  });

  it("throws when the conflicting row never materializes on re-read", async () => {
    // Our insert was skipped on conflict but no winner committed either — the
    // identity cannot be resolved, so the transaction must surface the error.
    const { database } = fakeDatabase({ id: "victim" }, undefined, new Set(["account"]));
    await expect(
      linkAuthJsSocialUser(database as never, config, { ...identity, emailVerified: true }),
    ).rejects.toThrow("could not resolve its account link");
  });
});

type TestAuthConfig = {
  callbacks: {
    jwt: (args: {
      token: Record<string, unknown>;
      user?: { id?: string | undefined } | undefined;
    }) => Promise<Record<string, unknown>>;
    session: (args: {
      session: { user: Record<string, unknown> };
      token: Record<string, unknown>;
    }) => Promise<{ user: Record<string, unknown> }>;
    signIn: (args: {
      account:
        { access_token?: string; provider: string; providerAccountId?: string } | null | undefined;
      profile?: Record<string, unknown>;
      user: { email?: string | null; id?: string; image?: string | null; name?: string | null };
    }) => Promise<boolean>;
  };
};

type TestEarlyAccess = {
  cookies: { invite: string; referral: string };
  onCreated: ReturnType<typeof vi.fn>;
  sanitize: (value: string | null | undefined) => string | null;
  validateCode: ReturnType<typeof vi.fn>;
};

function createEarlyAccessHooks(): TestEarlyAccess {
  return {
    cookies: { invite: "supastack_invite", referral: "supastack_ref" },
    onCreated: vi.fn(async () => undefined),
    sanitize: (value) => {
      const code = value?.trim() ?? "";
      return /^[A-Za-z0-9_-]{1,120}$/.test(code) ? code : null;
    },
    validateCode: vi.fn(async ({ code, email }: { code: string; email: string }) =>
      code === "invite-good" && email === "new@example.test"
        ? "valid"
        : code === "invite-good"
          ? "email-mismatch"
          : "redeemed",
    ),
  };
}

function authConfig(
  database: unknown,
  options: Readonly<{
    earlyAccess?: TestEarlyAccess | undefined;
    request?: unknown;
    serverConfig?: Parameters<typeof createAuthJs>[0]["serverConfig"] | undefined;
  }> = {},
): TestAuthConfig {
  const result = createAuthJs({
    database: database as never,
    earlyAccess: options.earlyAccess,
    serverConfig: options.serverConfig ?? serverConfig,
  } as never) as unknown;
  const config =
    typeof result === "function"
      ? (result as (request: unknown) => unknown)(options.request)
      : result;
  return config as TestAuthConfig;
}

function requestWithCookies(cookies: Readonly<Record<string, string>>) {
  return {
    cookies: {
      get: (name: string) =>
        cookies[name] === undefined ? undefined : { name, value: cookies[name] },
    },
  };
}

describe("Auth.js sign-in callbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows the credentials provider without touching social linking", async () => {
    const { database } = fakeDatabase(undefined);
    const auth = authConfig(database);
    await expect(
      auth.callbacks.signIn({
        account: { provider: "credentials" },
        user: { email: "member@example.test", id: "usr_1" },
      }),
    ).resolves.toBe(true);
    expect(database.query.account.findFirst).not.toHaveBeenCalled();
    expect(database.query.user.findFirst).not.toHaveBeenCalled();
  });

  it("denies a social sign-in whose provider does not verify the email claim", async () => {
    const { database } = fakeDatabase({ id: "victim" });
    const auth = authConfig(database);
    await expect(
      auth.callbacks.signIn({
        account: { provider: "twitter", providerAccountId: "tw-1" },
        profile: {},
        user: { email: "victim@example.test" },
      }),
    ).resolves.toBe(false);
  });

  it("denies a new verified social user when invite-only mode has no invite cookie", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, { earlyAccess, serverConfig: inviteOnlyServerConfig });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-new" },
        profile: { email_verified: true },
        user: { email: "new@example.test" },
      }),
    ).resolves.toBe(false);

    expect(earlyAccess.validateCode).not.toHaveBeenCalled();
    expect(inserts).toHaveLength(0);
  });

  it("fails closed when invite-only mode has no injected validator", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const auth = authConfig(database, { serverConfig: inviteOnlyServerConfig });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-new" },
        profile: { email_verified: true },
        user: { email: "new@example.test" },
      }),
    ).resolves.toBe(false);

    expect(inserts).toHaveLength(0);
  });

  it("denies a new verified social user when the invite cookie is invalid", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, {
      earlyAccess,
      request: requestWithCookies({ supastack_invite: "invite-bad" }),
      serverConfig: inviteOnlyServerConfig,
    });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-new" },
        profile: { email_verified: true },
        user: { email: "new@example.test" },
      }),
    ).resolves.toBe(false);

    expect(earlyAccess.validateCode).toHaveBeenCalledWith({
      code: "invite-bad",
      email: "new@example.test",
    });
    expect(inserts).toHaveLength(0);
  });

  it("admits a new verified social user with a matching invite cookie and runs post-create hooks after commit", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, {
      earlyAccess,
      request: requestWithCookies({
        supastack_invite: "invite-good",
        supastack_ref: "referral-123",
      }),
      serverConfig: inviteOnlyServerConfig,
    });
    const profileUser: { email: string; id?: string } = { email: " New@Example.test " };

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-new" },
        profile: { email_verified: true },
        user: profileUser,
      }),
    ).resolves.toBe(true);

    expect(earlyAccess.validateCode).toHaveBeenCalledWith({
      code: "invite-good",
      email: "new@example.test",
    });
    expect(earlyAccess.onCreated).toHaveBeenCalledWith({
      invite: "invite-good",
      referral: "referral-123",
      user: { email: "new@example.test", id: profileUser.id },
    });
    expect(earlyAccess.onCreated.mock.invocationCallOrder[0]).toBeGreaterThan(
      database.transaction.mock.invocationCallOrder[0] ?? 0,
    );
    expect(inserts).toContainEqual({
      table: user,
      values: expect.objectContaining({ email: "new@example.test", emailVerified: true }),
    });
  });

  it("rejects an invite reserved for a different verified social email", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, {
      earlyAccess,
      request: requestWithCookies({ supastack_invite: "invite-good" }),
      serverConfig: inviteOnlyServerConfig,
    });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-other" },
        profile: { email_verified: true },
        user: { email: "other@example.test" },
      }),
    ).resolves.toBe(false);

    expect(earlyAccess.validateCode).toHaveBeenCalledWith({
      code: "invite-good",
      email: "other@example.test",
    });
    expect(inserts).toHaveLength(0);
  });

  it("preserves verified existing-user social sign-in without an invite in invite-only mode", async () => {
    const { database } = fakeDatabase({ email: "member@example.test", id: "member" });
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, { earlyAccess, serverConfig: inviteOnlyServerConfig });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-existing" },
        profile: { email_verified: true },
        user: { email: "member@example.test" },
      }),
    ).resolves.toBe(true);

    expect(earlyAccess.validateCode).not.toHaveBeenCalled();
  });

  it("preserves the ADMIN_EMAILS exemption for a new social user", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, { earlyAccess, serverConfig: inviteOnlyServerConfig });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-admin" },
        profile: { email_verified: true },
        user: { email: "admin@example.test" },
      }),
    ).resolves.toBe(true);

    expect(earlyAccess.validateCode).not.toHaveBeenCalled();
    expect(inserts).toContainEqual({
      table: user,
      values: expect.objectContaining({ email: "admin@example.test", role: "admin" }),
    });
  });

  it("preserves open-mode social signup without an invite", async () => {
    const { database, inserts } = fakeDatabase(undefined);
    const earlyAccess = createEarlyAccessHooks();
    const auth = authConfig(database, { earlyAccess });

    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-open" },
        profile: { email_verified: true },
        user: { email: "new@example.test" },
      }),
    ).resolves.toBe(true);

    expect(earlyAccess.validateCode).not.toHaveBeenCalled();
    expect(earlyAccess.onCreated).toHaveBeenCalledWith({
      invite: null,
      referral: null,
      user: expect.objectContaining({ email: "new@example.test" }),
    });
    expect(inserts).toContainEqual({
      table: user,
      values: expect.objectContaining({ email: "new@example.test", emailVerified: true }),
    });
  });

  it("does not treat a Microsoft email_verified profile flag as mailbox proof", async () => {
    const { database, inserts } = fakeDatabase({ id: "victim" });
    const auth = authConfig(database);
    await expect(
      auth.callbacks.signIn({
        account: { provider: "microsoft", providerAccountId: "ms-1" },
        profile: { email_verified: true },
        user: { email: "victim@example.test" },
      }),
    ).resolves.toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("denies an unverified GitHub claim when no access token can prove it", async () => {
    const { database } = fakeDatabase({ id: "victim" });
    const auth = authConfig(database);
    await expect(
      auth.callbacks.signIn({
        account: { provider: "github", providerAccountId: "gh-1" },
        profile: {},
        user: { email: "victim@example.test" },
      }),
    ).resolves.toBe(false);
  });

  it("verifies a GitHub email through the emails API when the profile omits the flag", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => [{ email: "victim@example.test", verified: true }],
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { database, inserts } = fakeDatabase({ id: "victim" });
    const auth = authConfig(database);
    const profileUser: { email: string; id?: string } = { email: "victim@example.test" };
    await expect(
      auth.callbacks.signIn({
        account: { access_token: "gho_token", provider: "github", providerAccountId: "gh-1" },
        profile: {},
        user: profileUser,
      }),
    ).resolves.toBe(true);
    expect(profileUser.id).toBe("victim");
    // The bearer token must never ride a redirect to another origin.
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(inserts).toContainEqual({
      table: account,
      values: expect.objectContaining({ issuer: "authjs:github", userId: "victim" }),
    });
  });

  it("propagates the resolved local user id through jwt and session callbacks", async () => {
    const { database } = fakeDatabase({ id: "victim" });
    const auth = authConfig(database);
    const profileUser: { email: string; id?: string } = { email: "victim@example.test" };
    await expect(
      auth.callbacks.signIn({
        account: { provider: "google", providerAccountId: "g-1" },
        profile: { email_verified: true },
        user: profileUser,
      }),
    ).resolves.toBe(true);
    expect(profileUser.id).toBe("victim");
    if (profileUser.id === undefined) throw new Error("Social sign-in did not resolve a user");

    const token = await auth.callbacks.jwt({ token: {}, user: { id: profileUser.id } });
    expect(token.userId).toBe("victim");
    expect(token.identityVersion).toBe("provider-account-v2");

    const session = await auth.callbacks.session({ session: { user: {} }, token });
    expect(session.user.id).toBe("victim");
  });

  it("refreshes role from the database and strips identity after a ban or verification change", async () => {
    const { database, userRows } = fakeDatabase({
      email: "admin@example.test",
      id: "usr_live",
      role: "admin",
    });
    const auth = authConfig(database);
    const { jwt, session } = auth.callbacks;
    const token = await jwt({ token: {}, user: { id: "usr_live" } });
    expect(token).toMatchObject({ role: "admin", userId: "usr_live" });

    userRows[0]!.role = "user";
    const freshSession = await session({ session: { user: {} }, token });
    expect(freshSession.user).toMatchObject({ id: "usr_live", role: "user" });

    userRows[0]!.banned = true;
    const revokedToken = await jwt({ token });
    expect(revokedToken.userId).toBeUndefined();
    expect(revokedToken.role).toBeUndefined();
    const revokedSession = await session({ session: { user: {} }, token });
    expect(revokedSession.user.id).toBeUndefined();
    expect(revokedSession.user.role).toBeUndefined();
  });

  it("never produces session.user.id without a linked userId", async () => {
    const { database } = fakeDatabase(undefined);
    const auth = authConfig(database);
    const token = await auth.callbacks.jwt({ token: {} });
    expect(token.userId).toBeUndefined();
    const denied = await auth.callbacks.session({ session: { user: {} }, token });
    expect(denied.user.id).toBeUndefined();
    const nonString = await auth.callbacks.session({
      session: { user: {} },
      token: { userId: 42 },
    });
    expect(nonString.user.id).toBeUndefined();
    const legacy = await auth.callbacks.session({
      session: { user: {} },
      token: { userId: "victim" },
    });
    expect(legacy.user.id).toBeUndefined();
  });

  it("strips stale sub and userId claims from unversioned legacy tokens", async () => {
    const { database } = fakeDatabase(undefined);
    const auth = authConfig(database);
    const token = await auth.callbacks.jwt({
      token: { sub: "stale-subject", userId: "stale-user" },
    });
    expect(token.sub).toBeUndefined();
    expect(token.userId).toBeUndefined();
  });
});

describe("Auth.js verified credentials", () => {
  it.each([
    { emailVerified: false, banned: false, allowed: false },
    { emailVerified: true, banned: true, allowed: false },
    { emailVerified: true, banned: false, allowed: true },
  ])(
    "accepts a correct password only for a verified active identity: %j",
    async ({ emailVerified, banned, allowed }) => {
      const password = "test-password-strong-123";
      const owner = {
        id: "credential-owner",
        name: "Owner",
        email: "owner@example.test",
        emailVerified,
        banned,
      };
      const database = {
        query: { user: { findFirst: vi.fn(async () => owner) } },
        select: () => ({
          from: () => ({
            where: () => ({ limit: async () => [{ password: await hashPassword(password) }] }),
          }),
        }),
      };
      const config = authConfig(database) as TestAuthConfig & {
        providers: Array<{
          options: { authorize(input: { email: string; password: string }): Promise<unknown> };
        }>;
      };
      const result = await config.providers[0]!.options.authorize({ email: owner.email, password });
      if (allowed) expect(result).toMatchObject({ id: owner.id });
      else expect(result).toBeNull();
    },
  );

  it("limits failed credentials attempts by normalized recipient before database verification", async () => {
    const findUser = vi.fn(async () => undefined);
    const database = {
      query: { user: { findFirst: findUser } },
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    };
    const auth = authConfig(database) as TestAuthConfig & {
      providers: Array<{
        options: { authorize(input: { email: string; password: string }): Promise<unknown> };
      }>;
    };
    const authorize = auth.providers[0]!.options.authorize;

    for (const email of [" Person@example.test ", "PERSON@example.test", "person@example.test"]) {
      expect(await authorize({ email, password: "wrong-password-123" })).toBeNull();
    }
    expect(findUser).toHaveBeenCalledTimes(3);
    expect(
      await authorize({ email: "person@example.test", password: "wrong-password-123" }),
    ).toBeNull();
    expect(findUser).toHaveBeenCalledTimes(3);
  });
});
