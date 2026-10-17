import { describe, expect, it } from "vitest";

import type { Guide } from "./content";
import { findGuide } from "./content";
import { buildDocsIndex, guideToMarkdown } from "./docs-markdown";

const guide: Guide = {
  slug: "web/local-setup",
  tab: "web",
  group: "Getting started",
  title: "Local setup",
  description: "Install the workspace.",
  sections: [
    {
      id: "install",
      title: "Prepare",
      paragraphs: ["Copy the env file."],
      code: "pnpm install",
      items: ["Node 22", "pnpm"],
    },
  ],
};

describe("guideToMarkdown", () => {
  it("exports complete first-run commands and preparation instructions", () => {
    for (const [surface, command] of [
      ["web", "corepack pnpm --filter @supastack/web dev"],
      ["mobile", "corepack pnpm --filter @supastack/mobile start"],
      ["desktop", "corepack pnpm --filter @supastack/desktop dev"],
    ]) {
      const markdown = guideToMarkdown(findGuide(`${surface}/local-setup`)!);
      expect(markdown).toContain(command);
      expect(markdown).toContain("(/docs/web/before-you-start)");
      expect(markdown).toContain("(/docs/web/terminal-basics)");
    }
  });
  it("exports the setup phase independently of the topic next article", () => {
    const markdown = guideToMarkdown(guide, {
      label: "Next",
      title: "Database details",
      href: "/docs/web/database",
      setupFlow: {
        sentence: "Continue setup with {guide}.",
        title: "Payments",
        href: "/docs/web/setup-payments",
      },
    });
    expect(markdown).toContain("Continue setup with [Payments](/docs/web/setup-payments).");
    expect(markdown).toContain("## Next\n\n[Database details](/docs/web/database)");
  });
  it("renders a guide as markdown with code fences and lists", () => {
    const markdown = guideToMarkdown(guide);
    expect(markdown).toContain("# Local setup");
    expect(markdown).toContain("## Prepare");
    expect(markdown).toContain("```\npnpm install\n```");
    expect(markdown).toContain("- Node 22");
    expect(markdown).toContain("Copy the env file.");
  });
});

describe("buildDocsIndex", () => {
  it("produces a serializable client-side search index", () => {
    const index = buildDocsIndex([guide]);
    expect(index).toHaveLength(1);
    expect(index[0]).toMatchObject({ slug: "web/local-setup", title: "Local setup" });
    expect(index[0]!.text).toContain("copy the env file");
    // sections are not serializable as component props — index is flat strings
    expect(typeof index[0]!.text).toBe("string");
  });
});
