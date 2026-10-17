import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  manager: { userId: "user_1", workspaceId: "ws_1" } as
    { userId: string; workspaceId: string } | { error: string },
  create: vi.fn(),
  remove: vi.fn(),
  queue: Promise.resolve(),
}));

vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({
    app: { webUrl: "https://app.example.com" },
    customDomains: { kind: "local", cnameTarget: "customers.example.com" },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../workspace-access", () => ({ requireWorkspaceManager: async () => state.manager }));
vi.mock("../audit-runtime", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("../webhook-delivery", () => ({ emitWorkspaceEvent: vi.fn() }));
vi.mock("./runtime", () => ({
  createCustomDomainProvider: () => ({
    cnameTarget: "customers.example.com",
    provider: { createHostname: state.create, deleteHostname: state.remove },
  }),
  invalidateDomainResolverCache: vi.fn(),
}));
vi.mock("../auth-runtime", () => {
  const database = {
    select(selection: Record<string, unknown>) {
      return {
        from: () => ({
          where: () =>
            "value" in selection
              ? Promise.resolve([{ value: state.rows.length }])
              : { limit: async () => [] },
        }),
      };
    },
    insert: () => ({ values: async (row: Record<string, unknown>) => state.rows.push(row) }),
    async transaction<T>(body: (transaction: object) => Promise<T>): Promise<T> {
      let release: (() => void) | undefined;
      try {
        return await body({
          ...database,
          execute: async (query: SQL) => {
            const statement = new PgDialect().sqlToQuery(query);
            expect(statement.sql).toBe("select pg_advisory_xact_lock(hashtextextended($1, 0))");
            expect(statement.params).toEqual(["custom-domain-create:ws_1"]);
            const previous = state.queue;
            state.queue = new Promise<void>((resolve) => {
              release = resolve;
            });
            await previous;
          },
        });
      } finally {
        release?.();
      }
    },
  };
  return { database };
});

import { addWorkspaceDomain } from "./domain-actions";

beforeEach(() => {
  state.rows = [];
  state.queue = Promise.resolve();
  state.manager = { userId: "user_1", workspaceId: "ws_1" };
  state.remove.mockReset();
  state.create.mockReset().mockImplementation(async ({ hostname }: { hostname: string }) => {
    await Promise.resolve();
    return {
      hostname,
      id: `remote_${hostname}`,
      status: "pending",
      sslStatus: "pending",
      verification: { cnameTarget: "customers.example.com", dcvRecords: [] },
    };
  });
});

describe("workspace domain admission", () => {
  it("limits concurrent distinct hostnames before provider creation", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        addWorkspaceDomain({ hostname: `portal${index}.customer.example.com` }),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(5);
    expect(state.create).toHaveBeenCalledTimes(5);
    expect(state.rows).toHaveLength(5);
    expect(
      results.filter((result) => !result.ok).every((result) => result.error?.includes("5")),
    ).toBe(true);
  });

  it("preserves ordinary scoped creation below quota", async () => {
    expect(await addWorkspaceDomain({ hostname: "portal.customer.example.com" })).toEqual({
      ok: true,
    });
    expect(state.rows[0]).toMatchObject({
      workspaceId: "ws_1",
      hostname: "portal.customer.example.com",
    });
  });

  it("rejects non-managers before provider creation", async () => {
    state.manager = { error: "Owner or admin required." };
    expect(await addWorkspaceDomain({ hostname: "portal.customer.example.com" })).toEqual({
      ok: false,
      error: "Owner or admin required.",
    });
    expect(state.create).not.toHaveBeenCalled();
  });

  it("does not consume a durable slot when provider creation fails", async () => {
    state.create.mockRejectedValueOnce(new Error("Provider unavailable."));
    expect(await addWorkspaceDomain({ hostname: "portal.customer.example.com" })).toEqual({
      ok: false,
      error: "Provider unavailable.",
    });
    expect(state.rows).toHaveLength(0);
    expect(await addWorkspaceDomain({ hostname: "retry.customer.example.com" })).toEqual({
      ok: true,
    });
  });
});
