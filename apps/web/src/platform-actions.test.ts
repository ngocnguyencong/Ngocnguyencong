import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ guard: vi.fn(), select: vi.fn() }));
vi.mock("./admin-actions", () => ({ requireAdminSession: state.guard }));
vi.mock("./auth-runtime", () => ({ database: { select: state.select } }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { listAnnouncements, listFeatureFlags } from "./platform-actions";

beforeEach(() => {
  state.guard.mockReset().mockResolvedValue({ user: { id: "admin_1" } });
  state.select.mockReset().mockImplementation(() => ({
    from: () => ({ orderBy: () => ({ limit: async () => [] }) }),
  }));
});

describe("platform read authorization", () => {
  it.each([listAnnouncements, listFeatureFlags])(
    "denies a direct read before database access",
    async (read) => {
      state.guard.mockRejectedValue(new Error("Administrator required."));
      await expect(read()).rejects.toThrow("Administrator required.");
      expect(state.select).not.toHaveBeenCalled();
    },
  );

  it("preserves authorized announcement results", async () => {
    const rows = [
      {
        id: "ann_1",
        title: "Upcoming change",
        body: "Admin draft",
        severity: "info",
        startsAt: new Date(),
        endsAt: null,
      },
    ];
    state.select.mockReturnValue({
      from: () => ({ orderBy: () => ({ limit: async () => rows }) }),
    });
    await expect(listAnnouncements()).resolves.toEqual(rows);
    expect(state.guard).toHaveBeenCalledTimes(1);
  });

  it("preserves authorized flags and aggregate override counts", async () => {
    const rows = [
      { id: "flag_1", key: "feature.one", defaultEnabled: true, description: "Internal plan" },
    ];
    state.select
      .mockReturnValueOnce({ from: () => ({ orderBy: async () => rows }) })
      .mockReturnValueOnce({ from: async () => [{ flagId: "flag_1" }] });
    await expect(listFeatureFlags()).resolves.toEqual([{ ...rows[0], overrideCount: 1 }]);
    expect(state.guard).toHaveBeenCalledTimes(1);
  });
});
