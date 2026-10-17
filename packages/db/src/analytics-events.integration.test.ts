import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { beforeAll, describe, expect, it } from "vitest";

import { analyticsEvent, workspace } from "./schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle");

integrationDescribe("analytics event repository", () => {
  beforeAll(async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      await migrate(lifecycle.database, { migrationsFolder });
    } finally {
      await lifecycle.close();
    }
  });

  it("records platform rows and summarizes anonymous traffic", async () => {
    const { createPostgresDatabase } = await import("./" + "postgres.js");
    const { createDrizzleAnalyticsEventRepository } = await import("./" + "analytics-events.js");
    const lifecycle = createPostgresDatabase({ databaseUrl: testDatabaseUrl! });

    try {
      const repository = createDrizzleAnalyticsEventRepository(lifecycle.database);
      const hash = (salt: string) => randomBytes(32).toString("hex") + salt.slice(0, 0);
      const visitorA = hash("a");
      const visitorB = hash("b");

      await repository.record({
        id: `evt_${randomUUID()}`,
        kind: "pageview",
        path: "/",
        referrerHost: "search.example.test",
        visitorHash: visitorA,
      });
      await repository.record({
        id: `evt_${randomUUID()}`,
        kind: "pageview",
        path: "/pricing",
        visitorHash: visitorA,
      });
      await repository.record({
        id: `evt_${randomUUID()}`,
        kind: "pageview",
        path: "/pricing",
        visitorHash: visitorB,
      });
      await repository.record({
        id: `evt_${randomUUID()}`,
        kind: "event",
        name: "cta_click",
        visitorHash: visitorB,
      });

      const summary = await repository.summarizeSiteTraffic({
        limit: 10,
        since: new Date(Date.now() - 60_000),
      });
      expect(summary.pageviews).toBeGreaterThanOrEqual(3);
      expect(summary.events).toBeGreaterThanOrEqual(1);
      expect(summary.uniqueVisitors).toBeGreaterThanOrEqual(2);
      expect(summary.topPaths[0]).toMatchObject({ path: "/pricing" });

      // Workspace-scoped rows are excluded from the platform summary.
      const workspaceId = `ws_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
      await lifecycle.database.insert(workspace).values({
        id: workspaceId,
        name: "Analytics Test",
        slug: `analytics-${workspaceId.slice(-6)}`,
      });
      await repository.record({
        id: `evt_${randomUUID()}`,
        kind: "pageview",
        path: "/workspace-only",
        visitorHash: visitorB,
        workspaceId,
      });
      const rows = await lifecycle.database
        .select({ workspaceId: analyticsEvent.workspaceId })
        .from(analyticsEvent)
        .where(eq(analyticsEvent.workspaceId, workspaceId));
      expect(rows).toHaveLength(1);
      const scoped = await repository.summarizeSiteTraffic({
        limit: 50,
        since: new Date(Date.now() - 60_000),
      });
      expect(scoped.topPaths.some((row) => row.path === "/workspace-only")).toBe(false);
    } finally {
      await lifecycle.close();
    }
  });
});
