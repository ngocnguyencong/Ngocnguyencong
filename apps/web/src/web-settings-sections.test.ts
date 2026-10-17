import { describe, expect, it } from "vitest";

import {
  getSettingsSection,
  isSettingsSectionId,
  localizedSettingsSections,
  parseSettingsSection,
  SETTINGS_SECTIONS,
} from "./web-settings-sections.js";

describe("settings sections", () => {
  it("covers the demo control-plane sections builders need", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      "general",
      "appearance",
      "security",
      "billing",
      "usage",
      "members",
      "notifications",
      "developers",
      "connections",
      "domains",
      "audit",
    ]);
    expect(getSettingsSection("appearance").href).toBe("/settings/appearance");
    expect(getSettingsSection("connections").href).toBe("/settings/connections");
    expect(getSettingsSection("billing").href).toBe("/settings/billing");
    // Usage sits immediately after billing in the section nav.
    expect(getSettingsSection("usage").href).toBe("/settings/usage");
    expect(parseSettingsSection("members")).toBe("members");
    expect(parseSettingsSection("appearance")).toBe("appearance");
    expect(parseSettingsSection("notifications")).toBe("notifications");
    expect(parseSettingsSection("nope")).toBe("general");
    for (const section of SETTINGS_SECTIONS) {
      expect(isSettingsSectionId(section.id)).toBe(true);
    }
    expect(isSettingsSectionId("nope")).toBe(false);
  });

  it("localizes settings section labels through the i18n dictionary", () => {
    expect(
      localizedSettingsSections("de").find((section) => section.id === "billing")?.label,
    ).toMatch(/Abrechnung/i);
    expect(getSettingsSection("members", "fr").label.length).toBeGreaterThan(0);
    expect(getSettingsSection("appearance", "de").href).toBe("/de/settings/appearance");
    expect(getSettingsSection("billing", "fr").href).toBe("/fr/settings/billing");
    expect(getSettingsSection("general", "es").href).toBe("/es/settings/general");
  });
});
