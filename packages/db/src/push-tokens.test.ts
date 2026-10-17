import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { devicePushToken } from "./schema.js";
import {
  createDrizzlePushTokenRepository,
  MAX_PUSH_TOKENS_PER_USER,
  PUSH_TOKEN_LIST_LIMIT,
  type RegisterPushTokenInput,
} from "./push-tokens.js";

const dialect = new PgDialect();

const BASE_REGISTER: RegisterPushTokenInput = {
  platform: "ios",
  token: "ExponentPushToken[abc123]",
  userId: "user_1",
  workspaceId: "ws_1",
} as const;

function render(where: unknown): { params: unknown[]; sql: string } {
  const rendered = dialect.sqlToQuery(where as SQL);
  return { params: rendered.params, sql: rendered.sql };
}

/**
 * Captures the insert/delete/select chains without a database. `where`
 * clauses are rendered through PgDialect so scoping is asserted on the
 * generated SQL, not on opaque drizzle internals.
 */
function createCapturingDatabase() {
  const calls: {
    conflictSet?: Record<string, unknown>;
    conflictTarget?: unknown;
    deleteResult?: { id: string }[];
    deleteWhere?: { params: unknown[]; sql: string };
    insertResult?: unknown[];
    insertValues?: Record<string, unknown>;
    limit?: number;
    offset?: number;
    orderBy?: number;
    selectResult?: unknown[];
    selectWhere?: { params: unknown[]; sql: string };
  } = {};
  const database = {
    delete() {
      return {
        where(where: unknown) {
          calls.deleteWhere = render(where);
          return {
            async returning() {
              return calls.deleteResult ?? [];
            },
          };
        },
      };
    },
    insert() {
      return {
        values(values: Record<string, unknown>) {
          calls.insertValues = values;
          return {
            onConflictDoUpdate(conflict: { set: Record<string, unknown>; target: unknown }) {
              calls.conflictSet = conflict.set;
              calls.conflictTarget = conflict.target;
              return {
                async returning() {
                  return calls.insertResult ?? [];
                },
              };
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return {
            where(where: unknown) {
              calls.selectWhere = render(where);
              const query = {
                orderBy(...orderings: unknown[]) {
                  calls.orderBy = orderings.length;
                  return query;
                },
                limit(value: number) {
                  calls.limit = value;
                  return query;
                },
                offset(value: number) {
                  calls.offset = value;
                  return query;
                },
                then(onFulfilled: (rows: unknown[]) => unknown) {
                  return Promise.resolve(calls.selectResult ?? []).then(onFulfilled);
                },
              };
              return query;
            },
          };
        },
      };
    },
  };
  return { calls, database: database as never };
}

describe("device_push_token schema", () => {
  it("uses the expected table name and unique token index", () => {
    expect(getTableName(devicePushToken)).toBe("device_push_token");
    const config = getTableConfig(devicePushToken);
    const indexNames = config.indexes.map((index) => index.config.name);
    expect(indexNames).toEqual(
      expect.arrayContaining([
        "idx_device_push_token_token",
        "idx_device_push_token_user",
        "idx_device_push_token_workspace",
      ]),
    );
    expect(
      config.indexes.find((i) => i.config.name === "idx_device_push_token_token")?.config.unique,
    ).toBe(true);
  });
});

describe("drizzle push token repository", () => {
  it("exports the repository factory", () => {
    expect(createDrizzlePushTokenRepository).toEqual(expect.any(Function));
  });

  it("validates register input before touching the database", async () => {
    const repository = createDrizzlePushTokenRepository(null as never);

    await expect(repository.register(null as never)).rejects.toThrow();
    for (const token of ["", "   ", "t".repeat(256), 42] as never[]) {
      await expect(repository.register({ ...BASE_REGISTER, token })).rejects.toThrow();
    }
    for (const platform of ["", "windows", 7] as never[]) {
      await expect(repository.register({ ...BASE_REGISTER, platform })).rejects.toThrow();
    }
    await expect(repository.register({ ...BASE_REGISTER, userId: "" })).rejects.toThrow();
    await expect(repository.register({ ...BASE_REGISTER, workspaceId: " " })).rejects.toThrow();
  });

  it("validates unregister/list/remove inputs before touching the database", async () => {
    const repository = createDrizzlePushTokenRepository(null as never);

    await expect(repository.unregister({ token: "t", userId: "" })).rejects.toThrow();
    await expect(repository.unregister({ token: "", userId: "u" })).rejects.toThrow();
    await expect(repository.listForUser("")).rejects.toThrow();
    await expect(repository.listForWorkspace(" ")).rejects.toThrow();
    await expect(repository.listForUsers(["u", ""])).rejects.toThrow();
    await expect(repository.removeTokens(["ok", ""])).rejects.toThrow();
  });

  it("registers via an upsert keyed on the unique token column", async () => {
    const row = {
      createdAt: new Date("2026-10-10T00:00:00.000Z"),
      id: "dpt_1",
      lastSeenAt: new Date("2026-10-10T00:00:00.000Z"),
      platform: "ios",
      token: BASE_REGISTER.token,
      userId: "user_1",
      workspaceId: "ws_1",
    };
    const { calls, database } = createCapturingDatabase();
    calls.insertResult = [row];
    const repository = createDrizzlePushTokenRepository(database);

    await expect(repository.register(BASE_REGISTER)).resolves.toBe(row);
    expect(calls.insertValues).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        lastSeenAt: expect.any(Date),
        platform: "ios",
        token: BASE_REGISTER.token,
        userId: "user_1",
        workspaceId: "ws_1",
      }),
    );
    // Conflict re-points the same token at the registering user/workspace —
    // a reinstall or account switch updates the row instead of duplicating it.
    expect(calls.conflictTarget).toBe(devicePushToken.token);
    expect(Object.keys(calls.conflictSet ?? {}).sort()).toEqual([
      "lastSeenAt",
      "platform",
      "userId",
      "workspaceId",
    ]);
  });

  it("trims token whitespace before persisting or deleting", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.insertResult = [{ id: "dpt_1" }];
    const repository = createDrizzlePushTokenRepository(database);

    await repository.register({ ...BASE_REGISTER, token: "  ExponentPushToken[abc123]  " });
    expect(calls.insertValues).toEqual(
      expect.objectContaining({ token: "ExponentPushToken[abc123]" }),
    );

    await repository.unregister({ token: "  ExponentPushToken[abc123]  ", userId: "user_1" });
    expect(calls.deleteWhere?.params).toEqual(["ExponentPushToken[abc123]", "user_1"]);
  });

  it("prunes the caller's oldest-seen tokens past the per-user cap on register", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.insertResult = [{ id: "dpt_new" }];
    calls.selectResult = [
      { token: "ExponentPushToken[old1]" },
      { token: "ExponentPushToken[old2]" },
    ];
    const repository = createDrizzlePushTokenRepository(database);

    await repository.register(BASE_REGISTER);
    // Overflow select: the user's other tokens newest-seen first, skipping
    // the budget the freshly upserted row leaves (MAX - 1).
    expect(calls.offset).toBe(MAX_PUSH_TOKENS_PER_USER - 1);
    expect(calls.selectWhere?.sql).toContain("user_id");
    expect(calls.selectWhere?.sql).toContain("token");
    expect(calls.deleteWhere?.sql).toContain("token");
    expect(calls.deleteWhere?.params).toEqual([
      "ExponentPushToken[old1]",
      "ExponentPushToken[old2]",
    ]);
  });

  it("does not prune when no rows exceed the cap", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.insertResult = [{ id: "dpt_1" }];
    calls.selectResult = [];
    const repository = createDrizzlePushTokenRepository(database);

    await repository.register(BASE_REGISTER);
    expect(calls.deleteWhere).toBeUndefined();
  });

  it("lets injected createId/now drive the insert for deterministic ids", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.insertResult = [{ id: "dpt_fixed" }];
    const at = new Date("2026-10-10T12:00:00.000Z");
    const repository = createDrizzlePushTokenRepository(database, {
      createId: () => "dpt_fixed",
      now: () => at,
    });

    await repository.register(BASE_REGISTER);
    expect(calls.insertValues).toEqual(
      expect.objectContaining({ id: "dpt_fixed", lastSeenAt: at }),
    );
    expect(calls.conflictSet).toEqual(expect.objectContaining({ lastSeenAt: at }));
  });

  it("deletes only when the token row belongs to the caller", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.deleteResult = [{ id: "dpt_1" }];
    const repository = createDrizzlePushTokenRepository(database);

    await expect(
      repository.unregister({ token: "ExponentPushToken[abc123]", userId: "user_1" }),
    ).resolves.toBe(true);
    expect(calls.deleteWhere?.sql).toContain("token");
    expect(calls.deleteWhere?.sql).toContain("user_id");
    expect(calls.deleteWhere?.params).toEqual(["ExponentPushToken[abc123]", "user_1"]);

    calls.deleteResult = [];
    await expect(
      repository.unregister({ token: "ExponentPushToken[abc123]", userId: "user_2" }),
    ).resolves.toBe(false);
  });

  it("lists tokens scoped by user and by workspace, bounded by the list limit", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzlePushTokenRepository(database);

    await repository.listForUser("user_1");
    expect(calls.selectWhere?.sql).toContain("user_id");
    expect(calls.selectWhere?.params).toEqual(["user_1"]);
    expect(calls.orderBy).toBeGreaterThan(0);
    expect(calls.limit).toBe(PUSH_TOKEN_LIST_LIMIT);

    calls.limit = undefined;
    await repository.listForWorkspace("ws_1");
    expect(calls.selectWhere?.sql).toContain("workspace_id");
    expect(calls.selectWhere?.params).toEqual(["ws_1"]);
    expect(calls.limit).toBe(PUSH_TOKEN_LIST_LIMIT);
  });

  it("lists tokens for many users with one in-array query and skips empty input", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzlePushTokenRepository(database);

    await repository.listForUsers(["user_1", "user_2"]);
    expect(calls.selectWhere?.sql).toContain("user_id");
    expect(calls.selectWhere?.params).toEqual(["user_1", "user_2"]);

    calls.selectWhere = undefined;
    await expect(repository.listForUsers([])).resolves.toEqual([]);
    expect(calls.selectWhere).toBeUndefined();
  });

  it("removes pruned tokens by token value and skips empty input", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.deleteResult = [{ id: "dpt_1" }, { id: "dpt_2" }];
    const repository = createDrizzlePushTokenRepository(database);

    await expect(repository.removeTokens(["t1", "t2"])).resolves.toBe(2);
    expect(calls.deleteWhere?.sql).toContain("token");
    expect(calls.deleteWhere?.params).toEqual(["t1", "t2"]);

    calls.deleteWhere = undefined;
    await expect(repository.removeTokens([])).resolves.toBe(0);
    expect(calls.deleteWhere).toBeUndefined();
  });
});
