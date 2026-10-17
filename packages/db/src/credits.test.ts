import { getTableColumns, getTableName, type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { creditBalance, creditTransaction } from "./schema.js";
import {
  createDrizzleCreditsRepository,
  InsufficientCreditsError,
  MAX_CREDIT_AMOUNT,
} from "./credits.js";

const BASE_GRANT = {
  amount: 25,
  kind: "grant" as const,
  reason: "plan credit grant",
  referenceId: "plan-credit:sub_1",
  workspaceId: "ws_1",
};

const BASE_DEBIT = {
  amount: -1,
  kind: "debit" as const,
  reason: "usage quota overflow",
  referenceId: "task_1",
  workspaceId: "ws_1",
};

describe("credit_balance schema", () => {
  it("defines the per-workspace credit balance table", () => {
    expect(getTableName(creditBalance)).toBe("credit_balance");

    const columns = getTableColumns(creditBalance);
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.workspaceId.getSQLType()).toBe("text");
    expect(columns.balance.getSQLType()).toBe("integer");
    expect(columns.balance.notNull).toBe(true);
    expect(columns.balance.default).toBe(0);
    expect(columns.updatedAt.notNull).toBe(true);
    // No surrogate id — workspace_id IS the primary key.
    expect(columns).not.toHaveProperty("id");
    expect(columns.workspaceId.primary).toBe(true);
  });
});

describe("credit_transaction schema", () => {
  it("defines the append-only credit ledger", () => {
    expect(getTableName(creditTransaction)).toBe("credit_transaction");

    const columns = getTableColumns(creditTransaction);
    expect(columns.id.getSQLType()).toBe("text");
    expect(columns.workspaceId.notNull).toBe(true);
    expect(columns.amount.getSQLType()).toBe("integer");
    expect(columns.amount.notNull).toBe(true);
    expect(columns.kind.getSQLType()).toBe("varchar(24)");
    expect(columns.reason.getSQLType()).toBe("varchar(255)");
    expect(columns.referenceId.getSQLType()).toBe("varchar(128)");
    expect(columns.actorUserId.notNull).toBe(false);
    expect(columns.balanceAfter.getSQLType()).toBe("integer");
    expect(columns.balanceAfter.notNull).toBe(true);

    const indexNames = getTableConfig(creditTransaction).indexes.map((index) => index.config.name);
    expect(indexNames).toContain("idx_credit_transaction_workspace_created");
    expect(indexNames).toContain("idx_credit_transaction_reference");
  });
});

/**
 * Captures the transaction body's raw `execute` commands (rendered via
 * PgDialect) plus the drizzle `insert().values()` ledger write, without a
 * database. `executeResult` is the upsert/guarded-update RETURNING payload.
 */
