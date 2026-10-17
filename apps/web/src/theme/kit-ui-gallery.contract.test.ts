import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("kit UI gallery wiring", () => {
  it("mounts ThemePicker and gallery on the appearance settings section", () => {
    const settingsPage = readFileSync(join(here, "../web-settings-page.tsx"), "utf8");
    const gallery = readFileSync(join(here, "./kit-ui-gallery.tsx"), "utf8");
    const appTheme = readFileSync(join(here, "../../app/app-theme.css"), "utf8");

    expect(settingsPage).toContain('section === "appearance"');
    expect(settingsPage).toContain("<ThemePicker locale={locale} />");
    expect(settingsPage).toContain("<KitUiGallery locale={locale} />");
    expect(settingsPage).toContain("settings-wide");
    expect(gallery).toContain("aria-label={copy.title}");
    expect(gallery).toContain("data-gallery-section={section}");
    expect(appTheme).toContain(".app-theme .kit-ui-gallery");
    expect(appTheme).toContain(".app-theme .auth-card.settings-wide");
  });

  it("documents the default select, radio, and toggle controls", () => {
    const gallery = readFileSync(join(here, "./kit-ui-gallery.tsx"), "utf8");
    const appTheme = readFileSync(join(here, "../../app/app-theme.css"), "utf8");

    expect(gallery).toContain('className="select"');
    expect(gallery).toContain('type="radio"');
    expect(gallery).toContain('className="toggle"');
    expect(appTheme).toContain(".app-theme .select");
    expect(appTheme).toContain('.app-theme input[type="radio"]');
    expect(appTheme).toContain('.app-theme input[type="checkbox"].toggle');
  });
});
