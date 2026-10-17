import { describe, expect, it } from "vitest";

type UiModule = Record<string, unknown>;

async function loadUiModule(): Promise<UiModule | null> {
  return import("./index").catch(() => null) as Promise<UiModule | null>;
}

describe("web UI utilities", () => {
  it("keeps the Milestone 3 authenticated navigation focused", async () => {
    const module = await loadUiModule();

    expect(module?.referenceNavigation).toEqual([
      { label: "Dashboard", screen: "dashboard" },
      { label: "Billing", screen: "billing" },
      { label: "AI task", screen: "task" },
      { label: "Settings", screen: "settings" },
    ]);
  });

  it("joins meaningful optional class names", async () => {
    const module = await loadUiModule();
    const joinClassNames = module?.joinClassNames;

    expect(joinClassNames).toBeTypeOf("function");
    expect(
      (joinClassNames as (...parts: unknown[]) => string)("panel", false, undefined, "active"),
    ).toBe("panel active");
  });
});
