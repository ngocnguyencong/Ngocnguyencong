import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { analyticsEvent } from "./schema";
import type * as schema from "./schema";

type AnalyticsEventDatabase = PostgresJsDatabase<typeof schema>;

/** Row shape — one analytics event per `analytics_event` row. */
export type AnalyticsEvent = typeof analyticsEvent.$inferSelect;

export type AnalyticsEventKind = "pageview" | "event";

/**
 * A normalized analytics event ready to insert. `workspaceId` stays null for
 * anonymous marketing traffic (platform-level rows); server-side callers may
 * attach a workspace for signed-in product events. `visitorHash` is the only
 * identity allowed — a daily-rotating salted hash, never a raw IP or
 * user-agent string.
 */
export interface AnalyticsEventRecord {
  readonly id: string;
  readonly kind: AnalyticsEventKind;
  readonly name?: string | undefined;
  readonly path?: string | undefined;
  readonly referrerHost?: string | undefined;
  readonly visitorHash?: string | null | undefined;
  readonly workspaceId?: string | null | undefined;
}

export interface SiteTrafficPathCount {
  readonly path: string;
  readonly views: number;
}

/** Aggregated anonymous site traffic for the admin overview. */
export interface SiteTrafficSummary {
  readonly events: number;
  readonly pageviews: number;
  readonly topPaths: SiteTrafficPathCount[];
  readonly uniqueVisitors: number;
}

export interface AnalyticsEventRepository {
  /** Inserts one normalized event row. */
  record(event: AnalyticsEventRecord): Promise<void>;
  /**
   * Aggregates platform-level (workspaceId IS NULL) traffic since `since`:
   * pageview/event totals, distinct `visitorHash` uniques, and the top `limit`
   * pageview paths (1–100).
   */
  summarizeSiteTraffic(input: { limit: number; since: Date }): Promise<SiteTrafficSummary>;
}

export function createDrizzleAnalyticsEventRepository(
  database: AnalyticsEventDatabase,
): AnalyticsEventRepository {
  return Object.freeze({
    async record(event: AnalyticsEventRecord): Promise<void> {
      const normalized = normalizeEvent(event);
      await database.insert(analyticsEvent).values(normalized);
    },

    async summarizeSiteTraffic(input: { limit: number; since: Date }) {
      const since = normalizeSince(input?.since);
      const limit = normalizeLimit(input?.limit);
      const sinceIso = since.toISOString();

      const totals = await database.execute<{
        events: number;
        pageviews: number;
        uniqueVisitors: number;
      }>(sql`
        SELECT
          count(*) FILTER (WHERE kind = 'pageview')::int AS "pageviews",
          count(*) FILTER (WHERE kind = 'event')::int AS "events",
          count(DISTINCT visitor_hash)::int AS "uniqueVisitors"
        FROM analytics_event
        WHERE workspace_id IS NULL AND created_at >= ${sinceIso}::timestamptz
      `);
      const topPaths = await database.execute<{ path: string; views: number }>(sql`
        SELECT path, count(*)::int AS views
        FROM analytics_event
        WHERE workspace_id IS NULL
          AND kind = 'pageview'
          AND path IS NOT NULL
          AND created_at >= ${sinceIso}::timestamptz
        GROUP BY path
        ORDER BY views DESC
        LIMIT ${limit}
      `);

      const total = totals[0];
      return {
        events: Number(total?.events ?? 0),
        pageviews: Number(total?.pageviews ?? 0),
        topPaths: topPaths.map((row) => ({ path: row.path, views: Number(row.views) })),
        uniqueVisitors: Number(total?.uniqueVisitors ?? 0),
      };
    },
  });
}

type NormalizedEvent = Readonly<{
  id: string;
  kind: AnalyticsEventKind;
  name: string | null;
  path: string | null;
  referrerHost: string | null;
  visitorHash: string | null;
  workspaceId: string | null;
}>;

function requireInput(input: unknown): asserts input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) {
    throw new Error("A valid analytics event is required.");
  }
}

function optionalBounded(value: string | null | undefined, max: number, field: string) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new Error(`A valid ${field} is required.`);
  }
  return value.trim();
}

function normalizeEvent(event: AnalyticsEventRecord): NormalizedEvent {
  requireInput(event);
  if (typeof event.id !== "string" || event.id.trim().length === 0) {
    throw new Error("A valid analytics event id is required.");
  }
  if (event.kind !== "pageview" && event.kind !== "event") {
    throw new Error("A valid analytics event kind is required.");
  }
  const workspaceId = event.workspaceId;
  if (workspaceId !== undefined && workspaceId !== null && workspaceId.trim().length === 0) {
    throw new Error("A valid analytics workspace is required.");
  }
  return Object.freeze({
    id: event.id,
    kind: event.kind,
    name: optionalBounded(event.name, 120, "analytics event name"),
    path: optionalBounded(event.path, 512, "analytics event path"),
    referrerHost: optionalBounded(event.referrerHost, 255, "analytics referrer host"),
    visitorHash: optionalBounded(event.visitorHash, 64, "analytics visitor hash"),
    workspaceId: workspaceId ?? null,
  });
}

function normalizeSince(since: Date): Date {
  if (!(since instanceof Date) || Number.isNaN(since.getTime())) {
    throw new Error("A valid summary start is required.");
  }
  return since;
}

function normalizeLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("A valid summary limit is required.");
  }
  return limit;
}
