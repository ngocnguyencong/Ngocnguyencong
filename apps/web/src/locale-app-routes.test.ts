import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/font/local", () => ({
  default: () => ({ className: "mock-font" }),
}));

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import DashboardPage from "../app/dashboard/page.js";
import LocaleDashboardPage from "../app/[locale]/dashboard/page.js";
import LocaleSettingsIndexPage from "../app/[locale]/settings/page.js";
import LocaleSettingsSectionPage from "../app/[locale]/settings/[section]/page.js";
import LocaleBillingPage from "../app/[locale]/billing/page.js";
import LocaleChatPage from "../app/[locale]/chat/page.js";
import LocaleAiPage from "../app/[locale]/ai/page.js";
import AiPage from "../app/ai/page.js";
import LocaleHomePage from "../app/[locale]/page.js";
import { WorkspaceShell } from "./app-chrome.js";
import { ReferenceApp } from "./reference-app.js";
import { ProductionReferenceApp } from "./production-reference-app.js";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Capture a thrown Next.js redirect and return the digest holding the target URL. */
async function redirectTarget(page: Promise<unknown>): Promise<string> {
  const error = await page.then(
    () => null,
    (caught: unknown) => caught,
  );
  const digest = String((error as { digest?: unknown } | null)?.digest ?? "");
  expect(digest).toContain("NEXT_REDIRECT");
  return digest;
}

