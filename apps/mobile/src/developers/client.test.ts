import { describe, expect, test } from "vitest";

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import {
  createMobileDeveloperActions,
  formatApiKeyMeta,
  formatDeliveryMeta,
  parseApiKeyExpiryDays,
  scheduleToggleInput,
} from "./client";

interface SeenRequest {
  body?: string;
  method: string;
  path: string;
}

function makeApi(routes: Record<string, unknown>, seen?: SeenRequest[]) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname + new URL(url).search;
    seen?.push({
      ...(init.body === undefined ? {} : { body: init.body }),
      method: init.method,
      path,
    });
    const payload = routes[path];
    if (payload === undefined) {
      return { json: async () => ({ error: "Not found" }), ok: false, status: 404 };
    }
    return { json: async () => payload, ok: true, status: 200 };
  };
  return createMobileApiClient(
    { apiUrl: "https://api.example.test", getCookie: async () => "c=1" },
    transport,
  );
}

describe("createMobileDeveloperActions", () => {
  test("apiKeys.create unwraps {keyId, plaintext}", async () => {
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/api-keys": { keyId: "k1", plaintext: "sk_test_x" } }),
    );
    await expect(dev.apiKeys.create({ name: "ci", scopes: ["read"] })).resolves.toEqual({
      keyId: "k1",
      plaintext: "sk_test_x",
    });
  });

  test("apiKeys.create forwards expiresInDays", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/api-keys": { keyId: "k1", plaintext: "sk_test_x" } }, seen),
    );
    await dev.apiKeys.create({ expiresInDays: 30, name: "ci", scopes: ["read"] });
    expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({
      expiresInDays: 30,
      name: "ci",
      scopes: ["read"],
    });
  });

  test("apiKeys.list filters malformed rows", async () => {
    const dev = createMobileDeveloperActions(
      makeApi({
        "/api/mobile/api-keys": {
          keys: [
            { id: "k1", name: "a", prefix: "sk_t", scopes: ["read"], status: "active" },
            { bad: true },
          ],
        },
      }),
    );
    const keys = await dev.apiKeys.list();
    expect(keys).toHaveLength(1);
    expect(keys[0]?.id).toBe("k1");
  });

  test("webhooks.create returns the one-time secret", async () => {
    const dev = createMobileDeveloperActions(
      makeApi({
        "/api/mobile/webhooks": { endpointId: "e1", secret: "whsec_1" },
      }),
    );
    await expect(
      dev.webhooks.create({ events: ["member.joined"], url: "https://x.test/h" }),
    ).resolves.toEqual({ endpointId: "e1", secret: "whsec_1" });
  });

  test("webhooks.deliveries GETs the endpoint's delivery list and filters rows", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi(
        {
          "/api/mobile/webhooks/ep_1/deliveries": {
            deliveries: [
              {
                attempts: 2,
                createdAt: "2026-10-12T08:00:00.000Z",
                deliveredAt: "2026-10-12T08:00:04.000Z",
                eventType: "member.joined",
                id: "whd_1",
                lastError: null,
                responseCode: 200,
                status: "delivered",
              },
              { bad: true },
            ],
          },
        },
        seen,
      ),
    );
    const deliveries = await dev.webhooks.deliveries("ep_1");
    expect(seen[0]).toEqual({
      method: "GET",
      path: "/api/mobile/webhooks/ep_1/deliveries",
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.id).toBe("whd_1");
  });

  test("webhooks.deliveries encodes the endpoint id", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/webhooks/ep%201/deliveries": { deliveries: [] } }, seen),
    );
    await dev.webhooks.deliveries("ep 1");
    expect(seen[0]?.path).toBe("/api/mobile/webhooks/ep%201/deliveries");
  });

  test("domains.list reads cnameTarget and enabled flag", async () => {
    const dev = createMobileDeveloperActions(
      makeApi({
        "/api/mobile/domains": {
          cnameTarget: "target.example",
          domains: [{ hostname: "a.example", id: "d1", status: "pending" }],
          enabled: true,
        },
      }),
    );
    const payload = await dev.domains.list();
    expect(payload.enabled).toBe(true);
    expect(payload.cnameTarget).toBe("target.example");
    expect(payload.domains[0]?.hostname).toBe("a.example");
  });

  test("audit.list hits /api/mobile/audit with the limit", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/audit?limit=50": { rows: [] } }, seen),
    );
    await dev.audit.list(50);
    expect(seen[0]).toEqual({ method: "GET", path: "/api/mobile/audit?limit=50" });
  });

  test("schedules.upsert POSTs the schedule body", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/schedules": { ok: true } }, seen),
    );
    await dev.schedules.upsert({ cron: "0 9 * * 1", type: "email.digest" });
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.path).toBe("/api/mobile/schedules");
  });

  test("schedules.upsert forwards the flipped enabled flag for pause/resume", async () => {
    const seen: SeenRequest[] = [];
    const dev = createMobileDeveloperActions(
      makeApi({ "/api/mobile/schedules": { ok: true } }, seen),
    );
    await dev.schedules.upsert(
      scheduleToggleInput({
        cron: "0 9 * * 1",
        enabled: true,
        id: "s1",
        lastRunAt: null,
        nextRunAt: null,
        type: "email.digest",
      }),
    );
    expect(seen[0]?.method).toBe("POST");
    expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({
      cron: "0 9 * * 1",
      enabled: false,
      type: "email.digest",
    });
  });
});

