import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const llmsPath = path.join(repoRoot, "llms.txt");

function readLlmsTxt(): string {
  expect(existsSync(llmsPath), "llms.txt must exist at the repository root").toBe(true);
  return readFileSync(llmsPath, "utf8");
}

/**
 * All markdown link targets: `[label](target)` in bullets or prose.
 * Intentionally narrow: reference-style links, images, and code spans are
 * not extracted — llms.txt is a controlled file that only uses inline links.
 */
function linkTargets(text: string): string[] {
  const targets: string[] = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    targets.push(match[1]);
  }
  return targets;
}

/** Repo-relative targets only — external URLs and pure anchors are skipped. */
function relativeTargets(text: string): string[] {
  return linkTargets(text)
    .map((target) => target.split("#")[0].split("?")[0])
    .filter(
      (target) =>
        target.length > 0 &&
        !/^(https?:|mailto:|tel:|ftp:)/i.test(target) &&
        !target.startsWith("//"),
    );
}

describe("llms.txt", () => {
  it("exists at the repo root with the llmstxt.org shape", () => {
    const text = readLlmsTxt();
    expect(text.startsWith("# "), "llms.txt must open with an `# <name>` H1").toBe(true);
    const head = text.split("\n").slice(0, 10);
    expect(
      head.some((line) => line.trimStart().startsWith(">")),
      "llms.txt must carry a `>` blockquote summary within its first 10 lines",
    ).toBe(true);
  });

  it("resolves every relative markdown link to a real file or directory", () => {
    const text = readLlmsTxt();
    const offenders: string[] = [];
    for (const target of relativeTargets(text)) {
      if (path.isAbsolute(target)) {
        offenders.push(`${target} — absolute path, must be repo-relative`);
        continue;
      }
      if (!existsSync(path.resolve(repoRoot, target))) {
        offenders.push(`${target} — does not exist`);
      }
    }
    expect(
      offenders,
      offenders.length === 0
        ? undefined
        : `llms.txt links to missing targets:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("documents the security protocols", () => {
    const text = readLlmsTxt();
    const section = /^## .*security protocols.*$/gim.exec(text);
    expect(section, "llms.txt needs a `## Security protocols` section").not.toBeNull();
    const start = section!.index + section![0].length;
    const nextHeading = text.indexOf("\n## ", start);
    const body = text.slice(start, nextHeading === -1 ? text.length : nextHeading);
    expect(body).toContain("workspaceId");
    expect(body).toMatch(/openssl|AUTH_SECRET/);
    expect(body).toMatch(/NEXT_PUBLIC_|EXPO_PUBLIC_/);
    expect(body).toMatch(/RLS/i);
    expect(body).toMatch(/rate[\s_-]?limit/i);
    expect(body).toContain("Better Auth");
    expect(body).toContain("PostgREST");
    expect(body).toContain("redactSensitive");
  });

  it("links the core agent map", () => {
    const targets = linkTargets(readLlmsTxt());
    const required = [
      "AGENTS.md",
      ".env.example",
      "docs/agent-security.md",
      "docs/agent-setup.md",
      "docs/deployment.md",
      "docs/vps-coolify.md",
      "Dockerfile",
      "docker-compose.yml",
      "prompts/",
      "packages/db",
    ];
    const missing = required.filter((needle) => !targets.some((t) => t.includes(needle)));
    expect(missing, `llms.txt is missing required links: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the preamble headingless (llmstxt.org: guidance zone before the first `##`)", () => {
    const text = readLlmsTxt();
    const firstSection = text.indexOf("\n## ");
    expect(firstSection, "llms.txt needs at least one `##` section").toBeGreaterThan(-1);
    const preamble = text.slice(0, firstSection);
    const heading = preamble.split("\n").findIndex((line, i) => i > 0 && /^#{1,6}\s/.test(line));
    expect(
      heading,
      `preamble must not contain headings (line ${heading + 1}): rules go in a \`##\` section`,
    ).toBe(-1);
  });

  it("ends with an Optional section", () => {
    const text = readLlmsTxt();
    const headings = [...text.matchAll(/^##\s+(.+?)\s*$/gim)].map((m) => m[1]);
    expect(headings.length, "llms.txt needs `##` sections").toBeGreaterThan(0);
    expect(
      headings[headings.length - 1],
      "the last `##` section must be `Optional` — secondary material goes last",
    ).toMatch(/^Optional\b/);
  });

  it("annotates every link bullet with a `: note`", () => {
    const text = readLlmsTxt();
    const unannotated = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^- \[.*?\]\(.*?\)/.test(line) && !/\)\s*:\s*\S/.test(line));
    expect(
      unannotated,
      `link bullets missing \`: note\` annotations:\n${unannotated.join("\n")}`,
    ).toEqual([]);
  });
});
