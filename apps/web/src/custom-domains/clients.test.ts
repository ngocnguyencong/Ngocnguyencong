import { describe, expect, it } from "vitest";

import { createCloudflareDomainClient } from "./cloudflare-client";
import { createLocalDomainClient } from "./local-client";

describe("createCloudflareDomainClient", () => {
  const config = {
    apiToken: "cf-token-secret",
    cnameTarget: "customers.supastack.dev",
    zoneId: "zone123",
  };

  function fetchReturning(body: unknown, init?: { status?: number }) {
    const calls: { body: string | undefined; headers: Headers; method: string; url: string }[] = [];
    const fetchImpl = async (url: string | URL, request?: RequestInit) => {
      calls.push({
        body: typeof request?.body === "string" ? request.body : undefined,
        headers: new Headers(request?.headers),
        method: request?.method ?? "GET",
        url: String(url),
      });
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
        status: init?.status ?? 200,
      });
    };
    return { calls, fetchImpl };
  }

  it("creates a custom hostname with DV txt validation and workspace metadata", async () => {
    const { calls, fetchImpl } = fetchReturning({
      result: {
        hostname: "portal.acme.test",
        id: "ch_123",
        ownership_verification: {
          name: "_cf-custom-hostname.portal.acme.test",
          type: "txt",
          value: "own-123",
        },
        ssl: {
          status: "pending_validation",
          validation_records: [
            { txt_name: "_acme-challenge.portal.acme.test", txt_value: "dcv-1" },
          ],
        },
        status: "pending",
      },
      success: true,
    });
    const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });

    const created = await client.createHostname({
      hostname: "portal.acme.test",
      metadata: { workspaceId: "ws_1" },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.url).toBe(
      "https://api.cloudflare.com/client/v4/zones/zone123/custom_hostnames",
    );
    expect(calls[0]!.headers.get("authorization")).toBe("Bearer cf-token-secret");
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      custom_metadata: { workspaceId: "ws_1" },
      hostname: "portal.acme.test",
      ssl: { method: "txt", settings: { min_tls_version: "1.2" }, type: "dv" },
    });
    expect(created).toEqual({
      hostname: "portal.acme.test",
      id: "ch_123",
      sslStatus: "pending_validation",
      status: "pending",
      verification: {
        cnameTarget: "customers.supastack.dev",
        dcvRecords: [{ txtName: "_acme-challenge.portal.acme.test", txtValue: "dcv-1" }],
        ownership: {
          name: "_cf-custom-hostname.portal.acme.test",
          type: "txt",
          value: "own-123",
        },
      },
    });
  });

  it("maps provider statuses onto the internal lifecycle", async () => {
    const statuses: [string, string][] = [
      ["active", "active"],
      ["active_redeploying", "active"],
      ["provisioned", "active"],
      ["pending", "pending"],
      ["test_pending", "pending"],
      ["moved", "moved"],
      ["deleted", "deleted"],
      ["pending_deletion", "deleted"],
      ["blocked", "failed"],
      ["test_failed", "failed"],
      ["pending_blocked", "failed"],
    ];
    for (const [remote, expected] of statuses) {
      const { fetchImpl } = fetchReturning({
        result: {
          hostname: "h.test",
          id: "ch",
          ssl: { status: "pending_validation" },
          status: remote,
        },
        success: true,
      });
      const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });
      const got = await client.getHostname("ch");
      expect(got.status, remote).toBe(expected);
    }
  });

  it("deletes through the same zone-scoped resource", async () => {
    const { calls, fetchImpl } = fetchReturning({ result: { id: "ch_9" }, success: true });
    const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });
    await client.deleteHostname("ch_9");
    expect(calls[0]!.method).toBe("DELETE");
    expect(calls[0]!.url).toBe(
      "https://api.cloudflare.com/client/v4/zones/zone123/custom_hostnames/ch_9",
    );
  });

  it("treats a 404 on delete as success — the hostname is already gone", async () => {
    const { fetchImpl } = fetchReturning(
      { errors: [{ code: 1000, message: "custom hostname not found" }], success: false },
      { status: 404 },
    );
    const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });
    await expect(client.deleteHostname("ch_gone")).resolves.toBeUndefined();
  });

  it("still throws delete failures that are not 404", async () => {
    const { fetchImpl } = fetchReturning(
      { errors: [{ code: 1001, message: "internal error" }], success: false },
      { status: 500 },
    );
    const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });
    await expect(client.deleteHostname("ch_9")).rejects.toThrowError(/internal error/);
  });

  it("surfaces Cloudflare errors without leaking the token", async () => {
    const { fetchImpl } = fetchReturning(
      {
        errors: [
          { code: 1400, message: "cf-token-secret must not appear" },
          { code: 1001, message: "hostname already exists" },
        ],
        success: false,
      },
      { status: 400 },
    );
    const client = createCloudflareDomainClient({ ...config, fetch: fetchImpl });
    const error = await client.getHostname("ch").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/hostname already exists/);
    expect((error as Error).message).not.toContain("cf-token-secret");
  });
});

describe("createLocalDomainClient", () => {
  it("activates immediately with the local CNAME target", async () => {
    const client = createLocalDomainClient({ cnameTarget: "customers.localhost" });
    const created = await client.createHostname({
      hostname: "portal.acme.test",
      metadata: { workspaceId: "ws_1" },
    });
    expect(created.status).toBe("active");
    expect(created.sslStatus).toBe("active");
    expect(created.verification.cnameTarget).toBe("customers.localhost");
    expect(await client.getHostname(created.id)).toEqual(created);
    await expect(client.deleteHostname(created.id)).resolves.toBeUndefined();
    await expect(client.getHostname(created.id)).rejects.toThrowError(/not found/i);
    await expect(client.deleteHostname("local_missing.test")).resolves.toBeUndefined();
  });
});