describe("scheduleToggleInput", () => {
  const schedule = {
    cron: "0 9 * * 1",
    enabled: true,
    id: "s1",
    lastRunAt: null,
    nextRunAt: "2026-10-13T09:00:00.000Z",
    type: "email.digest",
  };

  test("pauses an enabled schedule", () => {
    expect(scheduleToggleInput(schedule)).toEqual({
      cron: "0 9 * * 1",
      enabled: false,
      type: "email.digest",
    });
  });

  test("resumes a paused schedule", () => {
    expect(scheduleToggleInput({ ...schedule, enabled: false })).toEqual({
      cron: "0 9 * * 1",
      enabled: true,
      type: "email.digest",
    });
  });
});

describe("parseApiKeyExpiryDays", () => {
  test("parses a whole-day count", () => {
    expect(parseApiKeyExpiryDays("30")).toBe(30);
  });

  test("truncates decimals and clamps negatives to 0 (never expires)", () => {
    expect(parseApiKeyExpiryDays("12.9")).toBe(12);
    expect(parseApiKeyExpiryDays("-5")).toBe(0);
  });

  test("caps at the server maximum of 3650 days", () => {
    expect(parseApiKeyExpiryDays("99999")).toBe(3650);
  });

  test.each(["", "   ", "abc", "NaN", "Infinity"])("treats %j as 0", (raw) => {
    expect(parseApiKeyExpiryDays(raw)).toBe(0);
  });
});

describe("formatApiKeyMeta", () => {
  const key = {
    createdAt: "2026-10-01T12:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    id: "k1",
    lastUsedAt: "2026-10-10T08:00:00.000Z",
    name: "CI",
    prefix: "sk_test",
    scopes: ["read", "write"],
    status: "active" as const,
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString();

  test("joins prefix, scopes, created, last used, and expiry", () => {
    expect(formatApiKeyMeta(key)).toBe(
      `sk_test… · read, write · created ${day(key.createdAt)} · last used ${day(key.lastUsedAt!)} · expires ${day(key.expiresAt)}`,
    );
  });

  test("em-dashes a missing lastUsedAt and omits a missing expiry", () => {
    expect(formatApiKeyMeta({ ...key, expiresAt: null, lastUsedAt: null })).toBe(
      `sk_test… · read, write · created ${day(key.createdAt)} · last used —`,
    );
  });
});

describe("formatDeliveryMeta", () => {
  const delivery = {
    attempts: 1,
    createdAt: "2026-10-12T08:00:00.000Z",
    deliveredAt: null,
    eventType: "member.joined",
    id: "whd_1",
    lastError: null,
    responseCode: null,
    status: "pending",
  };

  test("pluralizes attempts and appends the response code", () => {
    expect(formatDeliveryMeta({ ...delivery, attempts: 3, responseCode: 500 })).toBe(
      "3 attempts · HTTP 500",
    );
  });

  test("uses the singular for one attempt and omits a missing response code", () => {
    expect(formatDeliveryMeta(delivery)).toBe("1 attempt");
  });
});
