import { afterEach, describe, expect, it, vi } from "vitest";

// route.ts pulls siteOrigin() from src/marketing/seo, which is marked
// server-only — same mock pattern seo.test.ts uses.
vi.mock("server-only", () => ({}));

import { buildLlmsTxt } from "../../src/marketing/llms-txt";
import { marketingStaticPaths } from "../../src/marketing/marketing-sitemap";
import { siteConfig } from "../../src/marketing/site-config";
import { guides } from "../../src/resources/content";
import { GET } from "./route";

const ORIGIN = "https://product.example";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /llms.txt", () => {
  it("responds 200 with a plain-text llms.txt document", async () => {
    vi.stubEnv("APP_URL", ORIGIN);
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");

    const body = await response.text();
    // llmstxt.org shape: H1 = site name, then a blockquote summary.
    expect(body.startsWith(`# ${siteConfig.brandName}\n`)).toBe(true);
    expect(body).toContain(`\n> ${siteConfig.tagline}\n`);
  });

  it("links every docs guide once, on the configured site origin", async () => {
    vi.stubEnv("APP_URL", ORIGIN);
    const body = await GET().text();
    expect(body).toContain("\n## Docs\n");

    // Guide links are absolute and unprefixed (default-locale canonical).
    // A zero-length registry would make the count equality vacuous — pin it.
    expect(guides.length).toBeGreaterThan(0);
    const docsSection = body.slice(body.indexOf("\n## Docs\n"), body.indexOf("\n## Pages\n"));
    expect(docsSection.split(`](${ORIGIN}/docs/`).length - 1).toBe(guides.length);
    for (const guide of guides) {
      expect(body).toContain(`](${ORIGIN}/docs/${guide.slug}): `);
    }
  });

  it("lists every public marketing page", async () => {
    vi.stubEnv("APP_URL", ORIGIN);
    const body = await GET().text();
    expect(body).toContain("\n## Pages\n");

    for (const path of marketingStaticPaths) {
      expect(body).toContain(`](${new URL(path, ORIGIN).toString()}): `);
    }
  });

  it("indexes the public machine-facing endpoints", () => {
    const body = buildLlmsTxt(ORIGIN);
    expect(body).toContain("\n## Reference\n");
    for (const path of ["/status", "/api/health", "/api/v1/openapi", "/api/mcp"]) {
      expect(body).toContain(`](${ORIGIN}${path}): `);
    }
  });

  it("publishes security protocols with links to existing public guides", async () => {
    vi.stubEnv("APP_URL", ORIGIN);
    const body = await GET().text();
    const sectionStart = body.indexOf("\n## Security protocols\n");
    const sectionEnd = body.indexOf("\n## Reference\n", sectionStart);
    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    const section = body.slice(sectionStart, sectionEnd);

    expect(section).not.toContain("docs/agent-security.md");
    expect(section).toContain("Better Auth");
    expect(section).toContain("BFF");
    expect(section).toContain("PostgREST");
    expect(section).toMatch(/RLS/i);
    expect(section).toMatch(/redact/i);
    for (const slug of [
      "modules/auth",
      "reference/api-routes",
      "web/database",
      "deploy/supabase-cloud",
      "modules/observability",
    ]) {
      expect(
        guides.some((guide) => guide.slug === slug),
        slug,
      ).toBe(true);
      expect(section).toContain(`](${ORIGIN}/docs/${slug}):`);
    }
  });

  it("never links app-only routes", async () => {
    vi.stubEnv("APP_URL", ORIGIN);
    const body = await GET().text();
    for (const appPath of ["/dashboard", "/settings", "/admin", "/chat", "/billing", "/auth"]) {
      expect(body).not.toContain(`](${ORIGIN}${appPath}`);
      expect(body).not.toContain(`](${appPath}`);
    }
  });
});
