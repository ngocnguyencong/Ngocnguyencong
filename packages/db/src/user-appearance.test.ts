import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { userAppearance } from "./schema.js";
import {
  createDrizzleUserAppearanceRepository,
  type UserAppearanceRepository,
} from "./user-appearance.js";

const dialect = new PgDialect();

function render(where: unknown): { params: unknown[]; sql: string } {
  const rendered = dialect.sqlToQuery(where as SQL);
  return { params: rendered.params, sql: rendered.sql };
}

/**
 * Captures the insert/select chains without a database — scoping is asserted
 * on the generated SQL via PgDialect, matching push-tokens.test.ts.
 */
function createCapturingDatabase() {
  const calls: {
    conflictSet?: Record<string, unknown>;
    conflictTarget?: unknown;
    insertValues?: Record<string, unknown>;
    limit?: number;
    selectResult?: unknown[];
    selectWhere?: { params: unknown[]; sql: string };
  } = {};
  const database = {
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

function repository(database: never): UserAppearanceRepository {
  return createDrizzleUserAppearanceRepository(database);
}

describe("user_appearance schema", () => {
  it("uses the expected table name and a required user primary key", () => {
    expect(getTableName(userAppearance)).toBe("user_appearance");
    const config = getTableConfig(userAppearance);
    const pk = config.columns.find((column) => column.name === "user_id");
    expect(pk?.primary).toBe(true);
    expect(pk?.notNull).toBe(true);
    expect(config.columns.find((column) => column.name === "preferences")?.notNull).toBe(true);
  });
});

describe("drizzle user appearance repository", () => {
  it("validates the user id before touching the database", async () => {
    const store = repository(null as never);
    await expect(store.get("")).rejects.toThrow();
    await expect(store.get("   ")).rejects.toThrow();
    await expect(store.upsert("", {})).rejects.toThrow();
    await expect(store.upsert(" ", { theme: "obsidian" })).rejects.toThrow();
  });

  it("returns null when the user has no stored snapshot", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [];
    await expect(repository(database).get("user_1")).resolves.toBeNull();
    expect(calls.selectWhere?.sql).toContain("user_id");
    expect(calls.selectWhere?.params).toEqual(["user_1"]);
    expect(calls.limit).toBe(1);
  });

  it("returns the stored preferences and updatedAt", async () => {
    const record = {
      preferences: { theme: "paper" },
      updatedAt: new Date("2026-10-15T00:00:00.000Z"),
    };
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [record];
    await expect(repository(database).get("user_1")).resolves.toEqual(record);
  });

  it("upserts on the user primary key and returns the persisted projection", async () => {
    const preferences = { density: "compact", theme: "paper" };
    const record = { preferences, updatedAt: new Date("2026-10-15T12:00:00.000Z") };
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [record];
    const store = repository(database);

    await expect(store.upsert("user_1", preferences)).resolves.toEqual(record);
    expect(calls.insertValues).toEqual({ preferences, userId: "user_1" });
    // Conflict target is the user PK — one row per account, latest write wins.
    expect(calls.conflictTarget).toBe(userAppearance.userId);
    expect(calls.conflictSet).toEqual(
      expect.objectContaining({ preferences, updatedAt: expect.any(Date) }),
    );
  });

  it("throws when the upsert returns no row", async () => {
    const { database } = createCapturingDatabase();
    await expect(repository(database).upsert("user_1", {})).rejects.toThrow();
  });
});
