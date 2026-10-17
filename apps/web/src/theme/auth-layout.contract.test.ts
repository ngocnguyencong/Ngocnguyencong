import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("auth page layout CSS contract", () => {
  it("centers the auth shell with flex and clips horizontal overflow", () => {
    const globals = readWeb("app/globals.css");
    const appTheme = readWeb("app/app-theme.css");

    expect(globals).not.toMatch(/\.auth-page\s*\{[^}]*rgba\(13,\s*107,\s*117/s);
    expect(globals).not.toMatch(/--canvas:\s*#edf4f7/);
    expect(globals).toMatch(/\.auth-page\s*\{[^}]*display:\s*flex/s);
    expect(globals).toMatch(/\.auth-page\s*\{[^}]*overflow-x:\s*clip/s);
    expect(globals).toMatch(/\.auth-card\s*\{[^}]*width:\s*min\(100%/s);

    expect(appTheme).toMatch(/\.app-theme\.auth-page\s*\{[^}]*display:\s*flex/s);
    expect(appTheme).toMatch(/\.app-theme\.auth-page\s*\{[^}]*overflow-x:\s*clip/s);
    expect(appTheme).toMatch(/\.app-theme\s+\.auth-card\s*\{[^}]*width:\s*min\(100%/s);
    expect(appTheme).toMatch(/\.app-theme\s+\.auth-card\s*\{[^}]*min-width:\s*0/s);
  });

  it("keeps application surfaces on theme tokens instead of pale hardcodes", () => {
    const globals = readWeb("app/globals.css");
    expect(globals).not.toMatch(/\.auth-form input\s*\{[^}]*background:\s*#fff/s);
    expect(globals).not.toMatch(/\.button-secondary\s*\{[^}]*color:\s*#07545d/s);
    expect(globals).toMatch(/--canvas:\s*var\(--page/);
    expect(globals).toMatch(/--signal:\s*var\(--accent/);
  });

  it("keeps workspace chrome on kit theme variables instead of teal/white hardcodes", () => {
    const globals = readWeb("app/globals.css");
    const appTheme = readWeb("app/app-theme.css");

    for (const leak of ["#f4fafb", "#9db2bb", "#b6c7cd", "#c7d5d9", "rgba(213, 95, 42"]) {
      expect(globals).not.toContain(leak);
    }
    expect(globals).not.toMatch(/\.nav-item:hover\s*\{[^}]*\bcolor:\s*white\b/s);
    expect(globals).not.toMatch(/\.workspace-rail\s*\{[^}]*background:\s*var\(--ink\)/s);
    expect(globals).toMatch(/\.workspace-rail\s*\{[^}]*background:\s*var\(--section/s);
    expect(globals).toMatch(/\.nav-item\s*\{[^}]*color:\s*var\(--muted\)/s);
    expect(globals).toMatch(/border:\s*1px solid var\(--border/s);

    expect(appTheme).toMatch(
      /\.app-theme\s+\.workspace-rail\s*\{[^}]*background:\s*var\(--section\)/s,
    );
    expect(appTheme).toMatch(
      /\.app-theme\s+\.button-primary\s*\{[^}]*background:\s*var\(--accent\)/s,
    );
    expect(appTheme).toMatch(
      /nav\[aria-label="Settings sections"\] a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--accent-text,\s*var\(--accent\)\)/s,
    );
    expect(appTheme).toMatch(/\.plan-catalog-item\s*\{[^}]*background:\s*var\(--page\)/s);
    expect(appTheme).toMatch(/\.mail-preview-body\s*\{[^}]*background:\s*var\(--page\)/s);
    expect(appTheme).toMatch(
      /nav\[aria-label="Organization settings"\] a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--accent-text,\s*var\(--accent\)\)/s,
    );
  });

  it("keeps demo-parity invite and org settings on app-theme token chrome", () => {
    const invite = readWeb("app/invite/[token]/page.tsx");
    const orgSettings = readWeb("app/organization/settings/page.tsx");
    const mailPreview = readWeb("app/mail-preview/page.tsx");

    expect(invite).toMatch(/app-theme auth-page/);
    expect(invite).toMatch(/button button-primary/);
    expect(invite).not.toMatch(/auth-shell/);
    expect(orgSettings).toMatch(/auth-card auth-form/);
    expect(orgSettings).toMatch(/button button-primary/);
    expect(orgSettings).not.toMatch(/settings-panel/);
    expect(mailPreview).toMatch(/mail-preview-body/);
  });
});
