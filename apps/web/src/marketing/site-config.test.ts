import { describe, expect, it } from "vitest";
import { isActiveSection, optionalExternalLinks, siteConfig } from "./site-config";

describe("marketing site config", () => {
  it("keeps supastack brand spelling", () => {
    expect(siteConfig.brandName).toBe("supastack");
  });

  it("identifies the boilerplate demo and explains example pricing", () => {
    expect(siteConfig.tagline).toMatch(/demo/i);
    expect(siteConfig.faq.some(({ answer }) => /illustrative prices/i.test(answer))).toBe(true);
    expect(JSON.stringify(siteConfig.faq)).not.toMatch(/trusted by|founder count|setup time/i);
  });

  it("keeps the navigation focused on public resources", () => {
    expect(siteConfig.navigation).toEqual([
      { href: "/#pricing", label: "Pricing" },
      { href: "/#waitlist", label: "Waitlist" },
      { href: "/faq", label: "FAQ" },
      { href: "/blog", label: "Blog" },
      { href: "/docs", label: "Docs" },
    ]);
  });

  it("omits unset optional destinations instead of inventing # links", () => {
    const links = optionalExternalLinks(siteConfig);
    expect(links).toEqual([{ href: "/auth", label: "Sign in" }]);
  });

  it("includes configured optional destinations", () => {
    const links = optionalExternalLinks({
      ...siteConfig,
      docsUrl: "https://docs.example.com",
      repositoryUrl: "https://github.com/example/repo",
    });
    expect(links).toEqual([
      { href: "https://docs.example.com", label: "Documentation" },
      { href: "https://github.com/example/repo", label: "Repository" },
      { href: "/auth", label: "Sign in" },
    ]);
  });

  it("keeps legal destinations in the footer links", () => {
    expect(siteConfig.footerLinks).toEqual([
      { href: "/showcase", label: "Showcase" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/legal/acceptable-use", label: "Acceptable use" },
      { href: "/legal/disclaimer", label: "Disclaimer" },
      { href: "/legal/license", label: "License" },
    ]);
    const headerHrefs = siteConfig.navigation.map((item) => item.href);
    expect(headerHrefs).not.toContain("/privacy");
    expect(headerHrefs).not.toContain("/legal/license");
  });

  it("keeps public resource pages in their own footer group", () => {
    expect(siteConfig.resourceLinks).toEqual([
      { href: "/changelog", label: "Changelog" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/api-reference", label: "API reference" },
    ]);
    const headerHrefs = siteConfig.navigation.map((item) => item.href);
    for (const { href } of siteConfig.resourceLinks) {
      expect(headerHrefs).not.toContain(href);
    }
  });

  it("marks nested legal routes current for their section", () => {
    expect(isActiveSection("/legal/license", "license")).toBe(true);
    expect(isActiveSection("/privacy", "privacy")).toBe(true);
    expect(isActiveSection("/terms", "license")).toBe(false);
    expect(isActiveSection("/legal/license", undefined)).toBe(false);
    expect(isActiveSection("https://example.com/license", "license")).toBe(false);
  });

  it("keeps FAQ free of kit-license sales copy", () => {
    const blob = JSON.stringify(siteConfig.faq);
    expect(blob).not.toMatch(/\$249|\$499|\$75|license key|Get Access/i);
  });
});
