import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = {
  admin: null as unknown,
  session: null as unknown,
};

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../src/admin-actions", () => ({ getAdminSession: async () => state.admin }));
vi.mock("../src/auth-runtime", () => ({ getAuthSession: async () => state.session }));
vi.mock("../src/custom-domains/runtime", () => ({ getRequestBrand: async () => null }));
vi.mock("../src/setup-readiness-runtime", () => ({
  collectSetupSnapshot: async () => ({
    admin: { adminUserCount: 0, emailsConfigured: false },
    appUrl: { configured: false, url: "http://localhost:3000" },
    auth: { methods: ["Email code"], placeholderProviders: [] },
    authSecret: { configured: false, length: 0 },
    database: { pendingMigrations: [], reachable: true },
    environment: "development",
    platforms: { expoTokenConfigured: false, purchasesConfigured: false },
    product: { brandIsDefault: true, socialCardIsDefault: true, styleIsDefault: true },
    providers: {
      ai: "fake",
      analytics: "off",
      billing: "local",
      captcha: "off",
      customDomains: "off",
      email: "local",
      jobs: "local",
      storage: "memory",
    },
    workspaceCount: 0,
  }),
}));
// The shell's client islands (AppearanceSync, banners) aren't under test —
// render children inline with a marker so chrome presence is assertable.
vi.mock("../src/app-chrome", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <main data-shell="workspace">{children}</main>
  ),
}));

import SetupPage from "../app/setup/page";

afterEach(() => {
  state.admin = null;
  state.session = null;
  vi.unstubAllEnvs();
});

describe("/setup page access", () => {
  it("is open to anonymous visitors in development on the plain layout", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = renderToStaticMarkup(await SetupPage());
    expect(html).toContain("Setup");
    expect(html).toContain('role="meter"');
    expect(html).not.toContain('data-shell="workspace"');
  });

  it("renders inside the app chrome for signed-in visitors in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    state.session = { user: { id: "u1" } };
    const html = renderToStaticMarkup(await SetupPage());
    expect(html).toContain("Setup");
    expect(html).toContain('data-shell="workspace"');
  });

  it("404s outside development without an admin session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(SetupPage()).rejects.toThrow(/NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404|404/);
  });

  it("renders for a platform admin outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    state.admin = { user: { id: "admin-1", role: "admin" } };
    state.session = { user: { id: "admin-1" } };
    const html = renderToStaticMarkup(await SetupPage());
    expect(html).toContain("Setup");
  });
});
