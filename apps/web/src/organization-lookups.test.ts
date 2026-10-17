import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  session: { user: { id: "user_1" } } as { user: { id: string } } | null,
  cookieWorkspace: undefined as string | undefined,
  member: true,
  price: "pro_monthly" as string | undefined,
  preference: vi.fn(),
  reads: [] as { kind: string; params: unknown[] }[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.cookieWorkspace === undefined ? undefined : { value: state.cookieWorkspace }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({ providers: { email: { kind: "local" } } }),
}));
vi.mock("./server-provider-composition", () => ({
  createServerTransactionalEmailSender: () => ({ send: vi.fn() }),
}));
vi.mock("./audit-runtime", () => ({ recordAuditEvent: vi.fn() }));
vi.mock("./notification-runtime", () => ({ tryEmitProductNotification: vi.fn() }));
vi.mock("./webhook-delivery", () => ({ tryEmitWorkspaceEvent: vi.fn() }));
vi.mock("./storage-runtime", () => ({ createServerObjectStorage: vi.fn() }));
vi.mock("./storage-upload-admission", () => ({ checkStorageImageUploadAdmission: vi.fn() }));
vi.mock("./storage-image-runtime", () => ({ replaceStoredWorkspaceImage: vi.fn() }));
vi.mock("./auth-runtime", () => ({
  getAuthSession: async () => state.session,
  database: {
    query: { userWorkspacePreference: { findFirst: state.preference } },
    select(selection: Record<string, unknown>) {
      const kind = "priceReference" in selection ? "billing" : "membership";
      return {
        from: () => ({
          where: (condition: SQL) => ({
            limit: async () => {
              state.reads.push({ kind, params: new PgDialect().sqlToQuery(condition).params });
              if (kind === "membership") return state.member ? [{ workspaceId: "ws_1" }] : [];
              return state.price === undefined ? [] : [{ priceReference: state.price }];
            },
          }),
        }),
      };
    },
  },
}));

import { getWorkspaceSeatLimit, resolveActiveWorkspaceIdForUser } from "./organization-actions";

beforeEach(() => {
  state.session = { user: { id: "user_1" } };
  state.cookieWorkspace = undefined;
  state.member = true;
  state.price = "pro_monthly";
  state.reads = [];
  state.preference.mockReset().mockResolvedValue({ activeWorkspaceId: "ws_1" });
});

describe("organization lookup action authorization", () => {
  it.each([null, { user: { id: "other_user" } }])(
    "denies anonymous or cross-user preferences before reading storage",
    async (session) => {
      state.session = session;
      expect(await resolveActiveWorkspaceIdForUser("user_1")).toBeUndefined();
      expect(state.preference).not.toHaveBeenCalled();
    },
  );

  it("preserves current-user preference resolution", async () => {
    expect(await resolveActiveWorkspaceIdForUser("user_1")).toBe("ws_1");
    expect(state.preference).toHaveBeenCalledOnce();
  });

  it("preserves the current-user workspace cookie precedence", async () => {
    state.cookieWorkspace = "ws_cookie";
    expect(await resolveActiveWorkspaceIdForUser("user_1")).toBe("ws_cookie");
    expect(state.preference).not.toHaveBeenCalled();
  });

  it("denies anonymous seat lookups before database reads", async () => {
    state.session = null;
    await expect(getWorkspaceSeatLimit("ws_1")).rejects.toThrow("Workspace access required.");
    expect(state.reads).toEqual([]);
  });

  it("denies non-member seat lookups before billing reads", async () => {
    state.member = false;
    await expect(getWorkspaceSeatLimit("ws_1")).rejects.toThrow("Workspace access required.");
    expect(state.reads).toEqual([{ kind: "membership", params: ["user_1", "ws_1"] }]);
  });

  it.each([
    [undefined, 1],
    ["pro_monthly", 5],
    ["business_monthly", 20],
    ["enterprise_monthly", null],
  ])("preserves member seat limits for %s", async (price, expected) => {
    state.price = price;
    expect(await getWorkspaceSeatLimit("ws_1")).toBe(expected);
    expect(state.reads).toEqual([
      { kind: "membership", params: ["user_1", "ws_1"] },
      { kind: "billing", params: ["ws_1", "active"] },
    ]);
  });
});