describe("locale App Router tree", () => {
  it("exposes all key app routes under [locale] prefix in the App Router directory", () => {
    const requiredRoutes = [
      "app/[locale]/page.tsx",
      "app/[locale]/dashboard/page.tsx",
      "app/[locale]/settings/page.tsx",
      "app/[locale]/settings/[section]/page.tsx",
      "app/[locale]/billing/page.tsx",
      "app/[locale]/chat/page.tsx",
      "app/[locale]/commerce/page.tsx",
      "app/[locale]/content/page.tsx",
      "app/[locale]/ai/page.tsx",
    ];

    for (const route of requiredRoutes) {
      const fullPath = join(webRoot, route);
      expect(existsSync(fullPath), `Route file should exist: ${route}`).toBe(true);
      const content = readFileSync(fullPath, "utf8");
      expect(content.length).toBeGreaterThan(0);
    }
  });

  describe("LocaleDashboardPage", () => {
    it("redirects every locale prefix to the canonical /dashboard", async () => {
      for (const locale of ["en", "de", "es", "fr"] as const) {
        const target = await redirectTarget(
          LocaleDashboardPage({
            params: Promise.resolve({ locale }),
          }),
        );
        expect(target).toContain("/dashboard");
      }
    });

    it("forwards canonical /dashboard task recovery links to /ai", async () => {
      const target = await redirectTarget(
        DashboardPage({
          searchParams: Promise.resolve({
            taskId: "task_shared_1",
            submissionKey: "sub_key_9",
          }),
        }),
      );
      expect(target).toContain("/ai");
      expect(target).toContain("taskId=task_shared_1");
      expect(target).toContain("submissionKey=sub_key_9");
    });

    it("forwards shared task recovery links to the localized /ai console", async () => {
      const target = await redirectTarget(
        LocaleDashboardPage({
          params: Promise.resolve({ locale: "de" }),
          searchParams: Promise.resolve({ taskId: "task_shared_1" }),
        }),
      );
      expect(target).toContain("/de/ai");
      expect(target).toContain("taskId=task_shared_1");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleDashboardPage({
          params: Promise.resolve({ locale: "unsupported" }),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("LocaleSettingsIndexPage", () => {
    it("redirects to localized general settings for supported locales", async () => {
      await expect(
        LocaleSettingsIndexPage({
          params: Promise.resolve({ locale: "de" }),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleSettingsIndexPage({
          params: Promise.resolve({ locale: "xyz" }),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("LocaleSettingsSectionPage", () => {
    it("renders WebSettingsPage with localized dictionary for valid sections", async () => {
      const page = await LocaleSettingsSectionPage({
        params: Promise.resolve({ locale: "de", section: "general" }),
        searchParams: Promise.resolve({}),
      });
      expect(page).toBeDefined();
      expect(page.props.locale).toBe("de");
      expect(page.props.section).toBe("general");
      expect(page.props.settingsTitle).toBe("Einstellungen");
      expect(page.props.notificationCopy.title).toBe("Benachrichtigungen");
    });

    it("renders Spanish settings page correctly", async () => {
      const page = await LocaleSettingsSectionPage({
        params: Promise.resolve({ locale: "es", section: "appearance" }),
        searchParams: Promise.resolve({}),
      });
      expect(page).toBeDefined();
      expect(page.props.locale).toBe("es");
      expect(page.props.section).toBe("appearance");
      expect(page.props.settingsTitle).toBe("Ajustes");
    });

    it("redirects English prefix to un-prefixed /settings/[section]", async () => {
      await expect(
        LocaleSettingsSectionPage({
          params: Promise.resolve({ locale: "en", section: "general" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("triggers notFound for unsupported sections", async () => {
      await expect(
        LocaleSettingsSectionPage({
          params: Promise.resolve({ locale: "de", section: "invalid-section" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleSettingsSectionPage({
          params: Promise.resolve({ locale: "pt", section: "general" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("settings section page parity", () => {
    const canonicalSettingsPage = "app/settings/[section]/page.tsx";
    const localizedSettingsPage = "app/[locale]/settings/[section]/page.tsx";

    function webSettingsPageProps(source: string): string[] {
      const start = source.indexOf("<WebSettingsPage");
      expect(start).toBeGreaterThanOrEqual(0);
      const end = source.indexOf("/>", start);
      expect(end).toBeGreaterThan(start);
      return [...source.slice(start, end).matchAll(/(\w+)=/g)]
        .map((match) => match[1] as string)
        .sort();
    }

    it("passes every WebSettingsPage prop the canonical settings route passes", () => {
      const canonical = webSettingsPageProps(
        readFileSync(join(webRoot, canonicalSettingsPage), "utf8"),
      );
      const localized = webSettingsPageProps(
        readFileSync(join(webRoot, localizedSettingsPage), "utf8"),
      );
      expect(localized).toEqual(canonical);
    });

    it("loads the same per-section panel data as the canonical route", () => {
      const canonical = readFileSync(join(webRoot, canonicalSettingsPage), "utf8");
      const localized = readFileSync(join(webRoot, localizedSettingsPage), "utf8");

      for (const loader of [
        "listActiveOrganizationMembers()",
        "listWorkspaceApiKeys()",
        "listWorkspaceSchedules()",
        "listWebhookEndpoints()",
        "listWorkspaceAuditEvents()",
        "listMySessions()",
        "listWorkspaceDomains()",
        "loadConnectionsPanelData(",
        "loadUsagePanelData()",
        "getRequestBrand()",
      ]) {
        expect(canonical, `canonical settings page should call ${loader}`).toContain(loader);
        expect(localized, `localized settings page should call ${loader}`).toContain(loader);
      }

      for (const section of ["developers", "audit", "security", "members", "domains", "usage"]) {
        const gate = `raw === "${section}"`;
        expect(canonical, `canonical settings page should gate on ${gate}`).toContain(gate);
        expect(localized, `localized settings page should gate on ${gate}`).toContain(gate);
      }
    });
  });

  describe("LocaleBillingPage", () => {
    it("renders WebBillingPage for supported non-default locales", async () => {
      for (const locale of ["de", "es", "fr"] as const) {
        const page = await LocaleBillingPage({
          params: Promise.resolve({ locale }),
        });
        expect(page).toBeDefined();
        expect(page.props.locale).toBe(locale);
      }
    });

    it("redirects English prefix to un-prefixed /billing", async () => {
      await expect(
        LocaleBillingPage({
          params: Promise.resolve({ locale: "en" }),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleBillingPage({
          params: Promise.resolve({ locale: "invalid" }),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("LocaleChatPage", () => {
    it("renders WebChatPage for supported non-default locales", async () => {
      for (const locale of ["de", "es", "fr"] as const) {
        const page = await LocaleChatPage({
          params: Promise.resolve({ locale }),
        });
        expect(page).toBeDefined();
        expect(page.props.locale).toBe(locale);
      }
    });

    it("redirects English prefix to un-prefixed /chat", async () => {
      await expect(
        LocaleChatPage({
          params: Promise.resolve({ locale: "en" }),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleChatPage({
          params: Promise.resolve({ locale: "invalid" }),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("AiPage", () => {
    it("mounts the AI task console at the canonical /ai route", async () => {
      const page = await AiPage();
      expect(page).toBeDefined();
      expect([ReferenceApp, ProductionReferenceApp]).toContain(page.type);
    });
  });

  describe("LocaleAiPage", () => {
    it("renders the AI task console for supported non-default locales", async () => {
      for (const locale of ["de", "es", "fr"] as const) {
        const page = await LocaleAiPage({
          params: Promise.resolve({ locale }),
        });
        expect(page).toBeDefined();
        expect(page.props.locale).toBe(locale);
      }
    });

    it("redirects the English prefix to the canonical /ai", async () => {
      const target = await redirectTarget(
        LocaleAiPage({
          params: Promise.resolve({ locale: "en" }),
        }),
      );
      expect(target).toContain(";/ai;");
    });

    it("preserves task recovery params on the English /ai redirect", async () => {
      const target = await redirectTarget(
        LocaleAiPage({
          params: Promise.resolve({ locale: "en" }),
          searchParams: Promise.resolve({
            taskId: "task_shared_1",
            submissionKey: "sub_key_9",
          }),
        }),
      );
      expect(target).toContain("/ai");
      expect(target).toContain("taskId=task_shared_1");
      expect(target).toContain("submissionKey=sub_key_9");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleAiPage({
          params: Promise.resolve({ locale: "invalid" }),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("LocaleHomePage", () => {
    it("renders HomePage for supported non-default locales", async () => {
      for (const locale of ["de", "es", "fr"] as const) {
        const page = await LocaleHomePage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({}),
        });
        expect(page).toBeDefined();
        expect(page.props.locale).toBe(locale);
      }
    });

    it("redirects English prefix to /", async () => {
      await expect(
        LocaleHomePage({
          params: Promise.resolve({ locale: "en" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("NEXT_REDIRECT");
    });

    it("triggers notFound for unsupported locales", async () => {
      await expect(
        LocaleHomePage({
          params: Promise.resolve({ locale: "unknown" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
    });
  });

  describe("WorkspaceShell localized links", () => {
    it("localizes primary navigation and mobile header links when locale is supplied", () => {
      const shell = WorkspaceShell({
        active: "Dashboard",
        children: null,
        locale: "de",
      });

      // Extract nav items — locate ShellNavigation by its sidebar prop so
      // sibling elements (sync hooks, banners) don't break the traversal.
      const layout = shell.props.children.find(
        (child: { props?: { sidebar?: unknown } }) => child?.props?.sidebar !== undefined,
      );
      const aside = layout.props.sidebar;
      const nav = aside.props.children[1];
      const items = nav.props.children;

      const flat = (items as readonly unknown[]).flat();
      const links = (
        flat as ReadonlyArray<{
          props?: { children?: readonly unknown[]; href?: string; "aria-label"?: string };
        }>
      )
        .filter((child) => typeof child.props?.href === "string")
        .map((child) => ({
          text: child.props?.["aria-label"],
          href: child.props?.href,
        }));

      expect(links).toEqual([
        { text: "Übersicht", href: "/de/dashboard" },
        { text: "Chat", href: "/de/chat" },
        { text: "KI-Aufgabe", href: "/de/ai" },
        { text: "Inhalte", href: "/de/content" },
        { text: "Handel", href: "/de/commerce" },
        { text: "Feedback", href: "/de/feedback" },
        { text: "Abrechnung", href: "/de/billing" },
        { text: "Einstellungen", href: "/de/settings" },
      ]);

      // Brand link
      const brand = layout.props.brand;
      expect(brand.props.locale).toBe("de");

      // Main header links
      const main = layout.props.children;
      const headerActions = main.props.children[0].props.children[1];
      const settingsLink = headerActions.props.children[0];
      const appearanceLink = headerActions.props.children[1];

      expect(settingsLink.props.href).toBe("/de/settings");
      expect(appearanceLink.props.href).toBe("/de/settings/appearance");
    });

    it("keeps un-prefixed paths when locale is English or omitted", () => {
      const shell = WorkspaceShell({
        active: "Dashboard",
        children: null,
      });

      const layout = shell.props.children.find(
        (child: { props?: { sidebar?: unknown } }) => child?.props?.sidebar !== undefined,
      );
      const aside = layout.props.sidebar;
      const nav = aside.props.children[1];
      const items = nav.props.children;

      const flat = (items as readonly unknown[]).flat();
      const links = (
        flat as ReadonlyArray<{
          props?: { children?: readonly unknown[]; href?: string; "aria-label"?: string };
        }>
      )
        .filter((child) => typeof child.props?.href === "string")
        .map((child) => ({
          text: child.props?.["aria-label"],
          href: child.props?.href,
        }));

      expect(links).toEqual([
        { text: "Dashboard", href: "/dashboard" },
        { text: "Chat", href: "/chat" },
        { text: "AI task", href: "/ai" },
        { text: "Content", href: "/content" },
        { text: "Commerce", href: "/commerce" },
        { text: "Feedback", href: "/feedback" },
        { text: "Billing", href: "/billing" },
        { text: "Settings", href: "/settings" },
      ]);
    });
  });
});
