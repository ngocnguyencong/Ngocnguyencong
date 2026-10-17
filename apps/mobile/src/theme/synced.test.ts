import { beforeEach, describe, expect, it, vi } from "vitest";

const secureStore = vi.hoisted(() => new Map<string, string>());
vi.mock("expo-secure-store", () => ({
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
}));

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import {
  fetchAppearance,
  loadSyncedThemeCache,
  saveSyncedThemeCache,
  updateSyncedTheme,
} from "./synced";

const STATUS = {
  color: "#1f6b45",
  foreground: "#ffffff",
  soft: "#e8f4ec",
};

function palette(overrides: Record<string, unknown> = {}) {
  return {
    canvas: "#000000",
    canvasRaised: "#111111",
    controlBorder: "#333333",
    destructive: "#a51d16",
    ink: "#eeeeee",
    inputBackground: "#0a0a0a",
    muted: "#888888",
    onSignal: "#000000",
    outline: "#222222",
    signal: "#f5a623",
    signalSoft: "#281a04",
    status: { danger: STATUS, info: STATUS, success: STATUS, warning: STATUS },
    telemetry: "#7bc8f3",
    telemetrySoft: "#102d3b",
    ...overrides,
  };
}

function pack(overrides: Record<string, unknown> = {}) {
  return {
    colorScheme: "dark",
    id: "obsidian",
    name: "Obsidian",
    palette: palette(),
    ...overrides,
  };
}

function makeApi(
  routes: Record<string, { payload: unknown; status?: number }>,
  seen?: { body?: unknown; method: string; path: string }[],
) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname;
    seen?.push({
      body: init.body === undefined ? undefined : JSON.parse(init.body),
      method: init.method,
      path,
    });
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

describe("fetchAppearance", () => {
  it("parses the synced theme id and validated packs", async () => {
    const api = makeApi({
      "/api/mobile/appearance": {
        payload: {
          packs: [pack(), pack({ colorScheme: "light", id: "paper", name: "Paper" })],
          preferences: { theme: "obsidian" },
          updatedAt: "2026-11-02T10:00:00.000Z",
        },
      },
    });
    const result = await fetchAppearance(api);
    expect(result.themeId).toBe("obsidian");
    expect(result.updatedAt).toBe("2026-11-02T10:00:00.000Z");
    expect(result.packs.map((entry) => entry.id)).toEqual(["obsidian", "paper"]);
    expect(result.packs[0]!.palette.signal).toBe("#f5a623");
  });

  it("drops packs whose palette fields are not six-digit hex", async () => {
    const api = makeApi({
      "/api/mobile/appearance": {
        payload: {
          packs: [
            pack({ id: "bad-hex", palette: palette({ signal: "rgba(1,2,3,0.5)" }) }),
            pack({ id: "no-status", palette: palette({ status: { success: STATUS } }) }),
            pack({ id: "good" }),
            "not-a-pack",
          ],
          preferences: null,
          updatedAt: null,
        },
      },
    });
    const result = await fetchAppearance(api);
    expect(result.packs.map((entry) => entry.id)).toEqual(["good"]);
    expect(result.themeId).toBeNull();
  });

  it("throws on a malformed response envelope", async () => {
    const api = makeApi({ "/api/mobile/appearance": { payload: "oops" } });
    await expect(fetchAppearance(api)).rejects.toThrow("The appearance response was invalid.");
  });
});

describe("updateSyncedTheme", () => {
  it("PUTs the pack id and returns the recorded theme", async () => {
    const seen: { body?: unknown; method: string; path: string }[] = [];
    const api = makeApi(
      {
        "/api/mobile/appearance": {
          payload: {
            preferences: { theme: "paper" },
            updatedAt: "2026-11-02T11:00:00.000Z",
          },
        },
      },
      seen,
    );
    const result = await updateSyncedTheme(api, "paper");
    expect(seen).toEqual([
      { body: { theme: "paper" }, method: "PUT", path: "/api/mobile/appearance" },
    ]);
    expect(result).toEqual({ themeId: "paper", updatedAt: "2026-11-02T11:00:00.000Z" });
  });
});

describe("synced theme cache", () => {
  beforeEach(() => {
    secureStore.clear();
  });

  it("round-trips a validated palette", async () => {
    const cache = { packId: "obsidian", palette: palette() };
    await saveSyncedThemeCache(cache);
    await expect(loadSyncedThemeCache()).resolves.toEqual(cache);
  });

  it("returns null for missing or malformed cache entries", async () => {
    await expect(loadSyncedThemeCache()).resolves.toBeNull();
    secureStore.set("supastack.theme.synced", "not json");
    await expect(loadSyncedThemeCache()).resolves.toBeNull();
    secureStore.set(
      "supastack.theme.synced",
      JSON.stringify({ packId: "obsidian", palette: palette({ signal: "blue" }) }),
    );
    await expect(loadSyncedThemeCache()).resolves.toBeNull();
  });
});
