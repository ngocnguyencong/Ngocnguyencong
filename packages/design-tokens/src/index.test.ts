import { describe, expect, it } from "vitest";

type TokenModule = Record<string, unknown>;

async function loadTokenModule(): Promise<TokenModule | null> {
  return import("./index").catch(() => null) as Promise<TokenModule | null>;
}

describe("reference tokens", () => {
  it("exports semantic colors and layout values for the reference interface", async () => {
    const module = await loadTokenModule();
    const referenceTokens = module?.referenceTokens;

    expect(referenceTokens).toMatchObject({
      color: {
        canvas: "#edf4f7",
        ink: "#15222b",
        signal: "#d55f2a",
        telemetry: "#0d6b75",
      },
      radius: { card: "1.25rem" },
      space: { page: "1.5rem" },
    });
  });
});

describe("shared theme tokens", () => {
  it("exports the common motion durations in milliseconds", async () => {
    const module = await loadTokenModule();

    expect(module?.motionTokens).toEqual({
      feedback: 120,
      enter: 180,
      exit: 120,
      disclosureOpen: 220,
      disclosureClose: 160,
    });
  });

  it("exports foreground-safe status colors for light and dark themes", async () => {
    const module = await loadTokenModule();
    const palettes = module?.semanticStatusColors as
      | Record<string, Record<string, { color?: string; foreground?: string; soft?: string }>>
      | undefined;

    for (const scheme of ["light", "dark"]) {
      const statuses = palettes?.[scheme];
      expect(Object.keys(statuses ?? {}).sort()).toEqual(["danger", "info", "success", "warning"]);
      for (const status of Object.values(statuses ?? {})) {
        expect(status.color).toMatch(/^#[\da-f]{6}$/i);
        expect(status.foreground).toMatch(/^#[\da-f]{6}$/i);
        expect(status.soft).toMatch(/^#[\da-f]{6}$/i);
      }
    }
  });

  it("exports mobile palette aliases without changing the reference palette", async () => {
    const module = await loadTokenModule();
    const palettes = module?.mobilePalettes as
      | Record<string, { canvas?: string; signal?: string; onSignal?: string; status?: unknown }>
      | undefined;
    const referenceTokens = module?.referenceTokens as
      { color?: { canvas?: string; signal?: string } } | undefined;

    expect(palettes?.light).toMatchObject({
      canvas: referenceTokens?.color?.canvas,
      signal: referenceTokens?.color?.signal,
    });
    expect(palettes?.dark).toMatchObject({
      canvas: "#10181d",
      signal: "#e97a45",
    });
    expect(palettes?.light?.status).toBeDefined();
    expect(palettes?.dark?.status).toBeDefined();
  });
});
