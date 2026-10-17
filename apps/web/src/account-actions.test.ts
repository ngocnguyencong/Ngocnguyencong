import type * as DrizzleOrm from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookies: vi.fn(),
  database: { transaction: vi.fn() },
  getAuthSession: vi.fn(),
  headers: vi.fn(),
  listSessions: vi.fn(),
  recordAuditEvent: vi.fn(),
  redirect: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: state.cookies,
  headers: state.headers,
}));

vi.mock("next/navigation", () => ({ redirect: state.redirect }));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
    eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
  };
});

vi.mock("./audit-runtime", () => ({ recordAuditEvent: state.recordAuditEvent }));

vi.mock("./auth-runtime", () => ({
  auth: {
    api: {
      listSessions: state.listSessions,
      revokeSession: state.revokeSession,
    },
  },
  database: state.database,
  getAuthSession: state.getAuthSession,
}));

import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { user, workspace, workspaceMembership } from "@supastack/db";
import { deleteAccountAction, listMySessions, revokeMySessionAction } from "./account-actions.js";

const requestHeaders = new Headers({ "x-test-user-id": "user-1" });
const now = new Date("2026-10-04T12:00:00.000Z");

function sessionRow(id: string, token: string) {
  return {
    createdAt: now,
    expiresAt: new Date("2026-10-05T12:00:00.000Z"),
    id,
    ipAddress: "192.0.2.10",
    token,
    userAgent: "Test browser",
  };
}

function formWithSessionId(sessionId: string): FormData {
  const form = new FormData();
  form.set("sessionId", sessionId);
  return form;
}

type TestCondition =
  | { conditions: TestCondition[]; kind: "and" }
  | { kind: "eq"; left: unknown; right: unknown }
  | undefined;

interface MockSelectBuilder extends PromiseLike<unknown[]> {
  for(mode: string): MockSelectBuilder;
  from(value: unknown): MockSelectBuilder;
  groupBy(...values: unknown[]): MockSelectBuilder;
  innerJoin(...values: unknown[]): MockSelectBuilder;
  limit(value?: number): MockSelectBuilder;
  orderBy(...values: unknown[]): MockSelectBuilder;
  select(fields: Record<string, unknown>): MockSelectBuilder;
  where(value: unknown): MockSelectBuilder;
}

interface MockDeleteBuilder extends PromiseLike<unknown> {
  where(value: unknown): MockDeleteBuilder;
}

interface MockTransaction {
  delete(table: unknown): MockDeleteBuilder;
  execute(query: SQL): Promise<void>;
  select(selection: Record<string, unknown>): MockSelectBuilder;
}

