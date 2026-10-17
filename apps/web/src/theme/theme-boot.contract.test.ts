import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DEFAULT_THEME_ID, THEME_CATALOG, buildThemeBootScript } from "./catalog";

const here = dirname(fileURLToPath(import.meta.url));

describe("theme boot injection boundary", () => {
  it("keeps THEME_BOOT_SCRIPT in a server-only module used by root layout", () => {
    const bootSource = readFileSync(join(here, "theme-boot.ts"), "utf8");
    const layoutSource = readFileSync(join(here, "../../app/layout.tsx"), "utf8");
    const catalogSource = readFileSync(join(here, "catalog.ts"), "utf8");
    const pickerSource = readFileSync(join(here, "theme-picker.tsx"), "utf8");

    expect(bootSource).toMatch(/import\s+["']server-only["']/);
    expect(bootSource).toMatch(/THEME_BOOT_SCRIPT/);
    expect(bootSource).toMatch(/buildThemeBootScript/);
    expect(catalogSource).toMatch(/export function buildThemeBootScript/);
    expect(catalogSource).not.toMatch(/export const THEME_BOOT_SCRIPT/);
    expect(pickerSource).not.toMatch(/THEME_BOOT_SCRIPT|theme-boot|buildThemeBootScript/);
    expect(layoutSource).toMatch(/from\s+["'][^"']*theme\/theme-boot["']/);
    expect(layoutSource).toMatch(/THEME_BOOT_SCRIPT/);
  });

  it("serializes every catalog id into the FOUC boot script", () => {
    const script = buildThemeBootScript();
    expect(script).toContain(`data-theme`);
    expect(script).toContain(DEFAULT_THEME_ID);
    for (const theme of THEME_CATALOG) {
      expect(script).toContain(theme.id);
    }
  });
});
