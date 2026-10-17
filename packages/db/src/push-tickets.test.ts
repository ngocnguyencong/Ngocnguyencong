import { getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { createDrizzlePushTicketRepository } from "./push-tickets.js";
import { pushTicket } from "./schema.js";

const dialect = new PgDialect();

function render(where: unknown): { params: unknown[]; sql: string } {
  const rendered = dialect.sqlToQuery(where as SQL);
  return { params: rendered.params, sql: rendered.sql };
}

/**
 * Captures the insert/delete/select chains without a database — same
 * approach as push-tokens.test.ts: `where` clauses render through
 * PgDialect so behavior is asserted on generated SQL.
 */
function createCapturingDatabase() {
  const calls: {
    conflictNothing?: boolean;
    deleteResult?: { id: string }[];
    deleteWhere?: { params: unknown[]; sql: string };
    insertValues?: Record<string, unknown>[];
    limit?: number;
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
        values(values: Record<string, unknown>[]) {
          calls.insertValues = values;
          return {
            onConflictDoNothing() {
              calls.conflictNothing = true;
              return {
                async returning() {
                  return calls.insertValues?.map((row) => ({ id: row.id })) ?? [];
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

describe("push_ticket schema", () => {
  it("uses the expected table name, nullable user FK, and created_at index", () => {
    expect(getTableName(pushTicket)).toBe("push_ticket");
    const config = getTableConfig(pushTicket);
    expect(config.indexes.map((index) => index.config.name)).toContain(
      "idx_push_ticket_created_at",
    );
    const userId = config.columns.find((column) => column.name === "user_id");
    expect(userId?.notNull).toBe(false);
  });
});

describe("drizzle push ticket repository", () => {
  it("exports the repository factory", () => {
    expect(createDrizzlePushTicketRepository).toEqual(expect.any(Function));
  });

  it("validates record inputs before touching the database", async () => {
    const repository = createDrizzlePushTicketRepository(null as never);

    await expect(repository.record([{ id: "", token: "t", userId: null }])).rejects.toThrow();
    await expect(repository.record([{ id: "t1", token: " ", userId: null }])).rejects.toThrow();
    await expect(
      repository.record([{ id: "t1", token: "t", userId: 7 as never }]),
    ).rejects.toThrow();
  });

  it("validates query inputs before touching the database", async () => {
    const repository = createDrizzlePushTicketRepository(null as never);

    await expect(repository.listDue(new Date("nope"), 10)).rejects.toThrow();
    await expect(repository.listDue(new Date(), 0)).rejects.toThrow();
    await expect(repository.remove(["t1", ""])).rejects.toThrow();
    await expect(repository.removeOlderThan(new Date("nope"))).rejects.toThrow();
  });

  it("records tickets with insert-or-ignore and returns the insert count", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzlePushTicketRepository(database);

    const count = await repository.record([
      { id: "t1", token: "tok1", userId: "user_1" },
      { id: "t2", token: "tok2", userId: null },
    ]);

    expect(count).toBe(2);
    expect(calls.conflictNothing).toBe(true);
    expect(calls.insertValues).toEqual([
      { id: "t1", token: "tok1", userId: "user_1" },
      { id: "t2", token: "tok2", userId: null },
    ]);
  });

  it("skips the database entirely for an empty record batch", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzlePushTicketRepository(database);

    await expect(repository.record([])).resolves.toBe(0);
    expect(calls.insertValues).toBeUndefined();
  });

  it("lists due tickets oldest-first, bounded by the limit", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.selectResult = [{ id: "t1" }];
    const repository = createDrizzlePushTicketRepository(database);
    const olderThan = new Date("2026-10-16T11:45:00.000Z");

    const rows = await repository.listDue(olderThan, 1000);

    expect(rows).toEqual([{ id: "t1" }]);
    expect(calls.selectWhere?.sql).toContain("created_at");
    expect(calls.selectWhere?.params).toEqual([olderThan.toISOString()]);
    expect(calls.orderBy).toBeGreaterThan(0);
    expect(calls.limit).toBe(1000);
  });

  it("removes tickets by id in one in-array delete and skips empty input", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.deleteResult = [{ id: "t1" }, { id: "t2" }];
    const repository = createDrizzlePushTicketRepository(database);

    await expect(repository.remove(["t1", "t2"])).resolves.toBe(2);
    expect(calls.deleteWhere?.params).toEqual(["t1", "t2"]);

    calls.deleteWhere = undefined;
    await expect(repository.remove([])).resolves.toBe(0);
    expect(calls.deleteWhere).toBeUndefined();
  });

  it("sweeps tickets older than the cutoff", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.deleteResult = [{ id: "t9" }];
    const repository = createDrizzlePushTicketRepository(database);
    const cutoff = new Date("2026-10-15T12:00:00.000Z");

    await expect(repository.removeOlderThan(cutoff)).resolves.toBe(1);
    expect(calls.deleteWhere?.sql).toContain("created_at");
    expect(calls.deleteWhere?.params).toEqual([cutoff.toISOString()]);
  });
});
