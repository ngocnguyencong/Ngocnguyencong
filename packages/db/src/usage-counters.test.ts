import { getTableColumns, getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { usageCounter } from "./schema.js";
import { createDrizzleUsageCounterRepository, MAX_USAGE_QUOTA } from "./usage-counters.js";

const PERIOD = new Date("2026-09-01T00:00:00.000Z");
const BASE_CONSUME = {
  key: "ai.requests",
  limit: 5,
  n: 1,
  periodStart: PERIOD,
  workspaceId: "ws_1",
} as const;

describe("usage_counter schema", () => {
  it("defines the per-workspace usage counter table", () => {
    expect(getTableName(usageCounter)).toBe("usage_counter");

    const columns = getTableColumns(usageCounter);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.key.getSQLType()).toBe("varchar(100)");
    expect(columns.key.notNull).toBe(true);
    expect(columns.periodStart.getSQLType()).toBe("timestamp with time zone");
    expect(columns.periodStart.notNull).toBe(true);
    expect(columns.used.getSQLType()).toBe("integer");
    expect(columns.used.notNull).toBe(true);
    expect(columns.used.default).toBe(0);
    expect(columns.updatedAt.notNull).toBe(true);
    // No surrogate id — the composite identity IS the primary key.
    expect(columns).not.toHaveProperty("id");
  });

  it("enforces the (workspace, key, period) identity plus the workspace lookup index", () => {
    const config = getTableConfig(usageCounter);

    const primaryKey = config.primaryKeys[0];
    expect(primaryKey).toBeDefined();
    expect(primaryKey!.columns.map((column) => (column as { name: string }).name)).toEqual([
      "workspace_id",
      "key",
      "period_start",
    ]);

    const indexNames = config.indexes.map((index) => index.config.name);
    expect(indexNames).toContain("idx_usage_counter_workspace");
  });
});

/**
 * Captures the raw `execute` command (rendered via PgDialect) and the
 * select-chain reads without needing a database.
 */
function createCapturingDatabase() {
  const dialect = new PgDialect();
  const calls: {
    executeParams?: unknown[];
    executeSql?: string;
    executeResult?: { used: number }[];
    selectLimit?: number;
    selectRows?: { used: number }[];
    listRows?: unknown[];
  } = {};
  const database = {
    async execute(command: SQL) {
      const rendered = dialect.sqlToQuery(command);
      calls.executeSql = rendered.sql;
      calls.executeParams = rendered.params;
      return calls.executeResult ?? [];
    },
    select() {
      return {
        from() {
          return {
            where() {
              return {
                async limit(limit: number) {
                  calls.selectLimit = limit;
                  return calls.selectRows ?? [];
                },
                async orderBy() {
                  return calls.listRows ?? [];
                },
              };
            },
          };
        },
      };
    },
  };
  return { calls, database: database as never };
}

