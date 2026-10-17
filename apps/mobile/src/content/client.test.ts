import { describe, expect, test } from "vitest";

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import { createMobileContentActions } from "./client";

function makeApi(routes: Record<string, unknown>, seen?: { path: string; method: string }[]) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname + new URL(url).search;
    seen?.push({ method: init.method, path });
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

const entry = {
  createdAt: "2026-10-01T12:00:00.000Z",
  excerpt: null,
  id: "con_1",
  locale: "en",
  publishedAt: null,
  requiredEntitlement: null,
  slug: "hello-world",
  status: "draft",
  title: "Hello world",
  type: "post",
  updatedAt: "2026-10-03T00:00:00.000Z",
};

describe("createMobileContentActions", () => {
  test("list filters malformed rows and reads writable", async () => {
    const content = createMobileContentActions(
      makeApi({
        "/api/mobile/content": {
          entries: [entry, { bad: true }, { ...entry, id: "con_2", status: "nope" }],
          writable: true,
        },
      }),
    );
    const payload = await content.list();
    expect(payload.writable).toBe(true);
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0]?.id).toBe("con_1");
    expect(payload.entries[0]?.status).toBe("draft");
  });

  test("list throws on a structurally invalid payload", async () => {
    const content = createMobileContentActions(makeApi({ "/api/mobile/content": { nope: 1 } }));
    await expect(content.list()).rejects.toThrow("invalid");
  });

  test("create POSTs fields and unwraps {entryId}", async () => {
    const seen: { method: string; path: string }[] = [];
    const content = createMobileContentActions(
      makeApi({ "/api/mobile/content": { entryId: "con_9" } }, seen),
    );
    await expect(
      content.create({ slug: "hello-world", title: "Hello world", type: "post" }),
    ).resolves.toEqual({ entryId: "con_9" });
    expect(seen[0]).toEqual({ method: "POST", path: "/api/mobile/content" });
  });

  test("get returns the entry with its body for the edit form", async () => {
    const seen: { method: string; path: string }[] = [];
    const content = createMobileContentActions(
      makeApi({ "/api/mobile/content/con_1": { entry: { ...entry, body: "# Hi" } } }, seen),
    );
    const detail = await content.get("con_1");
    expect(seen[0]).toEqual({ method: "GET", path: "/api/mobile/content/con_1" });
    expect(detail.id).toBe("con_1");
    expect(detail.body).toBe("# Hi");
  });

  test("get throws on an entry without a body or a malformed payload", async () => {
    const content = createMobileContentActions(
      makeApi({ "/api/mobile/content/con_1": { entry: { ...entry } } }),
    );
    await expect(content.get("con_1")).rejects.toThrow("invalid");
    const malformed = createMobileContentActions(
      makeApi({ "/api/mobile/content/con_1": { entry: { nope: true } } }),
    );
    await expect(malformed.get("con_1")).rejects.toThrow("invalid");
  });

  test("update PATCHes the fields to the entry route", async () => {
    const seen: { method: string; path: string }[] = [];
    const content = createMobileContentActions(
      makeApi({ "/api/mobile/content/con_1": { ok: true } }, seen),
    );
    await content.update("con_1", { title: "Renamed", type: "post" });
    expect(seen[0]).toEqual({ method: "PATCH", path: "/api/mobile/content/con_1" });
  });

  test("setStatus PATCHes {status} and remove DELETEs the entry route", async () => {
    const seen: { method: string; path: string }[] = [];
    const content = createMobileContentActions(
      makeApi({ "/api/mobile/content/con_1": { ok: true } }, seen),
    );
    await content.setStatus("con_1", "published");
    await content.remove("con_1");
    expect(seen[0]).toEqual({ method: "PATCH", path: "/api/mobile/content/con_1" });
    expect(seen[1]).toEqual({ method: "DELETE", path: "/api/mobile/content/con_1" });
  });
});