function createCapturingDatabase() {
  const dialect = new PgDialect();
  const calls: {
    executeParams?: unknown[];
    executeSql?: string;
    executeResult?: { balance: number }[];
    inserted?: Record<string, unknown>[];
    selectLimit?: number;
    selectRows?: unknown[];
    transactions: number;
  } = { transactions: 0 };
  const tx = {
    async execute(command: SQL) {
      const rendered = dialect.sqlToQuery(command);
      calls.executeSql = rendered.sql;
      calls.executeParams = rendered.params;
      return calls.executeResult ?? [];
    },
    insert() {
      return {
        async values(values: Record<string, unknown>) {
          calls.inserted = [...(calls.inserted ?? []), values];
          return [];
        },
      };
    },
  };
  const database = {
    async transaction(body: (transaction: typeof tx) => Promise<unknown>) {
      calls.transactions += 1;
      return body(tx);
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
                orderBy() {
                  return {
                    async limit(limit: number) {
                      calls.selectLimit = limit;
                      return calls.selectRows ?? [];
                    },
                  };
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

describe("drizzle credits repository contract", () => {
  it("exports the repository factory and the typed insufficient-credits error", () => {
    expect(createDrizzleCreditsRepository).toEqual(expect.any(Function));
    expect(new InsufficientCreditsError("ws_1")).toBeInstanceOf(Error);
    expect(new InsufficientCreditsError("ws_1").code).toBe("insufficient_credits");
  });

  it("validates the append input before touching the database", async () => {
    const repository = createDrizzleCreditsRepository(null as never);

    await expect(repository.appendTransaction(null as never)).rejects.toThrow();
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, workspaceId: "" }),
    ).rejects.toThrow();
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, workspaceId: "   " }),
    ).rejects.toThrow();
    for (const amount of [0, 1.5, Number.NaN, MAX_CREDIT_AMOUNT + 1, -MAX_CREDIT_AMOUNT - 1]) {
      await expect(repository.appendTransaction({ ...BASE_GRANT, amount })).rejects.toThrow();
    }
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, kind: "lottery" as never }),
    ).rejects.toThrow();
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, reason: "r".repeat(256) }),
    ).rejects.toThrow();
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, referenceId: "r".repeat(129) }),
    ).rejects.toThrow();
    await expect(
      repository.appendTransaction({ ...BASE_GRANT, actorUserId: "" }),
    ).rejects.toThrow();
  });

  it("keeps amount sign aligned with kind", async () => {
    const repository = createDrizzleCreditsRepository(null as never);

    for (const kind of ["grant", "refund"] as const) {
      await expect(
        repository.appendTransaction({ ...BASE_GRANT, amount: -5, kind }),
      ).rejects.toThrow();
    }
    for (const kind of ["debit", "expire"] as const) {
      await expect(
        repository.appendTransaction({ ...BASE_DEBIT, amount: 5, kind }),
      ).rejects.toThrow();
    }
    // adjustments may move in either direction.
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ balance: 4 }];
    await expect(
      createDrizzleCreditsRepository(database).appendTransaction({
        amount: -6,
        kind: "adjustment",
        workspaceId: "ws_1",
      }),
    ).resolves.toEqual({ balance: 4 });
    calls.executeResult = [{ balance: 10 }];
    await expect(
      createDrizzleCreditsRepository(database).appendTransaction({
        amount: 6,
        kind: "adjustment",
        workspaceId: "ws_1",
      }),
    ).resolves.toEqual({ balance: 10 });
  });

  it("runs the balance write and the ledger insert inside ONE transaction", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ balance: 30 }];
    const repository = createDrizzleCreditsRepository(database);

    const result = await repository.appendTransaction(BASE_GRANT);

    expect(result).toEqual({ balance: 30 });
    expect(calls.transactions).toBe(1);
    expect(calls.executeSql).toContain("INSERT INTO credit_balance");
    expect(calls.executeSql).toContain("ON CONFLICT (workspace_id) DO UPDATE");
    expect(calls.executeSql).toContain("credit_balance.balance + ");
    expect(calls.executeSql).toContain("RETURNING balance");
    expect(calls.inserted).toEqual([
      expect.objectContaining({
        amount: 25,
        balanceAfter: 30,
        kind: "grant",
        reason: "plan credit grant",
        referenceId: "plan-credit:sub_1",
        workspaceId: "ws_1",
      }),
    ]);
    expect(String(calls.inserted![0]!.id)).toMatch(/^ctxn_/);
  });

  it("debits via a guarded UPDATE — the non-negative guard lives in the statement", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [{ balance: 3 }];
    const repository = createDrizzleCreditsRepository(database);

    const result = await repository.appendTransaction(BASE_DEBIT);

    expect(result).toEqual({ balance: 3 });
    expect(calls.executeSql).toContain("UPDATE credit_balance");
    expect(calls.executeSql).toContain("credit_balance.balance + ");
    expect(calls.executeSql).toContain(">= 0");
    expect(calls.executeParams).toEqual([-1, "ws_1", -1]);
    expect(calls.inserted).toEqual([
      expect.objectContaining({ amount: -1, balanceAfter: 3, kind: "debit" }),
    ]);
  });

  it("throws InsufficientCreditsError on a rejected debit and writes nothing", async () => {
    const { calls, database } = createCapturingDatabase();
    calls.executeResult = [];
    const repository = createDrizzleCreditsRepository(database);

    await expect(repository.appendTransaction(BASE_DEBIT)).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
    expect(calls.inserted).toBeUndefined();
  });

  it("getBalance returns the stored balance and zero for an absent row", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleCreditsRepository(database);

    calls.selectRows = [{ balance: 42 }];
    await expect(repository.getBalance("ws_1")).resolves.toBe(42);

    calls.selectRows = [];
    await expect(repository.getBalance("ws_1")).resolves.toBe(0);
    await expect(repository.getBalance("")).rejects.toThrow();
  });

  it("listTransactions defaults to 50 rows and accepts an explicit limit", async () => {
    const { calls, database } = createCapturingDatabase();
    const rows = [
      { amount: -1, id: "ctxn_2", kind: "debit", workspaceId: "ws_1" },
      { amount: 25, id: "ctxn_1", kind: "grant", workspaceId: "ws_1" },
    ];
    calls.selectRows = rows;
    const repository = createDrizzleCreditsRepository(database);

    await expect(repository.listTransactions("ws_1")).resolves.toBe(rows);
    expect(calls.selectLimit).toBe(50);

    await expect(repository.listTransactions("ws_1", 10)).resolves.toBe(rows);
    expect(calls.selectLimit).toBe(10);

    await expect(repository.listTransactions("")).rejects.toThrow();
    await expect(repository.listTransactions("ws_1", 0)).rejects.toThrow();
    await expect(repository.listTransactions("ws_1", 501)).rejects.toThrow();
  });

  it("hasTransactionWithReference answers the idempotency lookup per workspace", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleCreditsRepository(database);

    calls.selectRows = [{ id: "ctxn_1" }];
    await expect(repository.hasTransactionWithReference("ws_1", "plan-credit:sub_1")).resolves.toBe(
      true,
    );

    calls.selectRows = [];
    await expect(repository.hasTransactionWithReference("ws_1", "plan-credit:sub_1")).resolves.toBe(
      false,
    );

    await expect(repository.hasTransactionWithReference("ws_1", "")).rejects.toThrow();
    await expect(repository.hasTransactionWithReference("", "ref")).rejects.toThrow();
  });
});
