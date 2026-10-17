import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MarketingAccountShell } from "./account-shell";

vi.mock("../theme/marketing-theme", () => ({
  marketingThemeAttrs: () => ({ "data-theme": "paper" }),
}));
vi.mock("../analytics", () => ({ resolveAnalyticsConfig: () => ({ provider: "off" }) }));
vi.mock("./fonts", () => ({ marketingFontClassName: "test-font" }));
vi.mock("./site-header-client", () => ({ SiteHeaderClient: () => null }));
vi.mock("./site-footer", () => ({ SiteFooter: () => null }));

describe("MarketingAccountShell", () => {
  it("uses the configured marketing color pack on account pages", () => {
    const html = renderToStaticMarkup(
      createElement(MarketingAccountShell, { captureEnabled: false }, "Sign in"),
    );
    expect(html).toContain('data-theme="paper"');
    expect(html).toContain("Sign in");
  });
});
