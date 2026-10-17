import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "169.254.169.254", "x-forwarded-proto": "http" }),
}));
vi.mock("./health-snapshot", () => ({
  getHealthSnapshot: async () => ({
    checks: { database: "ok" },
    providers: { ai: "fake" },
    status: "ok",
    timestamp: "2026-09-27T12:00:00.000Z",
    version: "1.2.3",
  }),
}));

import StatusPage from "../app/status/page";

afterEach(() => vi.unstubAllGlobals());

describe("public status page", () => {
  it("renders health without fetching an inbound Host destination", async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ status: "degraded" }),
      ok: true,
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const html = renderToStaticMarkup(await StatusPage());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(html).toContain("operational");
    expect(html).toContain("Version 1.2.3");
  });
});
