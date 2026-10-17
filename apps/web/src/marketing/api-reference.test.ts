import type { SupastackOpenApiDocument } from "@supastack/api";
import { describe, expect, it } from "vitest";

import { apiReferenceGroups, type ApiReferenceGroup } from "./api-reference";

/** The shipped type narrows operations to `responses`; the generated document
 * carries summary/tags/security — tests widen it the same way the page does. */
function doc(paths: Record<string, unknown>): SupastackOpenApiDocument {
  return {
    info: { title: "Test", version: "0" },
    openapi: "3.1.0",
    paths,
  } as unknown as SupastackOpenApiDocument;
}

function flat(groups: readonly ApiReferenceGroup[]) {
  return groups.flatMap((group) => group.endpoints);
}

describe("apiReferenceGroups", () => {
  it("lists every registered /api/v1 operation grouped by its tag", () => {
    const groups = apiReferenceGroups();
    const endpoints = flat(groups);
    expect(endpoints.length).toBeGreaterThan(0);
    for (const endpoint of endpoints) {
      expect(endpoint.path.startsWith("/api/v1/")).toBe(true);
      expect(endpoint.method).toMatch(/^[A-Z]+$/);
      expect(endpoint.summary.length).toBeGreaterThan(0);
      expect(endpoint.auth).toBe("session-or-key");
    }
    // The published tags today — if the registry regroups, update the page copy.
    expect(groups.map((group) => group.tag)).toEqual(
      expect.arrayContaining(["Workspaces", "Entitlements", "Models", "AI tasks"]),
    );
  });

  it("marks explicit security: [] operations public", () => {
    const groups = apiReferenceGroups(
      doc({
        "/api/v1/ping": {
          get: { summary: "Ping", tags: ["Misc"], security: [] },
        },
      }),
    );
    expect(flat(groups)[0]?.auth).toBe("public");
  });

  it("collects untagged operations under a General section", () => {
    const groups = apiReferenceGroups(doc({ "/api/v1/ping": { get: {} } }));
    expect(groups).toEqual([
      {
        tag: "General",
        endpoints: [
          {
            method: "GET",
            path: "/api/v1/ping",
            summary: "",
            auth: "session-or-key",
          },
        ],
      },
    ]);
  });

  it("skips nullish path items and present-but-empty operations", () => {
    const groups = apiReferenceGroups(
      doc({
        "/api/v1/ping": null,
        "/api/v1/pong": { get: undefined, post: { summary: "Pong", tags: ["Misc"] } },
        "/api/v1/pang": { parameters: [{ name: "x" }] },
      }),
    );
    expect(flat(groups).map((endpoint) => endpoint.path)).toEqual(["/api/v1/pong"]);
  });
});
