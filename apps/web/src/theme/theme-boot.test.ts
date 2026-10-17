import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import type * as Styles from "./styles";

vi.mock("server-only", () => ({}));
vi.mock("./styles", async (importOriginal) => ({
  ...(await importOriginal<typeof Styles>()),
  DEFAULT_STYLE_ID: "minimal-product",
}));

import * as themeBoot from "./theme-boot";

const expectedDefault = {
  "data-theme": "minimal",
  "data-density": "comfortable",
  "data-radius": "round",
  "data-font": "geometric",
  "data-layout": "topnav",
  "data-toast-style": "outline",
};

function boot(saved: Record<string, string> = {}, cookie = "") {
  const attributes: Record<string, string> = {};
  const style: { colorScheme?: string } = {};
  runInNewContext(themeBoot.THEME_BOOT_SCRIPT, {
    document: {
      cookie,
      documentElement: {
        style,
        setAttribute: (name: string, value: string) => {
          attributes[name] = value;
        },
      },
    },
    localStorage: { getItem: (key: string) => saved[key] ?? null },
  });
  return { attributes, style };
}

describe("configured product style", () => {
  it("uses DEFAULT_STYLE_ID for every appearance axis at startup", () => {
    expect(boot()).toEqual({ attributes: expectedDefault, style: { colorScheme: "light" } });
  });

  it("provides the same style attributes for rendering without JavaScript", () => {
    expect(themeBoot.DEFAULT_STYLE_ATTRIBUTES).toEqual(expectedDefault);
  });

  it("keeps server defaults when browser storage is blocked", () => {
    const attributes: Record<string, string> = { ...themeBoot.DEFAULT_STYLE_ATTRIBUTES };
    runInNewContext(themeBoot.THEME_BOOT_SCRIPT, {
      document: {
        cookie: "",
        documentElement: {
          style: {},
          setAttribute: (name: string, value: string) => {
            attributes[name] = value;
          },
        },
      },
      localStorage: {
        getItem: () => {
          throw new Error("Storage blocked");
        },
      },
    });
    expect(attributes).toEqual(expectedDefault);
  });

  it("preserves explicit visitor choices while defaulting unsaved axes", () => {
    expect(boot({ "supastack-theme": "midnight", "supastack-font": "monospace" })).toEqual({
      attributes: { ...expectedDefault, "data-theme": "midnight", "data-font": "monospace" },
      style: { colorScheme: "dark" },
    });
  });

  it("restores cookie preferences and ignores unknown saved values", () => {
    expect(boot({ "supastack-radius": "invalid" }, "supastack-density=compact").attributes).toEqual(
      {
        ...expectedDefault,
        "data-density": "compact",
      },
    );
  });
});
