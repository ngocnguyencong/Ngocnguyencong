import {
  apiKey,
  auditEvent,
  commerceOrder,
  commerceOrderItem,
  commerceProduct,
  contentEntry,
  creditBalance,
  creditTransaction,
  entitlement,
  featureRequest,
  jobSchedule,
  usageCounter,
  user,
  webhookDelivery,
  webhookEndpoint,
  workspace,
  workspaceAiPolicy,
  workspaceDomain,
  workspaceInvitation,
  workspaceMembership,
  workspaceUsageCap,
} from "@supastack/db";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildWorkspaceExport } from "./workspace-export";

const dialect = new PgDialect();

interface RecordedQuery {
  table: unknown;
  selectionKeys: string[];
  whereParams: unknown[];
  limit?: number;
}

/**
 * Emulates the drizzle select chain: `select(sel).from(table).join…
 * .where(cond).orderBy(…).limit(…)`. Rows are projected onto the selected
 * keys — exactly what Postgres would return — so a fixture row carrying an
 * unselected "secret" column cannot leak into the export.
 */
function createFakeDb(fixtures: Map<unknown, Record<string, unknown>[]>) {
  const queries: RecordedQuery[] = [];
  const db = {
    queries,
    select(selection: Record<string, unknown>) {
      return {
        from(table: unknown) {
          const query: RecordedQuery = {
            selectionKeys: Object.keys(selection),
            table,
            whereParams: [],
          };
          queries.push(query);
          const rows = () =>
            (fixtures.get(table) ?? []).map((row) =>
              Object.fromEntries(query.selectionKeys.map((key) => [key, row[key]])),
            );
          const builder = {
            innerJoin: () => builder,
            leftJoin: () => builder,
            where(condition: SQL) {
              query.whereParams = dialect.sqlToQuery(condition).params;
              return builder;
            },
            orderBy: () => builder,
            limit(limit: number) {
              query.limit = limit;
              return builder;
            },
            then(onFulfilled?: (rows: Record<string, unknown>[]) => unknown) {
              return Promise.resolve(rows()).then(onFulfilled);
            },
          };
          return builder;
        },
      };
    },
  };
  return db as unknown as Parameters<typeof buildWorkspaceExport>[2] & {
    queries: RecordedQuery[];
  };
}

const NOW = new Date("2026-10-16T12:00:00.000Z");
const CREATED = new Date("2026-01-05T08:30:00.000Z");

