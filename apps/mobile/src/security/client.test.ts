import { describe, expect, test } from "vitest";

import { createMobileApiClient, MobileApiError, type MobileApiFetch } from "../api/client";
import { createMobileSecurityActions, type MobileSecurityClient } from "./client";

const stubAuthClient: MobileSecurityClient = {
  listAccounts: async () => [],
  listSessions: async () => [],
  revokeOtherSessions: async () => undefined,
  revokeSession: async () => undefined,
  unlinkAccount: async () => undefined,
};

function makeApi(
  routes: Record<string, { payload: unknown; status?: number }>,
  seen?: { method: string; path: string }[],
) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname;
    seen?.push({ method: init.method, path });
    const route = routes[path];
    if (route === undefined) {
      return { json: async () => ({ error: "Not found" }), ok: false, status: 404 };
    }
    const status = route.status ?? 200;
    return { json: async () => route.payload, ok: status < 400, status };
  };
  return createMobileApiClient(
    { apiUrl: "https://api.example.test", getCookie: async () => "c=1" },
    transport,
  );
}

describe("createMobileSecurityActions.exportAccountData", () => {
  test("GETs /api/account/export and returns the record verbatim", async () => {
    const seen: { method: string; path: string }[] = [];
    const exported = { exportedAt: "2026-10-10T00:00:00.000Z", user: { id: "u1" } };
    const security = createMobileSecurityActions(
      stubAuthClient,
      makeApi({ "/api/account/export": { payload: exported } }, seen),
    );

    await expect(security.exportAccountData()).resolves.toEqual(exported);
    expect(seen[0]).toEqual({ method: "GET", path: "/api/account/export" });
  });

  test("rejects when the payload is not a JSON record", async () => {
    const security = createMobileSecurityActions(
      stubAuthClient,
      makeApi({ "/api/account/export": { payload: ["not", "a", "record"] } }),
    );
    await expect(security.exportAccountData()).rejects.toThrow(
      "The account data export was invalid.",
    );
  });

  test("propagates the MobileApiError for a non-ok response", async () => {
    const security = createMobileSecurityActions(
      stubAuthClient,
      makeApi({
        "/api/account/export": {
          payload: { error: { code: "unauthorized", message: "Authentication is required." } },
          status: 401,
        },
      }),
    );
    const err = await security.exportAccountData().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MobileApiError);
    expect((err as MobileApiError).message).toBe("Authentication is required.");
  });

  test("throws when no API client was provided", async () => {
    const security = createMobileSecurityActions(stubAuthClient);
    await expect(security.exportAccountData()).rejects.toThrow(
      "The account data export is unavailable.",
    );
  });
});
