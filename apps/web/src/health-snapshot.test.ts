import { describe, expect, it } from "vitest";

import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getHealthSnapshot } from "./health-snapshot";

const providers = {
  ai: "fake",
  billing: "local",
  email: "local",
  jobs: "local",
  storage: "memory",
};
const now = () => new Date("2026-09-27T12:00:00.000Z");

describe("health snapshot", () => {
  it("reports the existing public shape when the database probe succeeds", async () => {
    const snapshot = await getHealthSnapshot({
      now,
      probeDatabase: async () => {},
      providers,
      version: "1.2.3",
    });

    expect(snapshot).toEqual({
      checks: { database: "ok" },
      providers,
      status: "ok",
      timestamp: "2026-09-27T12:00:00.000Z",
      version: "1.2.3",
    });
  });

  it("reports degraded health without exposing database errors", async () => {
    const snapshot = await getHealthSnapshot({
      now,
      probeDatabase: async () => {
        throw new Error("sensitive database detail");
      },
      providers,
      version: "1.2.3",
    });

    expect(snapshot.checks).toEqual({ database: "failed" });
    expect(snapshot.status).toBe("degraded");
    expect(JSON.stringify(snapshot)).not.toContain("sensitive database detail");
  });
});