function seedFixtures() {
  return new Map<unknown, Record<string, unknown>[]>([
    [
      workspace,
      [
        {
          createdAt: CREATED,
          id: "ws_1",
          name: "Acme",
          slug: "acme",
          type: "organization",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      workspaceMembership,
      [
        {
          email: "owner@example.test",
          joinedAt: CREATED,
          name: "Owner",
          role: "owner",
          userId: "user_1",
        },
      ],
    ],
    [
      // Full table shape — the select list must drop `token` before it
      // can reach the export.
      workspaceInvitation,
      [
        {
          createdAt: CREATED,
          email: "invitee@example.test",
          expiresAt: CREATED,
          id: "inv_1",
          invitedByUserId: "user_1",
          role: "member",
          status: "pending",
          token: "secret-invite-token-value",
        },
      ],
    ],
    [
      contentEntry,
      [
        {
          body: "Body text",
          createdAt: CREATED,
          createdBy: "user_1",
          excerpt: "Excerpt",
          id: "entry_1",
          locale: "en",
          publishedAt: CREATED,
          requiredEntitlement: null,
          slug: "hello",
          status: "published",
          title: "Hello",
          type: "post",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      commerceProduct,
      [
        {
          createdAt: CREATED,
          currency: "usd",
          description: "A product",
          id: "prod_1",
          imageUrl: null,
          inventory: 3,
          name: "Mug",
          priceCents: 1500,
          slug: "mug",
          status: "active",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      commerceOrder,
      [
        {
          createdAt: CREATED,
          currency: "usd",
          customerEmail: "buyer@example.test",
          id: "order_1",
          status: "paid",
          totalCents: 3000,
          updatedAt: CREATED,
        },
      ],
    ],
    [
      commerceOrderItem,
      [
        {
          createdAt: CREATED,
          id: "item_1",
          orderId: "order_1",
          productId: "prod_1",
          productName: "Mug",
          quantity: 2,
          unitPriceCents: 1500,
        },
      ],
    ],
    [
      jobSchedule,
      [
        {
          createdAt: CREATED,
          cron: "0 9 * * 1",
          enabled: true,
          id: "sch_1",
          input: { kind: "digest" },
          lastRunAt: CREATED,
          missedRuns: 0,
          nextRunAt: CREATED,
          type: "email.digest",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      // Full table shape — `secret` must never be selected.
      webhookEndpoint,
      [
        {
          createdAt: CREATED,
          events: ["order.created"],
          id: "wh_1",
          secret: "whsec_live_signing_secret",
          status: "active",
          updatedAt: CREATED,
          url: "https://subscriber.example.test/hook",
        },
      ],
    ],
    [
      // Full table shape — `payload` may embed subscriber secrets.
      webhookDelivery,
      [
        {
          attempts: 1,
          createdAt: CREATED,
          deliveredAt: CREATED,
          endpointId: "wh_1",
          eventType: "order.created",
          id: "del_1",
          lastError: null,
          nextAttemptAt: null,
          payload: { body: "sensitive-payload-body" },
          responseCode: 200,
          status: "delivered",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      // Full table shape — `keyHash` must never be selected.
      apiKey,
      [
        {
          createdAt: CREATED,
          expiresAt: CREATED,
          id: "key_1",
          keyHash: "deadbeef-api-key-hash",
          lastUsedAt: CREATED,
          name: "CI",
          prefix: "sk_live_abc",
          revokedAt: null,
          scopes: ["content:read"],
          userId: "user_1",
        },
      ],
    ],
    [
      workspaceDomain,
      [
        {
          createdAt: CREATED,
          hostname: "app.example.test",
          id: "dom_1",
          lastCheckedAt: CREATED,
          providerHostnameId: "prov_1",
          sslStatus: "active",
          status: "active",
          updatedAt: CREATED,
          verification: { cnameTarget: "verify.example.test" },
          verifiedAt: CREATED,
        },
      ],
    ],
    [
      featureRequest,
      [
        {
          createdAt: CREATED,
          createdBy: "user_1",
          details: "Please add it",
          id: "fr_1",
          status: "open",
          title: "Feature",
          updatedAt: CREATED,
          voteCount: 7,
        },
      ],
    ],
    [creditBalance, [{ balance: 42, updatedAt: CREATED }]],
    [
      creditTransaction,
      [
        {
          actorUserId: "user_1",
          amount: 42,
          balanceAfter: 42,
          createdAt: CREATED,
          id: "tx_1",
          kind: "grant",
          reason: "Top up",
          referenceId: null,
        },
      ],
    ],
    [workspaceUsageCap, [{ cap: 100, createdAt: CREATED, key: "ai.tasks", updatedAt: CREATED }]],
    [
      usageCounter,
      [
        {
          key: "ai.tasks",
          periodStart: new Date("2026-10-01T00:00:00.000Z"),
          updatedAt: CREATED,
          used: 12,
        },
      ],
    ],
    [workspaceAiPolicy, [{ keyMode: "platform", monthlyBudgetMicrounits: 123456789n }]],
    [
      entitlement,
      [
        {
          createdAt: CREATED,
          expiresAt: null,
          id: "ent_1",
          key: "pro",
          source: "billing",
          sourceReference: null,
          status: "active",
          updatedAt: CREATED,
        },
      ],
    ],
    [
      // Full table shape — metadata/ipAddress stay server-side.
      auditEvent,
      [
        {
          action: "content_entry.created",
          actorUserId: "user_1",
          createdAt: CREATED,
          id: "audit_1",
          ipAddress: "203.0.113.10",
          metadata: { note: "sensitive-audit-metadata" },
          targetId: "entry_1",
          targetType: "content_entry",
        },
      ],
    ],
    [user, []],
  ]);
}

describe("buildWorkspaceExport", () => {
  it("produces the documented top-level shape", async () => {
    const db = createFakeDb(new Map());
    const data = await buildWorkspaceExport("ws_1", NOW, db);
    expect(data.format).toBe("supastack.workspace-export");
    expect(data.version).toBe(1);
    expect(data.exportedAt).toBe("2026-10-16T12:00:00.000Z");
    for (const key of [
      "workspace",
      "members",
      "invitations",
      "content",
      "commerce",
      "schedules",
      "webhooks",
      "apiKeys",
      "domains",
      "featureRequests",
      "credits",
      "usage",
      "aiPolicy",
      "entitlements",
      "auditLog",
    ]) {
      expect(data).toHaveProperty(key);
    }
    expect(data.commerce).toEqual({ orders: [], products: [] });
    expect(data.webhooks).toEqual({ deliveries: [], endpoints: [] });
    expect(data.usage).toEqual({ caps: [], counters: [] });
    expect(data.credits).toEqual({ balance: 0, transactions: [], updatedAt: null });
    expect(data.workspace).toBeNull();
    expect(data.aiPolicy).toBeNull();
  });

  it("exports workspace data with the expected fields", async () => {
    const db = createFakeDb(seedFixtures());
    const data = await buildWorkspaceExport("ws_1", NOW, db);
    expect(data.workspace).toMatchObject({ id: "ws_1", name: "Acme", slug: "acme" });
    expect(data.members).toEqual([
      {
        email: "owner@example.test",
        joinedAt: CREATED.toISOString(),
        name: "Owner",
        role: "owner",
        userId: "user_1",
      },
    ]);
    expect(data.invitations).toHaveLength(1);
    expect(data.content).toHaveLength(1);
    expect(data.commerce.products).toHaveLength(1);
    expect(data.commerce.orders[0]).toMatchObject({ id: "order_1" });
    expect(data.commerce.orders[0]?.items).toEqual([
      {
        createdAt: CREATED.toISOString(),
        id: "item_1",
        orderId: "order_1",
        productId: "prod_1",
        productName: "Mug",
        quantity: 2,
        unitPriceCents: 1500,
      },
    ]);
    expect(data.credits.balance).toBe(42);
    expect(data.credits.transactions).toHaveLength(1);
    expect(data.usage.caps).toHaveLength(1);
    expect(data.usage.counters).toHaveLength(1);
    expect(data.entitlements).toHaveLength(1);
    expect(data.auditLog).toHaveLength(1);
  });

  it("scopes every query to the workspace id", async () => {
    const db = createFakeDb(seedFixtures());
    await buildWorkspaceExport("ws_1", NOW, db);
    expect(db.queries.length).toBeGreaterThan(10);
    for (const query of db.queries) {
      expect(query.whereParams).toContain("ws_1");
    }
  });

  it("never serializes secret, token, hash, or payload material", async () => {
    const db = createFakeDb(seedFixtures());
    const data = await buildWorkspaceExport("ws_1", NOW, db);
    // No select list may name a secret-bearing column — this is the only
    // line of defense between a Postgres row and the download.
    for (const query of db.queries) {
      for (const key of query.selectionKeys) {
        expect(key).not.toMatch(/token|secret|hash|payload|credential|ipAddress|metadata/i);
      }
    }
    const serialized = JSON.stringify(data);
    for (const marker of [
      "secret-invite-token-value",
      "whsec_live_signing_secret",
      "deadbeef-api-key-hash",
      "sensitive-payload-body",
      "sensitive-audit-metadata",
      "203.0.113.10",
    ]) {
      expect(serialized).not.toContain(marker);
    }
    // Structural assertions so the exclusions above cannot be satisfied by
    // empty sections.
    expect(data.invitations[0]).not.toHaveProperty("token");
    expect(data.webhooks.endpoints[0]).not.toHaveProperty("secret");
    expect(data.webhooks.deliveries[0]).not.toHaveProperty("payload");
    expect(data.apiKeys[0]).not.toHaveProperty("keyHash");
  });

  it("normalizes Date and bigint values for JSON", async () => {
    const db = createFakeDb(seedFixtures());
    const data = await buildWorkspaceExport("ws_1", NOW, db);
    expect(data.aiPolicy).toEqual({
      keyMode: "platform",
      monthlyBudgetMicrounits: "123456789",
    });
    expect(data.workspace?.createdAt).toBe("2026-01-05T08:30:00.000Z");
    // Round-trips through JSON unchanged — every value is already safe.
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it("trims usage counters to the last 12 monthly periods", async () => {
    const db = createFakeDb(seedFixtures());
    await buildWorkspaceExport("ws_1", NOW, db);
    // The counter query is the only one whose where params include a date
    // bound (the dialect serializes Date params to ISO strings).
    const counterQueries = db.queries.filter((query) =>
      query.whereParams.some(
        (param) => typeof param === "string" && /^\d{4}-\d{2}-\d{2}T/.test(param),
      ),
    );
    expect(counterQueries).toHaveLength(1);
    const floor = counterQueries[0]?.whereParams.find(
      (param): param is string => typeof param === "string" && /^\d{4}-/.test(param),
    );
    expect(floor).toBe("2025-11-01T00:00:00.000Z");
  });

  it("limits webhook deliveries, credit transactions, and audit events", async () => {
    const db = createFakeDb(seedFixtures());
    await buildWorkspaceExport("ws_1", NOW, db);
    const deliveries = db.queries.find((query) => query.table === webhookDelivery);
    const audit = db.queries.find((query) => query.table === auditEvent);
    const ledger = db.queries.find((query) => query.table === creditTransaction);
    expect(deliveries?.limit).toBe(100);
    expect(audit?.limit).toBe(1000);
    expect(ledger?.limit).toBe(1000);
  });
});
