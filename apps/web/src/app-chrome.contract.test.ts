import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";
import { AppBrand } from "./app-chrome";

type AppBrandProps = NonNullable<Parameters<typeof AppBrand>[0]>;

vi.mock("server-only", () => ({}));

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

function mediaBlock(css: string, query: string): string {
  const start = css.indexOf(`@media ${query}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed media query: ${query}`);
}

describe("workspace shell mobile appearance path", () => {
  it("exposes Settings, Appearance, and Notifications links in the main header or rail", () => {
    const chrome = readWeb("src/app-chrome.tsx");

    expect(chrome).toContain("href={settingsHref}");
    expect(chrome).toContain("href={appearanceHref}");
    expect(chrome).toContain("href={notificationsHref}");
    expect(chrome).toContain("mobile-shell-settings");
    expect(chrome).toContain("mobile-shell-appearance");
  });

  it("exposes the same mobile Appearance path on dashboard reference chrome", () => {
    for (const file of ["src/reference-app.tsx", "src/production-reference-app.tsx"] as const) {
      const src = readWeb(file);
      expect(src).toContain("mobile-shell-settings");
      expect(src).toContain("mobile-shell-appearance");
      expect(src).toContain('href="/settings/appearance"');
    }
  });

  it("reveals mobile shell settings/appearance actions under the narrow breakpoint", () => {
    const appTheme = readWeb("app/app-theme.css");
    const narrow = mediaBlock(appTheme, "(max-width: 760px)");

    expect(appTheme).toMatch(
      /\.app-theme\s+\.mobile-shell-settings\s*,\s*\.app-theme\s+\.mobile-shell-appearance\s*\{[^}]*display:\s*none/s,
    );
    expect(narrow).toMatch(
      /\.mobile-shell-settings[\s\S]*\.mobile-shell-appearance\s*\{\s*display:\s*inline-flex/,
    );
    expect(narrow).toMatch(/\.theme-picker\s*\{\s*padding:\s*16px/);
    expect(narrow).toMatch(
      /\.theme-option\s*\{\s*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/,
    );
    expect(narrow).toMatch(/\.kit-ui-gallery-card-grid\s*\{\s*grid-template-columns:\s*1fr/);
  });
});

describe("workspace shell AI task link", () => {
  it("points the AI task nav item at the canonical /ai console", () => {
    const chrome = readWeb("src/app-chrome.tsx");

    expect(chrome).toContain('["AI task", "/ai"]');
    expect(chrome).not.toContain("#production-task");
  });
});

describe("workspace shell notification bell and organization logo", () => {
  it("mounts NotificationBell in header actions and supports workspaceLogo", () => {
    const chrome = readWeb("src/app-chrome.tsx");
    expect(chrome).toContain("<NotificationBell");
    expect(chrome).toContain("workspaceLogo");
    expect(chrome).toContain("<WorkspaceSwitcher");

    const switcher = readWeb("src/workspace-switcher.tsx");
    expect(switcher).toContain("workspace-switcher-logo");
  });

  it("defines notification bell, popover, and logo styles with app-theme tokens", () => {
    const appTheme = readWeb("app/app-theme.css");

    // Notification bell & badge
    expect(appTheme).toContain(".notification-bell");
    expect(appTheme).toContain(".notification-bell-button");
    expect(appTheme).toContain(".notification-bell-badge");

    // Popover elements
    expect(appTheme).toContain(".notification-popover");
    expect(appTheme).toContain(".notification-popover-header");
    expect(appTheme).toContain(".notification-popover-item");
    expect(appTheme).toContain(".notification-popover-footer");

    // Organization logo elements
    expect(appTheme).toContain(".workspace-logo-badge");
    expect(appTheme).toContain(".org-logo-card");
    expect(appTheme).toContain(".org-logo-image");
    expect(appTheme).toContain(".org-logo-placeholder");

    // Token usage verification
    expect(appTheme).toMatch(/\.notification-popover\s*\{[^}]*var\(--raised\)/);
    expect(appTheme).toMatch(/\.notification-popover\s*\{[^}]*var\(--border\)/);
    expect(appTheme).toMatch(/\.notification-bell-badge\s*\{[^}]*var\(--accent\)/);
  });
});

describe("workspace app name", () => {
  it("renders text-only default chrome with an accessible home link", () => {
    const html = renderToStaticMarkup(createElement(AppBrand));

    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="supastack home"');
    expect(html).toContain("<span>supastack</span>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<svg");
  });

  it("supports an explicit product image and localized home link", () => {
    const html = renderToStaticMarkup(
      createElement<AppBrandProps>(AppBrand, {
        locale: "de",
        logo: "/sample-logo.svg",
        name: "Example app",
      }),
    );

    expect(html).toContain('href="/de"');
    expect(html).toContain('src="/sample-logo.svg"');
    expect(html).toContain('alt="Example app logo"');
    expect(html).toContain("<span>Example app</span>");
  });
});
