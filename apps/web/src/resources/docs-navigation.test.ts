import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KIT_BLOCKS } from "../kit/blocks";
import { findGuide, guides, searchGuides } from "./content";
import { buildDocsIndex, guideToMarkdown } from "./docs-markdown";

describe("complete public documentation", () => {
  it("publishes the missing shipped capabilities and all platform paths", () => {
    for (const slug of [
      "desktop",
      "desktop/local-setup",
      "desktop/distribution",
      "modules/content",
      "modules/commerce",
      "modules/chat",
      "modules/storage",
      "modules/notifications",
      "modules/connected-accounts",
      "modules/schedules",
      "modules/admin",
      "modules/feature-flags",
      "modules/announcements",
      "modules/feedback",
      "modules/waitlist",
      "modules/referrals",
      "modules/two-factor",
      "modules/passkeys",
      "modules/authjs",
      "security/workspace-isolation",
      "security/rate-limiting",
      "security/turnstile",
      "reference/environment",
      "reference/commands",
      "reference/packages",
      "reference/api-routes",
      "reference/guides",
      "tutorials/first-ai-task",
      "tutorials/protected-page",
    ]) {
      const guide = findGuide(slug);
      expect(guide, slug).toBeDefined();
      expect(guide?.sections.length, slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("documents every registered block with its actual source files", () => {
    for (const block of KIT_BLOCKS) {
      const guide = findGuide(`components/${block.id}`);
      expect(guide, block.id).toBeDefined();
      const markdown = guide ? guideToMarkdown(guide) : "";
      for (const file of block.files) expect(markdown, block.id).toContain(file);
      expect(
        guide?.sections.some((section) => section.id === "usage"),
        block.id,
      ).toBe(true);
      expect(
        guide?.sections.some((section) => section.id === "props"),
        block.id,
      ).toBe(true);
    }
  });

  it("lists every runtime variable in the shipped example, including opt-in settings", () => {
    const example = readFileSync(
      fileURLToPath(new URL("../../../../.env.example", import.meta.url)),
      "utf8",
    );
    const names = [...example.matchAll(/^\s*(?:#\s*)?([A-Z][A-Z0-9_]+)=/gm)]
      .map((match) => match[1]!)
      .filter((name) => !name.startsWith("SUBREPO_"));
    const environment = findGuide("reference/environment");
    expect(environment).toBeDefined();
    const text = environment ? guideToMarkdown(environment) : "";
    for (const name of names) expect(text, name).toContain(name);
    expect(text).not.toContain("SUBREPO_");
  });

  it("lists every shipped API route with its real HTTP methods", () => {
    const api = findGuide("reference/api-routes");
    expect(api).toBeDefined();
    const text = api ? guideToMarkdown(api) : "";
    const apiRoot = fileURLToPath(new URL("../../app/api", import.meta.url));
    function walk(folder: string) {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const file = join(folder, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.name === "route.ts") {
          const route = `/api/${relative(apiRoot, file).replaceAll("\\", "/").replace("/route.ts", "")}`;
          expect(text, route).toContain(route);
          const source = readFileSync(file, "utf8");
          const methods = [
            ...source.matchAll(
              /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
            ),
          ].map((match) => match[1]!);
          const row = api?.sections
            .flatMap((section) => section.table?.rows ?? [])
            .find((cells) => cells.includes(route));
          for (const method of methods) expect(row?.[0], `${method} ${route}`).toContain(method);
        }
      }
    }
    walk(apiRoot);
    expect(text).toContain("Bearer");
    expect(text).toContain("Session");
  });
  it("keeps copyable commands executable and buyer-safe", () => {
    for (const guide of guides) {
      for (const section of guide.sections)
        expect(section.code ?? "", `${guide.slug}#${section.id}`).not.toContain("`n");
      expect(guideToMarkdown(guide), guide.slug).not.toMatch(/SUBREPO_|pnpm sync:subrepos/);
    }
  });

  it("keeps every linked guide and section resolvable", () => {
    for (const guide of guides) {
      expect(new Set(guide.sections.map((section) => section.id)).size, guide.slug).toBe(
        guide.sections.length,
      );
      const markdown = guideToMarkdown(guide);
      for (const match of markdown.matchAll(/\]\(\/docs\/([^\s)]+)\)/g)) {
        const [slug, anchor] = match[1]!.split("#");
        const target = findGuide(slug!);
        expect(target, `${guide.slug} links to ${slug}`).toBeDefined();
        if (anchor)
          expect(
            target?.sections.some((section) => section.id === anchor),
            match[1],
          ).toBe(true);
      }
    }
  });

  it("finds multi-word topics and ranks exact titles before incidental mentions", () => {
    expect(searchGuides("stripe webhook").some((guide) => guide.slug === "providers/stripe")).toBe(
      true,
    );
    expect(searchGuides("desktop hotkey").some((guide) => guide.slug.startsWith("desktop"))).toBe(
      true,
    );
    expect(searchGuides("storage")[0]?.slug).toBe("modules/storage");
    expect(searchGuides("SMTP_PORT").some((guide) => guide.slug === "reference/environment")).toBe(
      true,
    );
    expect(buildDocsIndex(guides).find((entry) => entry.slug === "desktop")?.text).toContain(
      "tauri",
    );
  });
});
