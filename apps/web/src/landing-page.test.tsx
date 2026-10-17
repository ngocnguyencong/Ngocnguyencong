import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SUPPORTED_LOCALES } from "@supastack/i18n";
import { describe, expect, it, vi } from "vitest";

vi.mock("@supastack/config", () => ({
  parseServerConfig: () => ({}),
  parsePublicConfig: () => ({
    captcha: { provider: "off" },
    app: { webUrl: "https://demo.example" },
  }),
}));
vi.mock("./growth/waitlist-actions", () => ({ joinWaitlistAction: async () => {} }));
vi.mock("./captcha-widget", () => ({ CaptchaWidget: () => null }));
vi.mock("./marketing/fonts", () => ({ marketingFontClassName: "" }));
vi.mock("./marketing/home-shell", () => ({
  HomeShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./marketing/locale-html-lang", () => ({ LocaleHtmlLang: () => null }));
vi.mock("./marketing/seo", () => ({
  JsonLd: () => null,
  faqPageJsonLd: () => ({}),
}));
vi.mock("./marketing/site-header", () => ({ SiteHeader: () => null }));
vi.mock("./marketing/site-footer", () => ({ SiteFooter: () => null }));

import { LandingPage } from "./landing-page";

describe("boilerplate landing demo", () => {
  it.each(SUPPORTED_LOCALES)("renders neutral demo content for %s", (locale) => {
    const html = renderToStaticMarkup(<LandingPage locale={locale} />);

    expect(html).toMatch(/boilerplate|plantilla|modèle/i);
    expect(html).toContain('href="/auth"');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('id="waitlist"');
    expect(html).toContain('name="locale"');
    expect(html).toContain('id="pricing"');
    expect(html).toContain("Illustrative prices");
    expect(html).not.toMatch(/<blockquote|data-star=|testimonials|<img|<dl|<figure/i);
  });

  it("ships no customer testimonial data or portrait assets", () => {
    expect(existsSync(resolve(import.meta.dirname, "marketing/testimonials.ts"))).toBe(false);
    expect(existsSync(resolve(import.meta.dirname, "../public/testimonials"))).toBe(false);
  });
});
