import { describe, expect, it } from "vitest";
import { posts, guides, findGuide, filterPosts, searchGuides, formatPostDate } from "./content";
describe("public reading content", () => {
  it("provides preparation and terminal instructions before platform setup", () => {
    expect(findGuide("web/before-you-start")).toBeDefined();
    expect(findGuide("web/terminal-basics")).toBeDefined();
    expect(findGuide("web/before-you-start")?.continueTo).toBe("web/terminal-basics");
    expect(findGuide("web/terminal-basics")?.continueTo).toBe("web/local-setup");
    for (const surface of ["web", "mobile", "desktop"]) {
      const guide = findGuide(`${surface}/local-setup`)!;
      expect(
        guide.sections.flatMap((section) => section.links ?? []).map((link) => link.href),
      ).toContain("/docs/web/before-you-start");
      expect(guide.sections.map((section) => section.code ?? "").join("\n")).toContain(
        "corepack pnpm --filter @supastack/",
      );
    }
  });
  it("distinguishes app environment files and client/backend requirements", () => {
    const text = (slug: string) =>
      findGuide(slug)!
        .sections.map((section) => [...section.paragraphs, section.code ?? ""].join("\n"))
        .join("\n");
    expect(text("web/local-setup")).toContain("apps/web/.env.local");
    expect(text("web/local-setup")).toContain("/ai");
    expect(text("web/local-setup")).toMatch(/\/auth[\s\S]*Postgres/);
    expect(text("mobile/local-setup")).toContain("apps/mobile/.env.local");
    expect(text("mobile/local-setup")).toContain("backend");
    expect(text("desktop/local-setup")).toContain("backend");
    expect(text("desktop/local-setup")).toContain("cargo --version");
  });
  it("formats each article's own date consistently across time zones", () => {
    expect(formatPostDate("2026-08-03")).toBe("August 3, 2026");
    expect(formatPostDate("2026-09-07")).toBe("September 7, 2026");
  });
  it("includes checklist text in documentation search", () => {
    const guide = {
      ...guides[0]!,
      sections: [
        {
          id: "checklist",
          title: "Checklist",
          paragraphs: [],
          items: ["Verify callback redirects"],
        },
      ],
    };
    expect(searchGuides("callback redirects", [guide])).toEqual([guide]);
  });
  it("provides unique complete articles and valid related guide destinations", () => {
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    for (const post of posts) {
      expect(post.sections.length).toBeGreaterThanOrEqual(3);
      expect(findGuide(post.guide)).toBeDefined();
      expect(new Set(post.sections.map((s) => s.id)).size).toBe(post.sections.length);
    }
  });
  it("filters categories without hiding all articles for an unknown category", () => {
    expect(filterPosts("Architecture").every((p) => p.category === "Architecture")).toBe(true);
    expect(filterPosts("unknown")).toEqual(posts);
  });
  it("resolves exact routes and rejects missing or prototype names", () => {
    expect(findGuide("web")).toBeDefined();
    expect(findGuide("mobile")).toBeDefined();
    expect(findGuide("modules")).toBeDefined();
    expect(findGuide("web/organizations")).toBeDefined();
    expect(findGuide("web/i18n")).toBeDefined();
    expect(findGuide("web/missing")).toBeUndefined();
    expect(findGuide("toString")).toBeUndefined();
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
  });
  it("publishes the selective-adoption and upgrade paths and sets mobile scope early", () => {
    const adoption = findGuide("web/adopt-patterns");
    const upgrading = findGuide("web/upgrading");
    const mobile = findGuide("mobile");

    expect(adoption?.sections.length).toBeGreaterThanOrEqual(3);
    expect(upgrading?.sections.length).toBeGreaterThanOrEqual(3);
    expect(searchGuides("existing stack")).toContain(adoption);
    expect(searchGuides("upgrade")).toContain(upgrading);
    expect(mobile?.sections[0]?.paragraphs.join(" ")).toMatch(
      /Next\.js API and shared server packages remain the source/i,
    );
    expect(
      mobile?.sections.find((section) => section.id === "testing")?.paragraphs.join(" "),
    ).toMatch(/EAS development build/i);
  });
  it("searches titles and body text case-insensitively with a real empty state", () => {
    expect(searchGuides("  WORKSPACEID  ").length).toBeGreaterThan(0);
    expect(searchGuides("unknown-phrase-xyz")).toEqual([]);
    expect(searchGuides(" ")).toEqual(guides);
  });
});
