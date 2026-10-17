import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildFileManifest, renderAgentsMd } from "../scripts/subrepos.mjs";

const root = resolve(import.meta.dirname, "..");
const { repos } = JSON.parse(readFileSync(resolve(root, "scripts/subrepos.json"), "utf8")) as {
  repos: { name: string; app: string; extraPaths: string[] }[];
};

// buildFileManifest walks the app tree plus its package closure and stats
// `.ai/` mirror candidates per file — on Windows CI a single scan can exceed
// the 5s default timeout. Scan each repo once and share the pending promise
// across both assertions, and give each test explicit headroom.
const manifestCache = new Map<string, Promise<string[]>>();
function manifestFor(spec: (typeof repos)[number]): Promise<string[]> {
  let pending = manifestCache.get(spec.name);
  if (pending === undefined) {
    pending = buildFileManifest(root, spec);
    manifestCache.set(spec.name, pending);
  }
  return pending;
}

describe("platform demo content", () => {
  it("keeps the neutral content boundary in generated agent instructions", () => {
    const instructions = renderAgentsMd(readFileSync(resolve(root, "AGENTS.md"), "utf8"));

    expect(instructions).toContain("neutral, replaceable example content");
    expect(instructions).toContain("default landing page must have no testimonials");
    expect(instructions).toContain("public assets, metadata, comments, tests, and shipped docs");
  });

  it.each(repos)(
    "$name ships no customer quote data or portrait assets",
    async (spec) => {
      const files = await manifestFor(spec);
      expect(
        files.some((file: string) =>
          /(?:public\/testimonials\/|marketing\/testimonials\.)/.test(file),
        ),
      ).toBe(false);
    },
    30_000,
  );

  it.each(repos)(
    "$name ships no default logo artwork or branded icon assets",
    async (spec) => {
      const files = await manifestFor(spec);
      expect(
        files.filter((file: string) =>
          /(?:marketing\/brand-(?:mark|geometry)|src-tauri\/icons\/|\/icon-source\.png$|app\/(?:icon\.svg|favicon\.ico|apple-icon\.png)$|public\/og\.png$|generate-(?:brand|desktop)-icons)/.test(
            file,
          ),
        ),
      ).toEqual([]);
      const instructions = renderAgentsMd(readFileSync(resolve(root, "AGENTS.md"), "utf8"));
      expect(instructions).toContain("Default demo chrome is text-only");
    },
    30_000,
  );
});
