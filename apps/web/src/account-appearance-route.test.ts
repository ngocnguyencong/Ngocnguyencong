import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppearance: vi.fn(),
  getSession: vi.fn(),
  saveAppearance: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({ app: { webUrl: "http://localhost:3000" } }),
}));
vi.mock("./auth-runtime", () => ({ getAuthSession: mocks.getSession }));
vi.mock("./appearance-sync", () => ({
  getUserAppearance: mocks.getAppearance,
  saveUserAppearance: mocks.saveAppearance,
}));

import { GET, PUT } from "../app/api/account/appearance/route";

const VALID_PREFERENCES = {
  style: "obsidian-studio",
  theme: "obsidian",
  density: "comfortable",
  radius: "soft",
  font: "editorial",
  layout: "sidebar",
  toastStyle: "solid",
};

function putRequest(body: unknown, origin = "http://localhost:3000"): Request {
  return new Request("http://localhost:3000/api/account/appearance", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "PUT",
  });
}

describe("/api/account/appearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user_a" } });
    mocks.getAppearance.mockResolvedValue({ preferences: null, updatedAt: null });
    mocks.saveAppearance.mockImplementation(async (_userId: string, preferences: unknown) => ({
      preferences,
      updatedAt: new Date("2026-11-02T10:00:00.000Z"),
    }));
  });

  it("returns 401 when signed out", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost:3000/api/account/appearance"));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getAppearance).not.toHaveBeenCalled();
  });

  it("returns 403 for a cross-origin PUT", async () => {
    const response = await PUT(
      putRequest({ preferences: VALID_PREFERENCES }, "https://evil.example"),
    );
    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.saveAppearance).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid preferences", async () => {
    const response = await PUT(putRequest({ preferences: { theme: "not-a-pack" } }));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("invalidPreferences");
    expect(mocks.saveAppearance).not.toHaveBeenCalled();
  });

  it("round-trips a PUT then GET scoped to the session user", async () => {
    const put = await PUT(putRequest({ preferences: VALID_PREFERENCES }));
    expect(put.status).toBe(200);
    expect(mocks.saveAppearance).toHaveBeenCalledWith("user_a", VALID_PREFERENCES);
    const saved = await put.json();
    expect(saved).toEqual({
      preferences: VALID_PREFERENCES,
      updatedAt: "2026-11-02T10:00:00.000Z",
    });

    mocks.getAppearance.mockResolvedValue({
      preferences: VALID_PREFERENCES,
      updatedAt: new Date("2026-11-02T10:00:00.000Z"),
    });
    const get = await GET(new Request("http://localhost:3000/api/account/appearance"));
    expect(get.status).toBe(200);
    expect(get.headers.get("cache-control")).toBe("no-store");
    await expect(get.json()).resolves.toEqual(saved);
    expect(mocks.getAppearance).toHaveBeenCalledWith("user_a");
  });
});
