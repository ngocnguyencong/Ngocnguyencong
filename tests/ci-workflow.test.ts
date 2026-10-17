import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "ci.yml");
const workflow = readFileSync(workflowPath, "utf8");
const lines = workflow.split("\n");

/**
 * ci.yml is parsed by line scan, not a YAML library — `yaml`/`js-yaml` only
 * exist as transitive deps here and must not be imported undeclared. Jobs
 * sit at two-space indent under `jobs:`, so a job block runs from its
 * `  <name>:` line to the next line that starts a sibling key.
 */
function jobBlock(name: string): string[] {
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^ {2}\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end);
}

const desktop = jobBlock("desktop").join("\n");
const validate = jobBlock("validate").join("\n");

describe("ci workflow desktop job", () => {
  it("exists alongside the existing jobs", () => {
    expect(desktop.length).toBeGreaterThan(0);
    expect(validate.length).toBeGreaterThan(0);
  });

  it("runs on all three desktop OSes with independent lanes", () => {
    const matrix = /matrix:\s*\n(?:\s+.+\n)*?\s+os:\s*\[([^\]]+)\]/.exec(desktop);
    expect(matrix, "desktop job must declare strategy.matrix.os").not.toBeNull();
    const oses = matrix?.[1].split(",").map((os) => os.trim()) ?? [];
    expect(oses).toEqual(
      expect.arrayContaining(["ubuntu-latest", "windows-latest", "macos-latest"]),
    );
    expect(desktop).toMatch(/fail-fast:\s*false/);
    expect(desktop).toMatch(/runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/);
  });

  it("allows time for a real release-mode tauri build", () => {
    expect(desktop).toMatch(/timeout-minutes:\s*45/);
  });

  it("uses the pinned pnpm/node toolchain before running scripts", () => {
    for (const snippet of [
      "actions/checkout@v4",
      "pnpm/action-setup@v4",
      "version: 11.19.0",
      "actions/setup-node@v4",
      "node-version: 22.20.0",
      "cache: pnpm",
      "pnpm install --frozen-lockfile",
    ]) {
      expect(desktop, `desktop job must include "${snippet}"`).toContain(snippet);
    }
  });

  it("runs the desktop Rust test suite and the real installer build per OS", () => {
    expect(desktop).toContain("pnpm --filter @supastack/desktop test");
    expect(desktop).toContain("pnpm --filter @supastack/desktop build");
  });

  it("installs Tauri Linux deps plus FUSE only on the Ubuntu lane", () => {
    expect(desktop).toMatch(/if:\s*runner\.os\s*==\s*'Linux'/);
    expect(desktop).toContain("libwebkit2gtk-4.1-dev");
    // ubuntu-latest may be 24.04 where libfuse2 is renamed libfuse2t64.
    expect(desktop).toContain("libfuse2 ||");
    expect(desktop).toContain("libfuse2t64");
  });

  it("disables AppImage stripping for the ubuntu-24.04 glibc workaround", () => {
    expect(desktop).toMatch(/NO_STRIP:\s*"true"/);
  });

  it("caches cargo artifacts per OS lane", () => {
    expect(desktop).toContain("Swatinem/rust-cache@v2");
    expect(desktop).toMatch(/key:\s*\$\{\{\s*matrix\.os\s*\}\}/);
  });
});

describe("ci workflow validate job (unchanged coverage)", () => {
  it("still installs the Tauri Linux deps before pnpm check runs cargo check", () => {
    expect(validate).toContain("Install Tauri Linux system dependencies");
    expect(validate).toContain("libwebkit2gtk-4.1-dev");
    expect(validate).toContain("pnpm check");
  });
});
