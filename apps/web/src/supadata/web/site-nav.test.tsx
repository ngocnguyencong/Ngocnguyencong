import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("site=s1&period=7d&search=x"),
}));

import { SiteNav } from "./site-nav";

const SITES = [
  { domain: "a.example.com", id: "s1", name: "Site A" },
  { domain: "b.example.com", id: "s2", name: "Site B" },
];

describe("SiteNav", () => {
  const html = renderToStaticMarkup(<SiteNav activeSiteId="s1" sites={SITES} />);

  it("renders period controls as anchors preserving the other params", () => {
    for (const id of ["24h", "7d", "30d", "90d", "12m"]) {
      expect(html).toContain(`period=${id}`);
    }
    // Active period is marked; the anchor carries site + extra params.
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/href="\/dashboard\?[^"]*site=s1[^"]*period=24h/);
    expect(html).not.toContain("onClick");
    // No <button> in the period group.
    expect(html).not.toMatch(/<button[^>]*>24h/i);
  });

  it("marks the active tab with aria-current", () => {
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Overview</);
  });

  it("renders the site picker as a real select inside a GET form (no-JS)", () => {
    expect(html).toMatch(/<form[^>]*action="\/dashboard"[^>]*method="get"/);
    expect(html).toContain('name="site"');
    expect(html).toContain('name="period"');
    // The themed Select wrapper — not a bare standalone <select>.
    expect(html).toContain("data-enhanced");
    expect(html).toContain("<noscript>");
  });
});
