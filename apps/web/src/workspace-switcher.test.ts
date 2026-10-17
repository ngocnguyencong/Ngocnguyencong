import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("workspace switcher popover", () => {
  it("mounts WorkspaceSwitcher and UserMenu in the rail", () => {
    const chrome = readWeb("src/app-chrome.tsx");
    expect(chrome).toContain("<WorkspaceSwitcher");
    expect(chrome).toContain("<UserMenu");
    expect(chrome).toContain("fallbackLabel={workspaceLabel}");
    expect(chrome).toContain("fallbackLogo={workspaceLogo}");

    const footer = chrome.indexOf('className="app-rail-footer"');
    const userMenu = chrome.indexOf("<UserMenu");
    const sidebarEnd = chrome.indexOf("\n      >\n        <main");
    expect(chrome).toContain("<ShellNavigation");
    expect(chrome).toContain("sidebar={");
    const headerActions = chrome.slice(
      chrome.indexOf('className="main-header-actions"'),
      chrome.indexOf("</div>", chrome.indexOf('className="main-header-actions"')),
    );
    expect(userMenu).toBeGreaterThan(footer);
    expect(userMenu).toBeLessThan(sidebarEnd);
    expect(headerActions).not.toContain("<UserMenu");
  });

  it("fetches memberships and switches the active workspace in place", () => {
    const switcher = readWeb("src/workspace-switcher.tsx");
    expect(switcher).toContain('"use client"');
    expect(switcher).toContain('fetch("/api/workspaces")');
    expect(switcher).toContain('method: "POST"');
    expect(switcher).toContain("window.location.reload()");
    expect(switcher).toContain("aria-haspopup");
    expect(switcher).toContain("/new-organization");
    expect(switcher).toContain("/select-organization");
    expect(switcher).toContain("workspace-switcher-item-active");
  });

  it("serves memberships and persists the active workspace through the API", () => {
    const route = readWeb("app/api/workspaces/route.ts");
    expect(route).toContain("listWorkspacesForRequest");
    expect(route).toContain("switchWorkspaceForRequest");
    expect(route).toContain("ACTIVE_WORKSPACE_COOKIE");
    expect(route).toContain("response.cookies.set");

    const api = readWeb("src/workspace-api.ts");
    expect(api).toContain("userWorkspacePreference");
    expect(api).toContain("resolveActiveWorkspaceId");
    expect(api).toContain("onConflictDoUpdate");
  });
});

describe("user account menu", () => {
  it("loads the session and exposes email with sign out only", () => {
    const menu = readWeb("src/user-menu.tsx");
    expect(menu).toContain('"use client"');
    expect(menu).toContain("/api/auth/get-session");
    expect(menu).toContain("/api/auth/sign-out");
    expect(menu).toContain("{copy.signOut}");
    expect(readWeb("src/ui/ui-copy.ts")).toContain('signOut: "Sign out"');
    expect(menu).not.toContain("Account settings");
    expect(menu).not.toContain("user-menu-links");
    expect(menu).toContain("localePath");
  });

  it("styles switcher and user menu popovers through app-theme tokens", () => {
    const css = readWeb("app/app-theme.css");
    expect(css).toContain(".workspace-switcher-popover");
    expect(css).toContain(".workspace-switcher-button");
    expect(css).toContain(".workspace-switcher-item");
    expect(css).toContain(".user-menu-popover");
    expect(css).toContain(".user-menu-button");
    expect(css).toContain(".user-menu-signout");
    expect(css).toMatch(/\.workspace-switcher-popover\s*\{[^}]*var\(--raised\)/s);
    expect(css).toMatch(/\.user-menu-popover\s*\{[^}]*var\(--raised\)/s);
  });
});
