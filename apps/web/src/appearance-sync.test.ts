import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));
vi.mock("@supastack/db", () => ({ createDrizzleUserAppearanceRepository: vi.fn() }));

import type { UserAppearanceRepository } from "@supastack/db";

import { createAppearanceSync } from "./appearance-sync";

const VALID_PREFERENCES = {
  style: "obsidian-studio",
  theme: "obsidian",
  density: "comfortable",
  radius: "soft",
  font: "editorial",
  layout: "sidebar",
  toastStyle: "solid",
} as const;

function repository(overrides: Partial<UserAppearanceRepository> = {}): UserAppearanceRepository {
  return {
    get: overrides.get ?? (async () => null),
    upsert:
      overrides.upsert ??
      (async (_userId: string, preferences: unknown) => ({
        preferences,
        updatedAt: new Date("2026-11-02T10:00:00.000Z"),
      })),
  };
}

describe("createAppearanceSync.get", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty snapshot when no row exists", async () => {
    const store = createAppearanceSync(repository());
    await expect(store.get("user_1")).resolves.toEqual({
      preferences: null,
      updatedAt: null,
    });
  });

  it("returns validated preferences and the row timestamp", async () => {
    const updatedAt = new Date("2026-11-02T10:00:00.000Z");
    const store = createAppearanceSync(
      repository({
        get: vi.fn(async () => ({ preferences: { ...VALID_PREFERENCES }, updatedAt })),
      }),
    );
    await expect(store.get("user_1")).resolves.toEqual({
      preferences: VALID_PREFERENCES,
      updatedAt,
    });
  });

  it("degrades a stale row (removed catalog id) to null preferences but keeps updatedAt", async () => {
    const updatedAt = new Date("2026-11-02T10:00:00.000Z");
    const store = createAppearanceSync(
      repository({
        get: vi.fn(async () => ({
          preferences: { ...VALID_PREFERENCES, theme: "deleted-pack" },
          updatedAt,
        })),
      }),
    );
    await expect(store.get("user_1")).resolves.toEqual({
      preferences: null,
      updatedAt,
    });
  });
});

describe("createAppearanceSync.save", () => {
  it("upserts the parsed preferences and returns the persisted timestamp", async () => {
    const upsert = vi.fn(async (userId: string, preferences: unknown) => ({
      preferences,
      updatedAt: new Date("2026-11-03T12:30:00.000Z"),
      userId,
    }));
    const store = createAppearanceSync(repository({ upsert }));

    const saved = await store.save("user_1", { ...VALID_PREFERENCES });

    expect(upsert).toHaveBeenCalledWith("user_1", VALID_PREFERENCES);
    expect(saved.preferences).toEqual(VALID_PREFERENCES);
    expect(saved.updatedAt.toISOString()).toBe("2026-11-03T12:30:00.000Z");
  });
});
