import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { workspaceUsageCap } from "./schema.js";
import { createDrizzleUsageCapRepository, type UsageCapRepository } from "./usage-caps.js";

const dialect = new PgDialect();

function render(where: unknown): { params: unknown[]; sql: string } {
  const rendered = dialect.sqlToQuery(where as SQL);
  return { params: rendered.params, sql: rendered.sql };
}

/**
 * Captures the select/insert/delete chains without a database — scoping is
 * asserted on the generated SQL via PgDialect, matching
 * user-appearance.test.ts.
 */
function createCapturingDatabase() {
  const calls: {
    conflictSet?: Record<string, unknown>;
    conflictTarget?: unknown;
    deleteWhere?: { params: unknown[]; sql: string };
    insertValues?: Record<string, unknown>;
    limit?: number;
    selectResult?: unknown[];
    selectWhere?: { params: unknown[]; sql: string };
  } = {};
  const database = {
    delete() {
      return {
        where(where: unknown) {
          calls.deleteWhere = render(where);
          return Promise.resolve();
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
                  return calls.selectResult ?? [];
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
                limit(value: number) {
                  calls.limit = value;
                  return query;
                },
                orderBy() {
                  return Promise.resolve(calls.selectResult ?? []);
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

function repository(database: never): UsageCapRepository {
  return createDrizzleUsageCapRepository(database);
}

describe("workspace_usage_cap schema", () => {
  it("uses the expected table name and a composite workspace+key primary key", () => {
    expect(getTableName(workspaceUsageCap)).toBe("workspace_usage_cap");
    const config = getTableConfig(workspaceUsageCap);
    const primaryKey = config.primaryKeys[0];
    expect(primaryKey).toBeDefined();
    expect(primaryKey!.columns.map((column) => column.name)).toEqual(["workspace_id", "key"]);

    const columns = Object.fromEntries(config.columns.map((column) => [column.name, column]));
    expect(columns.workspace_id?.notNull).toBe(true);
    expect(columns.key?.notNull).toBe(true);
    expect(columns.key?.getSQLType()).toBe("varchar(100)");
    expect(columns.cap?.notNull).toBe(true);
    expect(columns.cap?.getSQLType()).toBe("integer");
    expect(columns.created_at?.notNull).toBe(true);
    expect(columns.updated_at?.notNull).toBe(true);
  });
});

describe("drizzle usage cap repository", () => {
  it("validates the workspace id, key, and cap before touching the database", async () => {
    const store = repository(null as never);
    await expect(store.list("")).rejects.toThrow();
    await expect(store.get("", "ai.requests")).rejects.toThrow();
    await expect(store.get("ws_1", "")).rejects.toThrow();
    await expect(store.get("ws_1", "k".repeat(101))).rejects.toThrow();
    await expect(store.set("ws_1", "ai.requests", -1)).rejects.toThrow();
    await expect(store.set("ws_1", "ai.requests", 1.5)).rejects.toThrow();
    await expect(store.set("ws_1", "ai.requests", 1_000_000_001)).rejects.toThrow();
    await expect(store.clear("ws_1", "")).rejects.toThrow();
  });

  it("returns null when no cap is stored for the key", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [];
    await expect(repository(database).get("ws_1", "ai.requests")).resolves.toBeNull();
    expect(calls.selectWhere?.params).toEqual(["ws_1", "ai.requests"]);
    expect(calls.limit).toBe(1);
  });

  it("returns the stored cap for the key", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [{ cap: 42 }];
    await expect(repository(database).get("ws_1", "ai.requests")).resolves.toBe(42);
  });

  it("lists every cap row for the workspace", async () => {
    const rows = [
      {
        cap: 10,
        createdAt: new Date(),
        key: "ai.requests",
        updatedAt: new Date(),
        workspaceId: "ws_1",
      },
    ];
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = rows;
    await expect(repository(database).list("ws_1")).resolves.toEqual(rows);
    expect(calls.selectWhere?.params).toEqual(["ws_1"]);
  });

  it("upserts on the composite key and returns the persisted row", async () => {
    const row = {
      cap: 25,
      createdAt: new Date("2026-10-15T00:00:00.000Z"),
      key: "ai.requests",
      updatedAt: new Date("2026-10-15T12:00:00.000Z"),
      workspaceId: "ws_1",
    };
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [row];
    const store = repository(database);

    await expect(store.set("ws_1", "ai.requests", 25)).resolves.toEqual(row);
    expect(calls.insertValues).toEqual({ cap: 25, key: "ai.requests", workspaceId: "ws_1" });
    // Conflict target is the composite PK — one row per (workspace, key).
    expect(calls.conflictTarget).toEqual([workspaceUsageCap.workspaceId, workspaceUsageCap.key]);
    expect(calls.conflictSet).toEqual(
      expect.objectContaining({ cap: 25, updatedAt: expect.any(Date) }),
    );
  });

  it("throws when the upsert returns no row", async () => {
    const { database } = createCapturingDatabase();
    await expect(repository(database).set("ws_1", "ai.requests", 5)).rejects.toThrow();
  });

  it("clears the cap row scoped to the workspace and key", async () => {
    const { calls, database } = createCapturingDatabase();
    await expect(repository(database).clear("ws_1", "ai.requests")).resolves.toBeUndefined();
    expect(calls.deleteWhere?.params).toEqual(["ws_1", "ai.requests"]);
  });
});
