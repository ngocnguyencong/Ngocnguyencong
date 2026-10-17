import { describe, expect, test } from "vitest";

import { createMobileApiClient, MobileApiError, type MobileApiFetch } from "./client";

function makeClient(fetchImpl: MobileApiFetch) {
  return createMobileApiClient(
    { apiUrl: "https://api.example.test", getCookie: async () => "better-auth.session_token=tok" },
    fetchImpl,
  );
}

describe("createMobileApiClient", () => {
  test("sends the session cookie and JSON headers on every request", async () => {
    let seen:
      { init: { headers: Record<string, string>; method: string }; url: string } | undefined;
    const api = makeClient(async (url, init) => {
      seen = { init, url };
      return { json: async () => ({}), ok: true, status: 200 };
    });

    await api.request("/api/workspace/metrics");
    expect(seen?.url).toBe("https://api.example.test/api/workspace/metrics");
    expect(seen?.init.headers.Cookie).toBe("better-auth.session_token=tok");
    expect(seen?.init.method).toBe("GET");
  });

  test("serializes the body and sets Content-Type when a body is given", async () => {
    let seen: { body?: string; headers: Record<string, string> } | undefined;
    const api = makeClient(async (_url, init) => {
      seen = { body: init.body, headers: init.headers };
      return { json: async () => ({}), ok: true, status: 200 };
    });

    await api.request("/api/mobile/invitations", {
      body: { email: "a@b.c", role: "member" },
      method: "POST",
    });
    expect(seen?.body).toBe(JSON.stringify({ email: "a@b.c", role: "member" }));
    expect(seen?.headers["Content-Type"]).toBe("application/json");
  });

  test("throws MobileApiError with code and message from {error:{code,message}}", async () => {
    const api = makeClient(async () => ({
      json: async () => ({ error: { code: "seatLimitExceeded", message: "No seats left." } }),
      ok: false,
      status: 409,
    }));

    const err = await api.request("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MobileApiError);
    expect((err as MobileApiError).status).toBe(409);
    expect((err as MobileApiError).code).toBe("seatLimitExceeded");
    expect((err as MobileApiError).message).toBe("No seats left.");
  });

  test("throws MobileApiError for a string error payload", async () => {
    const api = makeClient(async () => ({
      json: async () => ({ error: "Unauthorized" }),
      ok: false,
      status: 401,
    }));
    const err = await api.request("/x").catch((e: unknown) => e);
    expect((err as MobileApiError).message).toBe("Unauthorized");
  });

  test("throws 401 when no cookie is available", async () => {
    const api = createMobileApiClient(
      { apiUrl: "https://api.example.test", getCookie: async () => null },
      async () => ({ json: async () => ({}), ok: true, status: 200 }),
    );
    const err = await api.request("/x").catch((e: unknown) => e);
    expect((err as MobileApiError).status).toBe(401);
  });

  test("returns the parsed payload via the parse hook", async () => {
    const api = makeClient(async () => ({
      json: async () => ({ data: { n: 2 } }),
      ok: true,
      status: 200,
    }));
    const result = await api.request("/x", {
      parse: (value) => (value as { data: { n: number } }).data.n * 10,
    });
    expect(result).toBe(20);
  });
});
