import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  createDrizzleAnalyticsEventRepository,
  type AnalyticsEventRecord,
} from "./analytics-events.js";

const BASE_EVENT: AnalyticsEventRecord = {
  id: "evt_1",
  kind: "pageview",
  path: "/pricing",
  referrerHost: "search.example.test",
  visitorHash: "a".repeat(64),
  workspaceId: null,
};

/** Captures inserted rows and rendered `execute` SQL without a database. */
function createCapturingDatabase() {
  const dialect = new PgDialect();
  const calls: {
    executeParams?: unknown[];
    executeSql?: string[];
    executeResults?: { rows: Record<string, unknown>[] }[];
    inserted?: unknown;
  } = {};
  const pendingResults = calls.executeResults ?? [];
  const database = {
    async execute(command: SQL) {
      const rendered = dialect.sqlToQuery(command);
      (calls.executeSql ??= []).push(rendered.sql);
      calls.executeParams = rendered.params;
      return (pendingResults.shift()?.rows ?? []) as never;
    },
    insert() {
      return {
        async values(row: unknown) {
          calls.inserted = row;
        },
      };
    },
  };
  return {
    calls,
    database: database as never,
    queueExecuteResult(rows: Record<string, unknown>[]) {
      pendingResults.push({ rows });
    },
  };
}

describe("drizzle analytics event repository contract", () => {
  it("exports the repository factory", () => {
    expect(createDrizzleAnalyticsEventRepository).toEqual(expect.any(Function));
  });

  it("validates the record input before touching the database", async () => {
    const repository = createDrizzleAnalyticsEventRepository(null as never);

    await expect(repository.record(null as never)).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, id: "" })).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, kind: "scroll" as never })).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, name: "n".repeat(121) })).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, path: "" })).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, path: "p".repeat(513) })).rejects.toThrow();
    await expect(
      repository.record({ ...BASE_EVENT, referrerHost: "r".repeat(256) }),
    ).rejects.toThrow();
    await expect(
      repository.record({ ...BASE_EVENT, visitorHash: "h".repeat(65) }),
    ).rejects.toThrow();
    await expect(repository.record({ ...BASE_EVENT, workspaceId: "  " })).rejects.toThrow();
  });

  it("validates the summary input before touching the database", async () => {
    const repository = createDrizzleAnalyticsEventRepository(null as never);
    const since = new Date("2026-10-01T00:00:00.000Z");

    await expect(
      repository.summarizeSiteTraffic({ limit: 10, since: new Date("bad") }),
    ).rejects.toThrow();
    await expect(
      repository.summarizeSiteTraffic({ limit: 10, since: "2026-10-01" as never }),
    ).rejects.toThrow();
    for (const limit of [0, -1, 1.5, Number.NaN, 101] as never[]) {
      await expect(repository.summarizeSiteTraffic({ limit, since })).rejects.toThrow();
    }
  });

  it("inserts a normalized analytics row", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleAnalyticsEventRepository(database);

    await repository.record(BASE_EVENT);

    expect(calls.inserted).toEqual({
      id: "evt_1",
      kind: "pageview",
      path: "/pricing",
      referrerHost: "search.example.test",
      visitorHash: "a".repeat(64),
      workspaceId: null,
      name: null,
    });
  });

  it("trims bounded string fields before inserting", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleAnalyticsEventRepository(database);

    await repository.record({
      ...BASE_EVENT,
      name: "  cta_click  ",
      path: "  /pricing  ",
      referrerHost: "  search.example.test  ",
    });

    expect(calls.inserted).toMatchObject({
      name: "cta_click",
      path: "/pricing",
      referrerHost: "search.example.test",
    });
  });

  it("keeps optional fields null when absent — never raw ip or user-agent", async () => {
    const { calls, database } = createCapturingDatabase();
    const repository = createDrizzleAnalyticsEventRepository(database);

    await repository.record({ id: "evt_2", kind: "event", name: "cta_click" });

    expect(calls.inserted).toEqual({
      id: "evt_2",
      kind: "event",
      name: "cta_click",
      path: null,
      referrerHost: null,
      visitorHash: null,
      workspaceId: null,
    });
    expect(JSON.stringify(calls.inserted)).not.toContain("203.0.113");
    expect(Object.keys(calls.inserted as object)).not.toContain("ip");
    expect(Object.keys(calls.inserted as object)).not.toContain("userAgent");
  });

  it("summarizes platform traffic with a totals query plus a bounded top-paths query", async () => {
    const { calls, database, queueExecuteResult } = createCapturingDatabase();
    queueExecuteResult([{ events: 2, pageviews: 7, uniqueVisitors: 5 }]);
    queueExecuteResult([
      { path: "/", views: 4 },
      { path: "/pricing", views: 3 },
    ]);
    const repository = createDrizzleAnalyticsEventRepository(database);
    const since = new Date("2026-09-10T00:00:00.000Z");

    const summary = await repository.summarizeSiteTraffic({ limit: 10, since });

    expect(summary).toEqual({
      events: 2,
      pageviews: 7,
      topPaths: [
        { path: "/", views: 4 },
        { path: "/pricing", views: 3 },
      ],
      uniqueVisitors: 5,
    });
    expect(calls.executeSql).toHaveLength(2);
    // Anonymous marketing rows are platform-level — summaries never join a
    // workspace and never read raw identifiers.
    expect(calls.executeSql?.[0]).toContain("workspace_id IS NULL");
    expect(calls.executeSql?.[0]).toContain("visitor_hash");
    expect(calls.executeSql?.[1]).toContain("GROUP BY");
    expect(calls.executeSql?.[1]).toContain("LIMIT");
    expect(calls.executeParams).toContain(since.toISOString());
    expect(calls.executeParams).toContain(10);
  });

  it("returns zeros and an empty path list when no rows exist", async () => {
    const { database, queueExecuteResult } = createCapturingDatabase();
    queueExecuteResult([{ events: 0, pageviews: 0, uniqueVisitors: 0 }]);
    queueExecuteResult([]);
    const repository = createDrizzleAnalyticsEventRepository(database);

    await expect(
      repository.summarizeSiteTraffic({ limit: 10, since: new Date("2026-09-10T00:00:00.000Z") }),
    ).resolves.toEqual({ events: 0, pageviews: 0, topPaths: [], uniqueVisitors: 0 });
  });
});