function equalityValue(condition: TestCondition, column: unknown): unknown {
  if (condition?.kind === "eq") return condition.left === column ? condition.right : undefined;
  if (condition?.kind === "and") {
    for (const child of condition.conditions) {
      const value = equalityValue(child, column);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function createConcurrentOwnerDatabase(beforeUpdateLock?: (userId: string) => void) {
  const users = new Map([
    ["owner-a", { email: "owner-a@example.test" }],
    ["owner-b", { email: "owner-b@example.test" }],
  ]);
  const workspaces = new Map([
    ["org-shared", "organization"],
    ["personal-a", "personal"],
    ["personal-b", "personal"],
  ]);
  const memberships = [
    {
      id: "membership-a-org",
      role: "owner",
      userId: "owner-a",
      workspaceId: "org-shared",
    },
    {
      id: "membership-b-org",
      role: "owner",
      userId: "owner-b",
      workspaceId: "org-shared",
    },
    {
      id: "membership-a-personal",
      role: "owner",
      userId: "owner-a",
      workspaceId: "personal-a",
    },
    {
      id: "membership-b-personal",
      role: "owner",
      userId: "owner-b",
      workspaceId: "personal-b",
    },
  ];
  const events: string[] = [];
  const queuedLocks = new Map<string, Promise<void>>();
  let waitingOwnerReads = 0;
  let releaseOwnerReadBarrier: (() => void) | undefined;
  const ownerReadBarrier = new Promise<void>((resolve) => {
    releaseOwnerReadBarrier = resolve;
  });

  async function acquireLock(key: string, releases: Array<() => void>) {
    const previous = queuedLocks.get(key) ?? Promise.resolve();
    let unlock!: () => void;
    const current = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    queuedLocks.set(key, current);
    await previous;
    releases.push(() => {
      unlock();
      if (queuedLocks.get(key) === current) queuedLocks.delete(key);
    });
  }

  function createSelectBuilder(
    transactional: boolean,
    releases: Array<() => void>,
    acquiredLocks: Set<string>,
  ): MockSelectBuilder {
    let table: unknown;
    let condition: TestCondition;
    let joinedWorkspace = false;
    let lockMode: string | undefined;
    let selection: Record<string, unknown> = {};
    const builder: MockSelectBuilder = {
      from(value: unknown) {
        table = value;
        return builder;
      },
      for(mode: string) {
        lockMode = mode;
        return builder;
      },
      groupBy() {
        return builder;
      },
      innerJoin() {
        joinedWorkspace = true;
        return builder;
      },
      limit() {
        return builder;
      },
      orderBy() {
        return builder;
      },
      select(fields: Record<string, unknown>) {
        selection = fields;
        return builder;
      },
      where(value: TestCondition) {
        condition = value;
        return builder;
      },
      then<TResult1 = unknown[], TResult2 = never>(
        onFulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ): PromiseLike<TResult1 | TResult2> {
        const operation = async () => {
          if (table === user) {
            const userId = String(equalityValue(condition, user.id));
            if (lockMode !== undefined) {
              events.push(`user-lock:${lockMode}:${userId}`);
              if (lockMode === "update") beforeUpdateLock?.(userId);
              const lockKey = `user:${userId}`;
              if (!acquiredLocks.has(lockKey)) {
                await acquireLock(lockKey, releases);
                acquiredLocks.add(lockKey);
              }
            }
            const account = users.get(userId);
            return account === undefined ? [] : [{ email: account.email }];
          }

          if (table !== workspaceMembership) return [];
          if (joinedWorkspace) {
            const userId = String(equalityValue(condition, workspaceMembership.userId));
            events.push(`membership-read:${userId}:${transactional ? "tx" : "plain"}`);
            return memberships
              .filter((membership) => membership.userId === userId)
              .map((membership) => ({
                role: membership.role,
                workspaceId: membership.workspaceId,
                workspaceType: workspaces.get(membership.workspaceId),
              }));
          }

          if ("count" in selection) {
            const workspaceId = String(equalityValue(condition, workspaceMembership.workspaceId));
            const role = equalityValue(condition, workspaceMembership.role);
            if (!transactional) {
              waitingOwnerReads += 1;
              if (waitingOwnerReads === 2) releaseOwnerReadBarrier?.();
              await ownerReadBarrier;
            }
            events.push(`owner-count:${workspaceId}:${transactional ? "tx" : "plain"}`);
            return memberships
              .filter(
                (membership) => membership.workspaceId === workspaceId && membership.role === role,
              )
              .map((membership) => ({ count: membership.id }));
          }
          return [];
        };
        return Promise.resolve().then(operation).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  function createDeleteBuilder(table: unknown): MockDeleteBuilder {
    let condition: TestCondition;
    const builder: MockDeleteBuilder = {
      where(value: TestCondition) {
        condition = value;
        return builder;
      },
      then<TResult1 = unknown, TResult2 = never>(
        onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null | undefined,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
      ): PromiseLike<TResult1 | TResult2> {
        const operation = async () => {
          if (table === workspace) {
            const workspaceId = String(equalityValue(condition, workspace.id));
            events.push(`delete-workspace:${workspaceId}`);
            workspaces.delete(workspaceId);
            for (let index = memberships.length - 1; index >= 0; index -= 1) {
              if (memberships[index]?.workspaceId === workspaceId) memberships.splice(index, 1);
            }
          } else if (table === user) {
            const userId = String(equalityValue(condition, user.id));
            events.push(`delete-user:${userId}`);
            users.delete(userId);
            for (let index = memberships.length - 1; index >= 0; index -= 1) {
              if (memberships[index]?.userId === userId) memberships.splice(index, 1);
            }
          }
          return undefined;
        };
        return Promise.resolve().then(operation).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const plainDatabase = {
    delete(table: unknown) {
      return createDeleteBuilder(table);
    },
    select(selection: Record<string, unknown>) {
      const builder = createSelectBuilder(false, [], new Set());
      return builder.select(selection);
    },
  };
  const database = {
    ...plainDatabase,
    async transaction<Result>(operation: (transaction: MockTransaction) => Promise<Result>) {
      const releases: Array<() => void> = [];
      const acquiredLocks = new Set<string>();
      const transaction: MockTransaction = {
        ...plainDatabase,
        async execute(query: SQL) {
          const statement = new PgDialect().sqlToQuery(query);
          expect(statement.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1, 0))");
          const [lockKey] = statement.params;
          const acquiredKey = `advisory:${String(lockKey)}`;
          events.push(`advisory-lock:${String(lockKey)}`);
          if (!acquiredLocks.has(acquiredKey)) {
            await acquireLock(acquiredKey, releases);
            acquiredLocks.add(acquiredKey);
          }
        },
        select(selection: Record<string, unknown>) {
          const builder = createSelectBuilder(true, releases, acquiredLocks);
          return builder.select(selection);
        },
      };
      try {
        return await operation(transaction);
      } finally {
        for (const release of releases.reverse()) release();
      }
    },
  };

  return { database, events, memberships, users, workspaces };
}

describe("account session actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.headers.mockResolvedValue(requestHeaders);
    state.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    state.cookies.mockResolvedValue({
      delete: vi.fn(),
      get: (name: string) =>
        name === "better-auth.session_token" ? { value: "current-token" } : undefined,
    });
    state.listSessions.mockResolvedValue([
      sessionRow("session-current", "current-token"),
      sessionRow("session-other", "other-session-bearer"),
    ]);
    state.revokeSession.mockResolvedValue(undefined);
    state.recordAuditEvent.mockResolvedValue(undefined);
    state.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  it("returns session display rows without bearer tokens", async () => {
    await expect(listMySessions()).resolves.toEqual([
      {
        createdAt: now,
        current: true,
        expiresAt: new Date("2026-10-05T12:00:00.000Z"),
        id: "session-current",
        ipAddress: "192.0.2.10",
        userAgent: "Test browser",
      },
      {
        createdAt: now,
        current: false,
        expiresAt: new Date("2026-10-05T12:00:00.000Z"),
        id: "session-other",
        ipAddress: "192.0.2.10",
        userAgent: "Test browser",
      },
    ]);
  });

  it("refuses to revoke a session ID outside the request user's session list", async () => {
    await expect(revokeMySessionAction(formWithSessionId("session-someone-else"))).rejects.toThrow(
      "REDIRECT:/settings/security?status=invalid",
    );

    expect(state.listSessions).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(state.revokeSession).not.toHaveBeenCalled();
  });

  it("resolves the request user's opaque session ID to its token only on the server", async () => {
    await expect(revokeMySessionAction(formWithSessionId("session-other"))).rejects.toThrow(
      "REDIRECT:/settings/security?status=session-revoked",
    );

    expect(state.revokeSession).toHaveBeenCalledWith({
      body: { token: "other-session-bearer" },
      headers: requestHeaders,
    });
  });

  it("serializes concurrent deletion by the last two organization owners", async () => {
    const fake = createConcurrentOwnerDatabase();
    Object.assign(state.database, fake.database);
    state.database.transaction = vi.fn(fake.database.transaction);
    const requestUserIds = ["owner-a", "owner-b"];
    state.headers.mockImplementation(
      async () => new Headers({ "x-test-user-id": requestUserIds.shift() ?? "owner-a" }),
    );
    state.getAuthSession.mockImplementation(async (headers: Headers) => ({
      user: { id: headers.get("x-test-user-id") ?? "" },
    }));

    const first = new FormData();
    first.set("confirm", "owner-a@example.test");
    const second = new FormData();
    second.set("confirm", "owner-b@example.test");
    const results = await Promise.allSettled([
      deleteAccountAction(first),
      deleteAccountAction(second),
    ]);

    expect(results).toHaveLength(2);
    expect(fake.users.size).toBe(1);
    expect(
      fake.memberships.filter(
        (membership) => membership.workspaceId === "org-shared" && membership.role === "owner",
      ),
    ).toHaveLength(1);
    expect(fake.workspaces.has("org-shared")).toBe(true);
    expect(state.database.transaction).toHaveBeenCalledTimes(2);
    expect(state.recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(state.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "account.self_deleted", actorUserId: null }),
    );
    expect(state.redirect.mock.calls.map(([path]) => path).sort()).toEqual([
      "/auth?status=account-deleted",
      "/settings/security?status=sole-owner",
    ]);
  });

  it("retries when an unseen workspace membership appears before the update lock", async () => {
    let inserted = false;
    const fake = createConcurrentOwnerDatabase((userId) => {
      if (userId !== "owner-a" || inserted) return;
      inserted = true;
      fake.workspaces.set("org-late", "organization");
      fake.memberships.push({
        id: "membership-a-late-org",
        role: "owner",
        userId: "owner-a",
        workspaceId: "org-late",
      });
    });
    Object.assign(state.database, fake.database);
    state.database.transaction = vi.fn(fake.database.transaction);
    state.headers.mockResolvedValue(new Headers({ "x-test-user-id": "owner-a" }));
    state.getAuthSession.mockResolvedValue({ user: { id: "owner-a" } });
    const form = new FormData();
    form.set("confirm", "owner-a@example.test");

    await expect(deleteAccountAction(form)).rejects.toThrow(
      "REDIRECT:/settings/security?status=sole-owner",
    );

    expect(inserted).toBe(true);
    expect(state.database.transaction).toHaveBeenCalledTimes(2);
    expect(fake.events).toContain("advisory-lock:workspace-seats:org-late");
    expect(fake.users.has("owner-a")).toBe(true);
    expect(fake.workspaces.has("org-late")).toBe(true);
  });

  it("fails closed after three membership-snapshot retries", async () => {
    let inserted = 0;
    const fake = createConcurrentOwnerDatabase((userId) => {
      if (userId !== "owner-a") return;
      inserted += 1;
      const workspaceId = `org-late-${inserted}`;
      fake.workspaces.set(workspaceId, "organization");
      fake.memberships.push({
        id: `membership-a-${workspaceId}`,
        role: "owner",
        userId: "owner-a",
        workspaceId,
      });
    });
    Object.assign(state.database, fake.database);
    state.database.transaction = vi.fn(fake.database.transaction);
    state.headers.mockResolvedValue(new Headers({ "x-test-user-id": "owner-a" }));
    state.getAuthSession.mockResolvedValue({ user: { id: "owner-a" } });
    const form = new FormData();
    form.set("confirm", "owner-a@example.test");

    await expect(deleteAccountAction(form)).rejects.toThrow(
      "REDIRECT:/settings/security?status=retry",
    );

    expect(inserted).toBe(3);
    expect(state.database.transaction).toHaveBeenCalledTimes(3);
    expect(fake.users.has("owner-a")).toBe(true);
    expect(state.recordAuditEvent).not.toHaveBeenCalled();
  });
});