describe("drizzle usage counter repository contract", () => {
  it("exports the repository factory", () => {
    expect(createDrizzleUsageCounterRepository).toEqual(expect.any(Function));
  });

  it("validates the consume input before touching the database", async () => {
    const repository = createDrizzleUsageCounterRepository(null as never);

    await expect(repository.consume(null as never)).rejects.toThrow();
    await expect(repository.consume({ ...BASE_CONSUME, workspaceId: "" })).rejects.toThrow();
    await expect(repository.consume({ ...BASE_CONSUME, workspaceId: "   " })).rejects.toThrow();
    await expect(repository.consume({ ...BASE_CONSUME, key: "" })).rejects.toThrow();
    await expect(repository.consume({ ...BASE_CONSUME, key: "k".repeat(101) })).rejects.toThrow();
    for (const n of [0, -1, 1.5, Number.NaN, MAX_USAGE_QUOTA + 1]) {
      await expect(repository.consume({ ...BASE_CONSUME, n })).rejects.toThrow();
    }
    for (const limit of [undefined, -1, 0.5, Number.NaN, MAX_USAGE_QUOTA + 1] as never[]) {
      await expect(repository.consume({ ...BASE_CONSUME, limit })).rejects.toThrow();
    }
    await expect(
      repository.consume({ ...BASE_CONSUME, periodStart: new Date("not a date") }),
    ).rejects.toThrow();
    await expect(
      repository.consume({ ...BASE_CONSUME, periodStart: "2026-09-01" as never }),
    ).rejects.toThrow();
  });

  it("requires an explicit limit — undefined never silently means unlimited", async () => {
    const repository = createDrizzleUsageCounterRepository(null as never);

    await expect(
      repository.consume({ ...BASE_CONSUME, limit: undefined as never }),
    ).rejects.toThrow();
    // null is the only unlimited opt-in and validates fine (db then runs).
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ used: 1 }];
    await expect(
      createDrizzleUsageCounterRepository(database).consume({ ...BASE_CONSUME, limit: null }),
    ).resolves.toEqual({ ok: true, used: 1, limit: null });
  });

  it("validates get/list inputs before touching the database", async () => {
    const repository = createDrizzleUsageCounterRepository(null as never);

    await expect(
      repository.get({ key: "k", periodStart: PERIOD, workspaceId: "" }),
    ).rejects.toThrow();
    await expect(
      repository.get({ key: "", periodStart: PERIOD, workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(
      repository.get({ key: "k", periodStart: new Date("x"), workspaceId: "ws_1" }),
    ).rejects.toThrow();
    await expect(repository.list("")).rejects.toThrow();
    await expect(repository.list("ws_1", { periodStart: new Date("bad") })).rejects.toThrow();
  });

  it("consumes via a single conditional upsert — the quota guard lives in the statement", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ used: 4 }];
    const repository = createDrizzleUsageCounterRepository(database);

    const result = await repository.consume(BASE_CONSUME);

    expect(result).toEqual({ ok: true, used: 4, limit: 5 });
    expect(calls.executeSql).toContain("INSERT INTO usage_counter");
    expect(calls.executeSql).toContain("ON CONFLICT (workspace_id, key, period_start)");
    expect(calls.executeSql).toContain("DO UPDATE");
    expect(calls.executeSql).toContain("usage_counter.used + ");
    expect(calls.executeSql).toContain("WHERE usage_counter.used + ");
    expect(calls.executeSql).toContain("RETURNING used");
    expect(calls.executeParams).toEqual(["ws_1", "ai.requests", PERIOD.toISOString(), 1, 1, 1, 5]);
  });

  it("omits the WHERE guard entirely when the limit is null (unlimited)", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ used: 99_999 }];
    const repository = createDrizzleUsageCounterRepository(database);

    const result = await repository.consume({ ...BASE_CONSUME, limit: null, n: 99_999 });

    expect(result).toEqual({ ok: true, used: 99_999, limit: null });
    expect(calls.executeSql).not.toContain("WHERE");
    expect(calls.executeSql).toContain("DO UPDATE");
  });

  it("maps zero returned rows to quota_exhausted and reads back the current used", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [];
    calls.selectRows = [{ used: 5 }];
    const repository = createDrizzleUsageCounterRepository(database);

    const result = await repository.consume(BASE_CONSUME);

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 5, limit: 5 });
    expect(calls.selectLimit).toBe(1);
  });

  it("never issues the upsert when n already exceeds the limit — the INSERT branch is unguarded", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectRows = [{ used: 3 }];
    const repository = createDrizzleUsageCounterRepository(database);

    const result = await repository.consume({ ...BASE_CONSUME, n: 6 });

    expect(result).toEqual({ ok: false, reason: "quota_exhausted", used: 3, limit: 5 });
    expect(calls.executeSql).toBeUndefined();
  });

  it("get returns the stored used and zero for an absent counter", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleUsageCounterRepository(database);

    calls.selectRows = [{ used: 12 }];
    await expect(
      repository.get({ key: "ai.requests", periodStart: PERIOD, workspaceId: "ws_1" }),
    ).resolves.toEqual({ used: 12 });

    calls.selectRows = [];
    await expect(
      repository.get({ key: "ai.requests", periodStart: PERIOD, workspaceId: "ws_1" }),
    ).resolves.toEqual({ used: 0 });
  });

  it("list returns the workspace's counter rows", async () => {
    const { calls, database } = createCapturingDatabase();
    const rows = [
      { key: "a", periodStart: PERIOD, used: 1, workspaceId: "ws_1" },
      { key: "b", periodStart: PERIOD, used: 2, workspaceId: "ws_1" },
    ];
    calls.listRows = rows;
    const repository = createDrizzleUsageCounterRepository(database);

    await expect(repository.list("ws_1")).resolves.toBe(rows);
    await expect(repository.list("ws_1", { periodStart: PERIOD })).resolves.toBe(rows);
  });
});
