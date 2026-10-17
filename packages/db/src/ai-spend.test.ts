import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { readAiSpendForPeriod } from "./ai-spend.js";

const dialect = new PgDialect();

function render(where: unknown): { params: unknown[]; sql: string } {
  const rendered = dialect.sqlToQuery(where as SQL);
  return { params: rendered.params, sql: rendered.sql };
}

/**
 * Captures the two sequential selects (committed spend, then held
 * reservations) without a database — the period filters are asserted on the
 * generated SQL via PgDialect, matching usage-caps.test.ts.
 */
function createCapturingDatabase(selectResults: unknown[][]) {
  const calls: { wheres: { params: unknown[]; sql: string }[] } = { wheres: [] };
  let index = 0;
  const database = {
    select() {
      const resultIndex = index;
      index += 1;
      return {
        from() {
          return {
            where(where: unknown) {
              calls.wheres.push(render(where));
              return Promise.resolve(selectResults[resultIndex] ?? []);
            },
          };
        },
      };
    },
  };
  return { calls, database: database as never };
}

describe("readAiSpendForPeriod", () => {
  const periodStart = new Date("2026-10-01T00:00:00.000Z");

  it("rejects invalid inputs before querying", async () => {
    const { database } = createCapturingDatabase([]);
    await expect(readAiSpendForPeriod(database, "", periodStart)).rejects.toThrow();
    await expect(readAiSpendForPeriod(database, "ws_1", new Date("bad"))).rejects.toThrow();
  });

  it("sums committed ai_usage rows for the workspace and UTC month", async () => {
    const { calls, database } = createCapturingDatabase([
      [{ costMicrounits: 1_500_000n }, { costMicrounits: 500_000n }],
      [],
    ]);
    const spend = await readAiSpendForPeriod(database, "ws_1", periodStart);
    expect(spend).toEqual({ committedMicrounits: 2_000_000n, heldMicrounits: 0n });
    // Committed spend reads ai_usage rows created inside [period, nextPeriod).
    expect(calls.wheres[0]?.sql).toContain("workspace_id");
    expect(calls.wheres[0]?.sql).toContain("created_at");
    expect(calls.wheres[0]?.params).toEqual([
      "ws_1",
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ]);
  });

  it("sums only active reservations held for the period", async () => {
    const { calls, database } = createCapturingDatabase([
      [],
      [{ reservedMicrounits: 300_000n }, { reservedMicrounits: 200_000n }],
    ]);
    const spend = await readAiSpendForPeriod(database, "ws_1", periodStart);
    expect(spend).toEqual({ committedMicrounits: 0n, heldMicrounits: 500_000n });
    // Held spend reads ai_budget_reservation rows pinned to the period start
    // with status "reserved" — settled/released rows never count.
    expect(calls.wheres[1]?.sql).toContain("period_start");
    expect(calls.wheres[1]?.sql).toContain("status");
    expect(calls.wheres[1]?.params).toEqual(["ws_1", "2026-10-01T00:00:00.000Z", "reserved"]);
  });

  it("rolls a mid-month period anchor to the UTC month boundary", async () => {
    const { calls, database } = createCapturingDatabase([[], []]);
    await readAiSpendForPeriod(database, "ws_1", new Date("2026-10-24T15:30:00.000Z"));
    expect(calls.wheres[0]?.params).toEqual([
      "ws_1",
      "2026-10-01T00:00:00.000Z",
      "2026-11-01T00:00:00.000Z",
    ]);
    expect(calls.wheres[1]?.params).toEqual(["ws_1", "2026-10-01T00:00:00.000Z", "reserved"]);
  });

  it("crosses the year boundary for December periods", async () => {
    const { calls, database } = createCapturingDatabase([[], []]);
    await readAiSpendForPeriod(database, "ws_1", new Date("2026-12-01T00:00:00.000Z"));
    expect(calls.wheres[0]?.params).toEqual([
      "ws_1",
      "2026-12-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
  });
});
