import { describe, expect, it } from "vitest";

import { isThemeId } from "./catalog";
import {
  MARKETING_THEME_MODE,
  marketingThemeAttrs,
  type MarketingThemeMode,
} from "./marketing-theme";

describe("marketing theme mode", () => {
  it("follows the configured product style by default", () => {
    expect(MARKETING_THEME_MODE).toBe("inherit");
    expect(marketingThemeAttrs()).toEqual({ "data-marketing-theme": "inherit" });
  });

  it("returns no attributes when locked", () => {
    expect(marketingThemeAttrs("locked")).toEqual({});
  });

  it("marks the wrapper to inherit the visitor theme pick", () => {
    expect(marketingThemeAttrs("inherit")).toEqual({ "data-marketing-theme": "inherit" });
  });

  it("pins a catalog pack on the marketing wrapper", () => {
    expect(marketingThemeAttrs("paper")).toEqual({ "data-theme": "paper" });
    expect(marketingThemeAttrs("glacier")).toEqual({ "data-theme": "glacier" });
  });

  it("falls back to the lock for unknown pack ids", () => {
    expect(marketingThemeAttrs("not-a-theme" as MarketingThemeMode)).toEqual({});
    expect(isThemeId("not-a-theme")).toBe(false);
  });
});
