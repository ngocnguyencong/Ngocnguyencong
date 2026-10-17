import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyShippedIgnoreRules,
  buildFileManifest,
  captureCheckoutState,
  deriveRemote,
  GENERATED,
  git,
  gitOrThrow,
  ignoredPaths,
  listGit,
  packageClosure,
  positionBranch,
  renderAgentsMd,
  renderAiMirror,
  renderEnvExample,
  renderLlmsTxt,
  renderReadme,
  renderRootPackageJson,
  renderWikiJson,
  resolveRemote,
  resolveWorkDir,
  restoreCheckoutState,
  restoreDryRunSibling,
  runGit,
  workspacePackageMap,
} from "../scripts/subrepos.mjs";

let root: string;

type RealRepoSpec = { app: string; extraPaths?: string[]; name: string };

const realRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const realRepoSpecs = (
  JSON.parse(readFileSync(path.join(realRepoRoot, "scripts/subrepos.json"), "utf8")) as {
    repos: RealRepoSpec[];
  }
).repos;
const realManifestCache = new Map<string, Promise<string[]>>();
const realSourceCache = new Map<string, string>();
const realAiMirrorCache = new Map<string, string | null>();
let realWorkspacePackageMapCache: Promise<Map<string, string>> | undefined;

function realManifest(spec: RealRepoSpec): Promise<string[]> {
  const key = JSON.stringify(spec);
  let manifest = realManifestCache.get(key);
  if (!manifest) {
    manifest = buildFileManifest(realRepoRoot, spec);
    realManifestCache.set(key, manifest);
  }
  return manifest;
}

function realWorkspacePackages(): Promise<Map<string, string>> {
  realWorkspacePackageMapCache ??= workspacePackageMap(realRepoRoot);
  return realWorkspacePackageMapCache;
}

function readRealSource(rel: string): string {
  let source = realSourceCache.get(rel);
  if (source === undefined) {
    source = readFileSync(path.join(realRepoRoot, rel), "utf8");
    realSourceCache.set(rel, source);
  }
  return source;
}

function renderRealAiMirror(rel: string): string | null {
  if (!realAiMirrorCache.has(rel)) {
    realAiMirrorCache.set(rel, renderAiMirror(readRealSource(rel)));
  }
  return realAiMirrorCache.get(rel)!;
}

// The three real manifests are immutable during this suite. Resolve them once
// before per-test timeouts start; fixture-root manifest tests stay uncached.
beforeAll(async () => {
  await realWorkspacePackages();
  for (const spec of realRepoSpecs) await realManifest(spec);
}, 60_000);

async function writePkg(dir: string, pkg: Record<string, unknown>) {
  await mkdir(path.join(root, dir), { recursive: true });
  await writeFile(path.join(root, dir, "package.json"), JSON.stringify(pkg));
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "subrepos-"));
});

afterEach(async () => {
  await rm(root, { force: true, recursive: true });
});

describe("workspacePackageMap", () => {
  it("maps package names to repo-relative dirs across apps and packages", async () => {
    await writePkg("apps/web", { name: "@supastack/web" });
    await writePkg("packages/db", { name: "@supastack/db" });
    await writePkg("packages/noname", {});
    const map = await workspacePackageMap(root);
    expect(map.get("@supastack/web")).toBe("apps/web");
    expect(map.get("@supastack/db")).toBe("packages/db");
    expect(map.size).toBe(2);
  });
});

describe("packageClosure", () => {
  it("walks workspace:* deps transitively, including devDependencies", async () => {
    await writePkg("apps/web", {
      name: "@supastack/web",
      dependencies: { "@supastack/api": "workspace:*", react: "19.2.3" },
    });
    await writePkg("packages/api", {
      name: "@supastack/api",
      dependencies: { "@supastack/db": "workspace:*" },
    });
    await writePkg("packages/db", {
      name: "@supastack/db",
      devDependencies: { "@supastack/config": "workspace:*" },
    });
    await writePkg("packages/config", { name: "@supastack/config" });
    await writePkg("packages/unused", { name: "@supastack/unused" });
    const closure = await packageClosure(root, "apps/web");
    expect(closure).toEqual(["packages/api", "packages/config", "packages/db"]);
  });

  it("returns empty when the app has no workspace deps", async () => {
    await writePkg("apps/desktop", { name: "@supastack/desktop" });
    expect(await packageClosure(root, "apps/desktop")).toEqual([]);
  });
});

describe("deriveRemote", () => {
  it("derives https remotes with and without .git suffix", () => {
    expect(deriveRemote("https://github.com/acme/supastack.git", "supastack-web")).toBe(
      "https://github.com/acme/supastack-web.git",
    );
    expect(deriveRemote("https://github.com/acme/supastack", "supastack-mobile")).toBe(
      "https://github.com/acme/supastack-mobile.git",
    );
  });

  it("derives ssh remotes preserving host and org path", () => {
    expect(deriveRemote("git@github.com:acme/supastack.git", "supastack-desktop")).toBe(
      "git@github.com:acme/supastack-desktop.git",
    );
    expect(deriveRemote("git@gitlab.com:grp/sub/supastack", "supastack-web")).toBe(
      "git@gitlab.com:grp/sub/supastack-web.git",
    );
  });

  it("returns null for unusable origins", () => {
    expect(deriveRemote(undefined, "supastack-web")).toBeNull();
    expect(deriveRemote("not-a-url", "supastack-web")).toBeNull();
  });
});

describe("resolveWorkDir", () => {
  it("defaults to the managed .subrepos staging clone", () => {
    const { dir, mode } = resolveWorkDir(root, { name: "supastack-web" });
    expect(dir).toBe(path.join(root, ".subrepos", "supastack-web"));
    expect(mode).toBe("managed");
  });

  it("uses the declared sibling checkout", () => {
    const { dir, mode } = resolveWorkDir(root, {
      name: "supastack-web",
      checkout: "../supastack-web",
    });
    expect(dir).toBe(path.resolve(root, "../supastack-web"));
    expect(mode).toBe("sibling");
  });

  it("SUBREPO_HOME maps every repo to a sibling dir; checkout wins", () => {
    const env = { SUBREPO_HOME: "../" };
    expect(resolveWorkDir(root, { name: "supastack-mobile" }, { env })).toEqual({
      dir: path.resolve(root, "../supastack-mobile"),
      mode: "sibling",
    });
    expect(
      resolveWorkDir(root, { name: "supastack-mobile", checkout: "custom/dir" }, { env }),
    ).toEqual({ dir: path.resolve(root, "custom/dir"), mode: "sibling" });
  });
});

describe("resolveRemote", () => {
  const spec = { name: "supastack-web", remoteEnv: "SUBREPO_WEB_REMOTE" };

  it("prefers env override, then sibling origin, then derived", () => {
    const originUrl = "https://github.com/acme/supastack.git";
    expect(
      resolveRemote(spec, {
        env: { SUBREPO_WEB_REMOTE: "https://x/y.git" },
        originUrl,
        siblingOrigin: "https://github.com/acme/existing.git",
      }),
    ).toBe("https://x/y.git");
    expect(resolveRemote(spec, { env: {}, originUrl, siblingOrigin: "https://sib/repo.git" })).toBe(
      "https://sib/repo.git",
    );
    expect(resolveRemote(spec, { env: {}, originUrl })).toBe(
      "https://github.com/acme/supastack-web.git",
    );
  });

  it("returns null when nothing resolves", () => {
    expect(resolveRemote(spec, { env: {} })).toBeNull();
  });
});

describe("renderRootPackageJson", () => {
  const monorepoPkg = {
    name: "noah-supastack",
    version: "0.1.0",
    private: true,
    type: "module",
    packageManager: "pnpm@11.19.0",
    engines: { node: ">=22.0.0" },
    scripts: {
      build: "turbo run build --filter=!@supastack/desktop",
      changeset: "changeset",
      check:
        "corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm format:check",
      dev: "turbo run dev --parallel --filter=!@supastack/desktop",
      format: "prettier --write .",
      "format:check": "prettier --check .",
      "jobs:tick": "node scripts/scheduler-tick.mjs",
      lint: "eslint .",
      test: "vitest run",
      "test:e2e": "playwright test",
      typecheck: "turbo run typecheck",
    },
    devDependencies: {
      "@changesets/cli": "3.0.1",
      "@eslint/js": "9.39.5",
      "@playwright/test": "1.62.1",
      "@types/node": "22.20.1",
      eslint: "9.39.5",
      prettier: "3.9.6",
      turbo: "2.10.12",
      typescript: "5.9.3",
      "typescript-eslint": "8.69.0",
      vitest: "4.1.11",
    },
  };

  it("keeps the shared toolchain and drops monorepo-only tooling", () => {
    const rendered = renderRootPackageJson(monorepoPkg, { name: "supastack-web" });
    expect(rendered.name).toBe("supastack-web");
    expect(rendered.scripts).not.toHaveProperty("changeset");
    expect(rendered.scripts).not.toHaveProperty("test:e2e");
    // Documented in the shipped .env.example/AGENTS.md — must survive.
    expect(rendered.scripts).toHaveProperty("jobs:tick");
    expect(rendered.devDependencies).toHaveProperty("turbo");
    expect(rendered.devDependencies).toHaveProperty("vitest");
    expect(rendered.devDependencies).not.toHaveProperty("@playwright/test");
    expect(rendered.devDependencies).not.toHaveProperty("@changesets/cli");
    expect(rendered.packageManager).toBe("pnpm@11.19.0");
    // Buyer checkouts must carry the license pointer, not an SPDX guess.
    expect(rendered.license).toBe("SEE LICENSE IN LICENSE.md");
  });

  it("applies per-repo script overrides", () => {
    const rendered = renderRootPackageJson(monorepoPkg, {
      name: "supastack-desktop",
      scripts: { dev: "pnpm --filter @supastack/desktop dev" },
    });
    expect(rendered.scripts.dev).toBe("pnpm --filter @supastack/desktop dev");
  });

  it("drops test scripts when the manifest ships no tests", () => {
    const rendered = renderRootPackageJson(monorepoPkg, { name: "supastack-desktop" }, [
      "apps/desktop/package.json",
      "apps/desktop/src-tauri/Cargo.toml",
    ]);
    expect(rendered.scripts).not.toHaveProperty("test");
    expect(rendered.scripts).not.toHaveProperty("test:watch");
    expect(rendered.scripts.check).toBe(
      "corepack pnpm lint && corepack pnpm typecheck && corepack pnpm format:check",
    );
  });

  it("renders the current desktop buyer manifest without a removed test command", async () => {
    const repoRoot = realRepoRoot;
    const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    const desktop = realRepoSpecs.find((spec) => spec.name === "supastack-desktop")!;
    const files = [...(await realManifest(desktop))];
    expect(files.some((file) => /\.test\.[jt]sx?$/.test(file))).toBe(false);
    // The buyer checkout must carry the license file itself.
    expect(files).toContain("LICENSE.md");

    const rendered = renderRootPackageJson(rootPkg, desktop, files);
    expect(rendered.scripts).not.toHaveProperty("test");
    expect(rendered.scripts.check).toBe(
      "corepack pnpm lint && corepack pnpm typecheck && corepack pnpm format:check",
    );
  });

  it("keeps test coverage when the buyer manifest ships test files", () => {
    const rendered = renderRootPackageJson(monorepoPkg, { name: "supastack-web" }, [
      "apps/web/src/feature.test.ts",
    ]);
    expect(rendered.scripts.test).toBe("vitest run");
    expect(rendered.scripts.check).toBe(monorepoPkg.scripts.check);
  });
});

describe("buyer-facing root file renders", () => {
  it.each([
    ["agent instructions", renderAgentsMd],
    ["memory docs", renderAiMirror],
    ["environment examples", renderEnvExample],
  ])("renders identical %s from Windows and Linux line endings", (_name, render) => {
    const input = "# Shared\n\nSUBREPO_WEB_REMOTE=\n\n\nWorkspace configuration.\n";
    const expected = "# Shared\n\nWorkspace configuration.\n";
    expect(render(input)).toBe(expected);
    expect(render(input.replaceAll("\n", "\r\n"))).toBe(expected);
  });

  it("renderAgentsMd strips seller-internal sync lines but keeps the .ai/ rule", () => {
    const input = [
      "- Read `.ai/PROJECT_CONTEXT.md` before code changes and maintain matching `.ai/` file docs.",
      "- Scope every user-owned record by `workspaceId`.",
      "- Sub-repos (`supastack-web` / `supastack-mobile` / `supastack-desktop`, declared in `scripts/subrepos.json`) are sync targets only — always edit in this monorepo and push via `pnpm sync:subrepos`. Their names are a fulfillment contract: the seller site invites buyers to exactly these repos.",
      "  Buyers fork them to build products — synced `.ai/` mirror docs ship with seller-internal lines stripped.",
      "- `pnpm sync:subrepos` — mirror the monorepo into the per-platform repos (`--only <name>`, `--dry-run`).",
      "- `pnpm test` — deterministic fake/local tests.",
    ].join("\n");
    const out = renderAgentsMd(input);
    expect(out).toContain("workspaceId");
    expect(out).toContain("pnpm test");
    // `.ai/` mirror docs legitimately ship downstream — the rule survives.
    expect(out).toContain(".ai/PROJECT_CONTEXT.md");
    expect(out).not.toContain("sync:subrepos");
    expect(out).not.toContain("Sub-repos");
    expect(out).not.toContain("seller");
    expect(out).not.toContain("supastack-web");
  });

  it("renderEnvExample drops sync plumbing but keeps app vars", () => {
    const input = [
      "APP_URL=http://localhost:3000",
      "# Sub-repo sync targets for `pnpm sync:subrepos` (optional — defaults derive",
      "# from the origin remote's org: <org>/supastack-{web,mobile,desktop}.git)",
      "# SUBREPO_WEB_REMOTE=",
      "# SUBREPO_HOME: staging parent dir for the sub-repo clones (default .subrepos/;",
      '# ".." keeps them as sibling checkouts, e.g. ../supastack-web).',
      "# SUBREPO_HOME=",
      "SUPASTACK_APP_URL=http://localhost:3000",
    ].join("\n");
    const out = renderEnvExample(input);
    expect(out).toContain("APP_URL=http://localhost:3000");
    expect(out).toContain("SUPASTACK_APP_URL");
    expect(out).not.toContain("SUBREPO");
  });

  it("renderReadme is fork-friendly and documents provenance", () => {
    const out = renderReadme({ name: "supastack-web", app: "apps/web" });
    expect(out).toContain("# supastack-web");
    expect(out).toContain("apps/web/");
    expect(out).toContain(".ai/");
    expect(out).toContain(".supastack-sync");
    expect(out).not.toContain("Do not edit");
    // Buyers get the license pointer in the rendered README.
    expect(out).toContain("LICENSE.md");
  });

  it("renderReadme is English-only", () => {
    const out = renderReadme({ name: "supastack-mobile", app: "apps/mobile" });
    expect(out).toContain("apps/mobile/");
    expect(out).not.toMatch(/\p{Script=Han}/u);
  });
});

describe("renderAiMirror", () => {
  it("drops seller/sync-internal lines and keeps clean content", () => {
    const input = [
      "# pkg.ts",
      "",
      "Pure helper for the workspace package graph.",
      "Ported from ../starterkit where the seller site lives.",
      "Reaches buyers via pnpm sync:subrepos (SUBREPO_HOME sibling checkouts).",
      "Tracking issue lives on the vorlee board.",
      "Unrelated line stays.",
    ].join("\n");
    const out = renderAiMirror(input);
    expect(out).toContain("Pure helper for the workspace package graph.");
    expect(out).toContain("Unrelated line stays.");
    expect(out).not.toMatch(/starterkit|seller|vorlee|sync:subrepos|SUBREPO_/i);
  });

  it("collapses 3+ consecutive blank lines after filtering", () => {
    const out = renderAiMirror("# a\n\n\n\n\nbody line\n");
    expect(out).toBe("# a\n\nbody line\n");
  });

  it("returns null when only headings, blanks and table separators survive", () => {
    const input = [
      "# internal doc",
      "",
      "Shipped by pnpm sync:subrepos from the seller storefront.",
      "",
      "| --- | --- |",
    ].join("\n");
    expect(renderAiMirror(input)).toBeNull();
  });
});

describe("buildFileManifest", () => {
  it("includes the app, dep closure, root files and extras; skips generated dirs", async () => {
    await writePkg("apps/mobile", {
      name: "@supastack/mobile",
      dependencies: { "@supastack/ui-native": "workspace:*" },
    });
    await writePkg("packages/ui-native", { name: "@supastack/ui-native" });
    await writePkg("packages/ai", { name: "@supastack/ai" });
    await mkdir(path.join(root, "apps/mobile/src"), { recursive: true });
    await writeFile(path.join(root, "apps/mobile/src/index.ts"), "export {};\n");
    await mkdir(path.join(root, "apps/mobile/node_modules/x"), { recursive: true });
    await writeFile(path.join(root, "apps/mobile/node_modules/x/index.js"), "x");
    await mkdir(path.join(root, "apps/mobile/dist"), { recursive: true });
    await writeFile(path.join(root, "apps/mobile/dist/bundle.js"), "x");
    await writeFile(path.join(root, ".gitattributes"), "* text=auto eol=lf\n");
    await writeFile(path.join(root, "LICENSE.md"), "# License\n");
    await writeFile(path.join(root, "tsconfig.base.json"), "{}");
    await writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n");
    await mkdir(path.join(root, "patches"), { recursive: true });
    await writeFile(path.join(root, "patches/dependency.patch"), "security fix\n");
    await writeFile(path.join(root, "secret.env"), "nope");
    await writeFile(path.join(root, "Dockerfile"), "FROM node\n");

    const manifest = await buildFileManifest(root, {
      name: "supastack-mobile",
      app: "apps/mobile",
      extraPaths: ["Dockerfile"],
    });

    expect(manifest).toContain("apps/mobile/package.json");
    expect(manifest).toContain("apps/mobile/src/index.ts");
    expect(manifest).toContain("packages/ui-native/package.json");
    expect(manifest).not.toContain("packages/ai/package.json");
    expect(manifest).toContain(".gitattributes");
    expect(manifest).toContain("LICENSE.md");
    expect(manifest).toContain("tsconfig.base.json");
    expect(manifest).toContain("pnpm-workspace.yaml");
    expect(manifest).toContain("patches/dependency.patch");
    expect(manifest).toContain("Dockerfile");
    expect(manifest).not.toContain("secret.env");
    expect(manifest.some((f) => f.includes("node_modules"))).toBe(false);
    expect(manifest.some((f) => f.startsWith("apps/mobile/dist"))).toBe(false);
  });

  it("every real workspace manifest declares the shipped license pointer", async () => {
    const map = await realWorkspacePackages();
    expect(map.size).toBeGreaterThan(0);

    for (const dir of map.values()) {
      const pkg = JSON.parse(readRealSource(`${dir}/package.json`));
      expect(pkg.license, `${dir}/package.json`).toBe("SEE LICENSE IN LICENSE.md");
    }
  });

  it("ships LICENSE.md and its .ai mirror in the real manifest, unignored", async () => {
    const repoRoot = realRepoRoot;
    const web = realRepoSpecs.find((spec) => spec.name === "supastack-web")!;
    const manifest = await realManifest(web);

    expect(manifest).toContain("LICENSE.md");
    // The mirror path is case-sensitive on Linux sync runs — pin the exact name.
    expect(manifest).toContain(".ai/LICENSE.md");
    const dropped = ignoredPaths(repoRoot, [...manifest], { warn: () => {} });
    expect([...dropped]).not.toContain("LICENSE.md");
  });

  it("ships .ai mirror docs for shipped files only, plus PROJECT_CONTEXT", async () => {
    await writePkg("apps/mobile", {
      name: "@supastack/mobile",
      dependencies: { "@supastack/ui-native": "workspace:*" },
    });
    await writePkg("packages/ui-native", { name: "@supastack/ui-native" });
    await writePkg("packages/ai", { name: "@supastack/ai" });
    await mkdir(path.join(root, "apps/mobile/src"), { recursive: true });
    await writeFile(path.join(root, "apps/mobile/src/index.ts"), "export {};\n");
    await writeFile(path.join(root, "packages/ui-native/pkg.ts"), "export {};\n");
    await writeFile(path.join(root, ".gitattributes"), "* text=auto eol=lf\n");
    await writeFile(path.join(root, ".env.example"), "APP_URL=x\n");

    // Mirrors of shipped files: strip-ext, append, and dotfile-strip
    // conventions — plus package.json → package.md.
    const mirror = async (rel: string) => {
      await mkdir(path.join(root, path.dirname(rel)), { recursive: true });
      await writeFile(path.join(root, rel), `# ${rel}\n`);
    };
    await mirror(".ai/apps/mobile/src/index.md");
    await mirror(".ai/packages/ui-native/pkg.md");
    await mirror(".ai/apps/mobile/package.md");
    await mirror(".ai/gitattributes.md");
    await mirror(".ai/.env.example.md");
    // Entry doc mirrors nothing — always ships; the monorepo README mirror
    // never does (README.md is generated downstream).
    await mirror(".ai/PROJECT_CONTEXT.md");
    await mirror(".ai/README.md");
    // Mirrors of files that do not ship must not leak into the manifest.
    await mirror(".ai/packages/ai/index.md");
    await mirror(".ai/scripts/subrepos.mjs.md");
    await mirror(".ai/tests/subrepos.test.md");

    const manifest = await buildFileManifest(root, {
      name: "supastack-mobile",
      app: "apps/mobile",
    });

    expect(manifest).toContain(".ai/apps/mobile/src/index.md");
    expect(manifest).toContain(".ai/packages/ui-native/pkg.md");
    expect(manifest).toContain(".ai/apps/mobile/package.md");
    expect(manifest).toContain(".ai/gitattributes.md");
    expect(manifest).toContain(".ai/.env.example.md");
    expect(manifest).toContain(".ai/PROJECT_CONTEXT.md");
    expect(manifest).not.toContain(".ai/README.md");
    expect(manifest.some((f) => f.startsWith(".ai/packages/ai/"))).toBe(false);
    expect(manifest.some((f) => f.startsWith(".ai/scripts/"))).toBe(false);
    expect(manifest.some((f) => f.startsWith(".ai/tests/"))).toBe(false);
  });
});

describe("shipped helper-script parity", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const config = JSON.parse(readFileSync(path.join(repoRoot, "scripts/subrepos.json"), "utf8")) as {
    repos: { extraPaths?: string[]; name: string }[];
  };
  const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };

  // The shipped .env.example/AGENTS.md tell buyers to run `pnpm jobs:tick`,
  // so every repo whose rendered package.json keeps a `node scripts/<file>`
  // script must also carry that file into its manifest — via `extraPaths`,
  // the only channel that ships root-level helper scripts.
  it("every repo shipping a `node scripts/…` script also ships the script file", () => {
    for (const spec of config.repos) {
      const rendered = renderRootPackageJson(rootPkg, spec);
      for (const command of Object.values(rendered.scripts ?? {})) {
        const target = /(?:^|&&\s*)node\s+(scripts\/\S+)/.exec(command)?.[1];
        if (target === undefined) continue;
        expect(
          spec.extraPaths ?? [],
          `${spec.name} renders "${command}" but ${target} is not in extraPaths`,
        ).toContain(target);
        expect(existsSync(path.join(repoRoot, target)), `${target} must exist`).toBe(true);
      }
    }
  });
});

describe("renderWikiJson", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const wiki = JSON.parse(readFileSync(path.join(repoRoot, ".devin/wiki.json"), "utf8")) as {
    pages: { parent?: string; purpose: string; title: string }[];
    repo_notes: { content: string }[];
  };

  it("monorepo wiki.json has a valid DeepWiki shape", () => {
    expect(Array.isArray(wiki.repo_notes)).toBe(true);
    for (const note of wiki.repo_notes) {
      expect(typeof note.content).toBe("string");
      expect(note.content.length).toBeLessThanOrEqual(10_000);
    }
    expect(wiki.pages.length).toBeGreaterThan(0);
    expect(wiki.pages.length).toBeLessThanOrEqual(30);
    for (const page of wiki.pages) {
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.purpose.trim().length).toBeGreaterThan(0);
    }
  });

  it("has unique titles and parents that all resolve", () => {
    const titles = wiki.pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    const known = new Set(titles);
    for (const page of wiki.pages) {
      if (page.parent != null) {
        expect(known.has(page.parent), `${page.title} parent ${page.parent}`).toBe(true);
      }
    }
    // No cycles: walking parents from any page must terminate.
    const parentOf = new Map(wiki.pages.map((p) => [p.title, p.parent ?? null]));
    for (const page of wiki.pages) {
      const seen = new Set();
      let cursor = page.title;
      while (parentOf.get(cursor) != null) {
        cursor = parentOf.get(cursor);
        expect(seen.has(cursor)).toBe(false);
        seen.add(cursor);
      }
    }
  });

  const webFiles = [
    "apps/web/package.json",
    "packages/billing/package.json",
    "packages/config/package.json",
    "packages/db/package.json",
    "packages/agents/package.json",
    "packages/email/package.json",
    "packages/ai/package.json",
    "packages/jobs/package.json",
    "packages/storage/package.json",
    "packages/observability/package.json",
    "packages/design-tokens/package.json",
  ];
  const mobileFiles = ["apps/mobile/package.json", "packages/design-tokens/package.json"];

  it("scopes pages to what each repo ships", () => {
    const web = renderWikiJson(wiki, webFiles);
    const webTitles = web.pages.map((p) => p.title);
    expect(webTitles).toContain("Web Application");
    expect(webTitles).toContain("Billing Adapter Contracts");
    expect(webTitles).toContain("Supabase Deployment");
    expect(webTitles).not.toContain("Mobile Application");
    expect(webTitles).not.toContain("Desktop Shell");
    expect(webTitles).not.toContain("Mobile BFFs & Native Purchases");

    const mobile = renderWikiJson(wiki, mobileFiles);
    const mobileTitles = mobile.pages.map((p) => p.title);
    expect(mobileTitles).toContain("Mobile Application");
    expect(mobileTitles).toContain("Mobile BFFs & Native Purchases");
    expect(mobileTitles).toContain("UI Packages & Design Tokens");
    expect(mobileTitles).toContain("Architecture Overview");
    expect(mobileTitles).not.toContain("Web Application");
    expect(mobileTitles).not.toContain("Billing Adapter Contracts");
    expect(mobileTitles).not.toContain("MCP Server");
  });

  it("reparents children of filtered-out pages to the nearest surviving ancestor", () => {
    // Mobile repo keeps "Mobile BFFs & Native Purchases" under "Mobile
    // Application"; package pages reparent to "Shared Packages" (global "*").
    const mobile = renderWikiJson(wiki, mobileFiles);
    const byTitle = new Map(mobile.pages.map((p) => [p.title, p]));
    expect(byTitle.get("Mobile BFFs & Native Purchases").parent).toBe("Mobile Application");
    expect(byTitle.get("UI Packages & Design Tokens").parent).toBe("Shared Packages");
    // Every emitted parent must exist in the emitted set.
    const titles = new Set(mobile.pages.map((p) => p.title));
    for (const page of mobile.pages) {
      if (page.parent != null) expect(titles.has(page.parent)).toBe(true);
    }
  });

  it("emits buyer-clean content — no sync machinery or seller terms", () => {
    const banned = /starterkit|storefront|seller|\.ai\/|sub-?repo|supastack-sync|sync:subrepos/i;
    for (const files of [webFiles, mobileFiles]) {
      const scoped = renderWikiJson(wiki, files);
      const blob = JSON.stringify(scoped);
      expect(blob, blob.match(banned)?.[0] ?? "").not.toMatch(banned);
    }
  });
});

describe("renderLlmsTxt", () => {
  const webSpec = { name: "supastack-web", app: "apps/web" };
  const shipped = [
    ".ai/PROJECT_CONTEXT.md",
    ".devin/wiki.json",
    ".env.example",
    "AGENTS.md",
    "docs/agent-security.md",
    "LICENSE.md",
    "apps/web/package.json",
    "docs/adopt-patterns.md",
    "docs/agent-setup.md",
    "docs/deployment.md",
    "packages/auth/src/index.ts",
    "packages/db/src/schema.ts",
    "packages/observability/src/index.ts",
    "packages/config/package.json",
    "packages/db/package.json",
    "prompts/README.md",
    "prompts/pick-a-style.md",
    "scripts/supabase-doctor.mjs",
  ];

  it("heads the file with the repo name and a per-app flavor line", () => {
    const out = renderLlmsTxt(webSpec, shipped);
    expect(out.startsWith("# supastack-web\n")).toBe(true);
    expect(out).toContain("Next.js");
    expect(renderLlmsTxt({ name: "supastack-mobile", app: "apps/mobile" }, shipped)).toContain(
      "Expo",
    );
    expect(renderLlmsTxt({ name: "supastack-desktop", app: "apps/desktop" }, shipped)).toContain(
      "Tauri",
    );
  });

  it("links only paths that ship or are generated alongside", () => {
    const out = renderLlmsTxt(webSpec, shipped);
    const known = new Set([...shipped, ...GENERATED]);
    const links = [...out.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(known.has(link), link).toBe(true);
    // Generated siblings link even though they are not in `files`.
    expect(out).toContain("[README.md](README.md)");
    expect(out).toContain("[.devin/wiki.json](.devin/wiki.json)");
    // Docs absent from the manifest never appear.
    expect(out).not.toContain("docs/vps-coolify.md");
    expect(out).not.toContain("docs/upgrading.md");
    // Deploy docs are not double-listed under Guides.
    expect(out.match(/docs\/agent-setup\.md/g)).toHaveLength(1);
    expect(out.match(/docs\/deployment\.md/g)).toHaveLength(1);
    expect(out.match(/docs\/agent-security\.md/g)).toHaveLength(1);
    // The app package itself is not listed under Packages.
    expect(out).not.toContain("apps/web/package.json");
    expect(out).toContain("[packages/db](packages/db/package.json)");
  });

  it("drops the .devin/wiki.json link when no source wiki will be written", () => {
    // `.devin/wiki.json` sits in GENERATED, but mirror() writes it only when
    // the monorepo has a source wiki — the link follows literal `files`
    // membership so the llms.txt never dangles.
    const out = renderLlmsTxt(
      webSpec,
      shipped.filter((f) => f !== ".devin/wiki.json"),
    );
    expect(out).not.toContain(".devin/wiki.json");
    expect(out).not.toContain("DeepWiki");
  });

  it("always carries the security protocols", () => {
    const out = renderLlmsTxt(webSpec, shipped);
    expect(out).toContain("## Security protocols");
    expect(out).toContain("[Agent security](docs/agent-security.md)");
    expect(out).toContain("workspaceId");
    expect(out).toContain("Better Auth");
    expect(out).toContain("BFF");
    expect(out).toContain("PostgREST");
    expect(out).toContain("redacted");
    expect(out).toContain("(packages/auth/src/index.ts)");
    expect(out).toContain("(packages/db/src/schema.ts)");
    expect(out).toContain("(packages/observability/src/index.ts)");
    expect(out).toContain("(scripts/supabase-doctor.mjs)");
    expect(out).toMatch(/NEXT_PUBLIC_|EXPO_PUBLIC_/);
    expect(out).toContain("openssl rand");
    expect(out).toContain("TRUSTED_PROXY_COUNT");
    expect(out).toContain("supabase:doctor --fix-rls");
  });

  it("omits the shared security-doc link when that file is not shipped", () => {
    const out = renderLlmsTxt(
      webSpec,
      shipped.filter((file) => file !== "docs/agent-security.md"),
    );
    expect(out).not.toContain("docs/agent-security.md");
  });

  it("points native maps to backend setup in the web checkout without dangling links", () => {
    const nativeFiles = [
      "AGENTS.md",
      ".env.example",
      "docs/agent-security.md",
      "docs/deployment.md",
    ];
    const setupNote =
      "Backend Docker/Podman local setup, Coolify/plain-VPS Docker deployment, and the pasteable setup prompt live in the supastack-web checkout.";

    for (const spec of [
      { name: "supastack-mobile", app: "apps/mobile" },
      { name: "supastack-desktop", app: "apps/desktop" },
    ]) {
      const out = renderLlmsTxt(spec, nativeFiles);
      expect(out).toContain(setupNote);
      expect(out).not.toContain("](docs/agent-setup.md)");
      expect(out).not.toContain("](docs/vps-coolify.md)");
      expect(out).not.toContain("](prompts/agent-setup.md)");
    }
  });

  it("describes the RLS outcome instead of naming supabase:doctor when the script does not ship", () => {
    // Mobile/desktop manifests carry no scripts/supabase-doctor.mjs — the
    // generated text must not name a command that does not exist there.
    const mobileShipped = shipped.filter(
      (file) =>
        file !== "scripts/supabase-doctor.mjs" &&
        ![
          "packages/auth/src/index.ts",
          "packages/db/src/schema.ts",
          "packages/observability/src/index.ts",
        ].includes(file),
    );
    const bare = renderLlmsTxt({ name: "supastack-mobile", app: "apps/mobile" }, mobileShipped);
    expect(bare).toContain("## Security protocols");
    expect(bare).not.toContain("supabase:doctor");
    expect(bare).toContain("PostgREST");
    expect(bare).toContain("BFF session/workspace authorization");
    expect(bare).not.toContain("(packages/auth/src/index.ts)");
    expect(bare).not.toContain("(packages/db/src/schema.ts)");
    expect(bare).not.toContain("(packages/observability/src/index.ts)");
    expect(bare).toMatch(/PostgREST exposure surface and verify RLS policies\/grants/i);
  });

  it("emits the Agent prompts section only when prompts ship", () => {
    const bare = renderLlmsTxt(
      webSpec,
      shipped.filter((f) => !f.startsWith("prompts/")),
    );
    expect(bare).not.toContain("## Agent prompts");
    expect(bare).not.toContain("prompts/pick-a-style.md");

    const out = renderLlmsTxt(webSpec, shipped);
    expect(out).toContain("## Agent prompts");
    expect(out).toContain("[Prompt library](prompts/README.md)");
    expect(out).toContain("[Pick A Style](prompts/pick-a-style.md)");
  });

  it("links container files only when the manifest ships them", () => {
    const bare = renderLlmsTxt(webSpec, shipped);
    expect(bare).not.toContain("Dockerfile");
    expect(bare).not.toContain("docker-compose");

    const dockered = renderLlmsTxt(webSpec, [
      ...shipped,
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.dev.yml",
    ]);
    expect(dockered).toContain("(Dockerfile)");
    expect(dockered).toContain("(docker-compose.yml)");
    expect(dockered).toContain("(docker-compose.dev.yml)");
  });
});

/**
 * positionBranch / restoreCheckoutState against real git repos under
 * os.tmpdir() — never the sibling checkouts named in scripts/subrepos.json.
 * `git init -b main` pins the default branch so the fixtures do not depend
 * on the host's init.defaultBranch.
 */
describe("positionBranch / restoreCheckoutState (real git repos)", { timeout: 30_000 }, () => {
  const initRepo = (name: string, bare = false, autocrlf = false) => {
    const dir = path.join(root, name);
    gitOrThrow(root, ["init", ...(bare ? ["--bare"] : []), "-b", "main", dir]);
    if (!bare) {
      // Repo-local identity — positionBranch's internal `git rebase` reads
      // ambient committer config, which a `useConfigOnly` runner may not set.
      gitOrThrow(dir, ["config", "user.name", "T"]);
      gitOrThrow(dir, ["config", "user.email", "t@t"]);
      // Fixture checkout bytes must not depend on the host's line-ending policy.
      gitOrThrow(dir, ["config", "core.autocrlf", String(autocrlf)]);
      gitOrThrow(dir, ["config", "core.eol", "lf"]);
    }
    return dir;
  };

  const commitFile = (dir: string, name: string, content: string, subject: string) => {
    writeFileSync(path.join(dir, name), content);
    gitOrThrow(dir, ["add", name]);
    gitOrThrow(dir, ["-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-m", subject]);
  };

  /** Wire `dir` to a fresh bare `origin` and fetch (empty remote → no refs). */
  const addOrigin = (dir: string, remoteName = "remote.git") => {
    const remote = initRepo(remoteName, true);
    gitOrThrow(dir, ["remote", "add", "origin", remote]);
    gitOrThrow(dir, ["fetch", "-q", "origin"]);
    return remote;
  };

  /** Advance `main` on the bare remote from a scratch clone, then fetch in `dir`. */
  const pushRemote = (remote: string, dir: string, name: string, file: string, subject: string) => {
    const upstream = path.join(root, name);
    gitOrThrow(root, ["clone", remote, upstream]);
    gitOrThrow(upstream, ["config", "user.name", "T"]);
    gitOrThrow(upstream, ["config", "user.email", "t@t"]);
    gitOrThrow(upstream, ["config", "core.autocrlf", "false"]);
    gitOrThrow(upstream, ["config", "core.eol", "lf"]);
    commitFile(upstream, file, `${subject}\n`, subject);
    gitOrThrow(upstream, ["push", "-q", "origin", "main"]);
    gitOrThrow(dir, ["fetch", "-q", "origin"]);
  };

  it("replays local commits on top of the remote tip instead of discarding them", () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    const remote = addOrigin(work);
    gitOrThrow(work, ["push", "-q", "origin", "main"]);
    gitOrThrow(work, ["fetch", "-q", "origin"]);
    // A sync commit whose earlier push failed — local-only.
    commitFile(work, "b.txt", "sync\n", "chore: sync from supastack@abc1234");
    pushRemote(remote, work, "upstream", "c.txt", "remote commit");

    expect(positionBranch(work, "main", {})).toBe(true);
    expect(listGit(work, ["log", "--format=%s"])).toEqual([
      "chore: sync from supastack@abc1234",
      "remote commit",
      "base",
    ]);
    expect(runGit(work, ["merge-base", "--is-ancestor", "origin/main", "HEAD"]).ok).toBe(true);
    expect(git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"])).toBe("main");
  });

  it.each([
    { autocrlf: false, lineEnding: "\n" },
    { autocrlf: true, lineEnding: "\r\n" },
  ])("restores a conflicting rebase with core.autocrlf=$autocrlf", ({ autocrlf, lineEnding }) => {
    const work = initRepo("work", false, autocrlf);
    commitFile(work, "a.txt", "base\n", "base");
    const remote = addOrigin(work);
    gitOrThrow(work, ["push", "-q", "origin", "main"]);
    gitOrThrow(work, ["fetch", "-q", "origin"]);
    // Local and remote both edit a.txt → guaranteed rebase conflict.
    commitFile(work, "a.txt", "local\n", "chore: sync from supastack@abc1234");
    const before = captureCheckoutState(work, "main");
    pushRemote(remote, work, "upstream", "a.txt", "remote edit");

    const warnings: string[] = [];
    expect(positionBranch(work, "main", { warn: (m: unknown) => warnings.push(String(m)) })).toBe(
      false,
    );
    expect(warnings.join("\n")).toMatch(/rebase/i);
    // Refs + checkout position restored to the pre-call state.
    expect(captureCheckoutState(work, "main")).toEqual(before);
    // No rebase in progress; tracked files match the restored HEAD.
    expect(existsSync(path.join(work, ".git", "REBASE_HEAD"))).toBe(false);
    expect(listGit(work, ["status", "--porcelain"])).toEqual([]);
    expect(readFileSync(path.join(work, "a.txt"), "utf8")).toBe(`local${lineEnding}`);
  });

  it("keeps local commits when origin/<branch> does not exist", () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    commitFile(work, "b.txt", "sync\n", "chore: sync from supastack@abc1234");
    addOrigin(work); // configured remote, but it has no branches yet

    expect(positionBranch(work, "main", {})).toBe(true);
    expect(listGit(work, ["log", "--format=%s"])).toEqual([
      "chore: sync from supastack@abc1234",
      "base",
    ]);
    expect(git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"])).toBe("main");
  });

  it("fast-forwards cleanly when HEAD is already an ancestor of the remote tip", () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    const remote = addOrigin(work);
    gitOrThrow(work, ["push", "-q", "origin", "main"]);
    gitOrThrow(work, ["fetch", "-q", "origin"]);
    pushRemote(remote, work, "upstream", "b.txt", "remote commit");

    expect(positionBranch(work, "main", {})).toBe(true);
    expect(git(work, ["rev-parse", "HEAD"])).toBe(git(work, ["rev-parse", "origin/main"]));
    expect(listGit(work, ["log", "--format=%s"])).toEqual(["remote commit", "base"]);
  });

  it("restoreCheckoutState puts back the branch ref and a different checked-out branch", () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    gitOrThrow(work, ["checkout", "-q", "-b", "feature"]);
    commitFile(work, "f.txt", "feat\n", "feature work");
    const state = captureCheckoutState(work, "main");
    expect(state.headBranch).toBe("feature");

    // Simulate positioning moving refs/heads/main and HEAD away.
    gitOrThrow(work, ["checkout", "-f", "-B", "main", "HEAD"]);
    restoreCheckoutState(work, "main", state, {});

    expect(git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"])).toBe("feature");
    expect(git(work, ["rev-parse", "HEAD"])).toBe(state.headSha);
    expect(git(work, ["rev-parse", "refs/heads/main"])).toBe(state.branchSha);
    expect(listGit(work, ["status", "--porcelain"])).toEqual([]);
  });

  it("restoreCheckoutState restores a detached HEAD and drops a created branch ref", () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    commitFile(work, "b.txt", "next\n", "next");
    const detached = git(work, ["rev-parse", "HEAD~1"]);
    gitOrThrow(work, ["checkout", "-q", "--detach", detached]);
    const state = captureCheckoutState(work, "topic"); // topic does not exist yet
    expect(state).toEqual({ headSha: detached, headBranch: null, branchSha: null });

    gitOrThrow(work, ["checkout", "-f", "-B", "topic", "HEAD"]);
    restoreCheckoutState(work, "topic", state, {});

    expect(git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"])).toBeNull();
    expect(git(work, ["rev-parse", "HEAD"])).toBe(detached);
    expect(git(work, ["rev-parse", "--quiet", "--verify", "refs/heads/topic"])).toBeNull();
    expect(listGit(work, ["status", "--porcelain"])).toEqual([]);
  });

  it("restoreDryRunSibling leaves refs, tracked files and index identical on a no-change dry-run", async () => {
    const work = initRepo("work");
    commitFile(work, "a.txt", "base\n", "base");
    const remote = addOrigin(work);
    gitOrThrow(work, ["push", "-q", "origin", "main"]);
    gitOrThrow(work, ["fetch", "-q", "origin"]);
    commitFile(work, "b.txt", "sync\n", "chore: sync from supastack@abc1234");
    const before = captureCheckoutState(work, "main");
    pushRemote(remote, work, "upstream", "c.txt", "remote commit");

    // Positioning rebases the local sync commit onto the remote tip — this
    // already moves refs even though the eventual staged diff is empty.
    expect(positionBranch(work, "main", {})).toBe(true);
    const prevTracked = new Set(listGit(work, ["ls-files"]));
    // Mirror-like writes for a no-change run: identical content for a tracked
    // file plus a new synced file that was not previously tracked; a foreign
    // untracked file stands in for user scratch and must survive the restore.
    writeFileSync(path.join(work, "a.txt"), "base\n");
    writeFileSync(path.join(work, "synced-new.txt"), "synced\n");
    writeFileSync(path.join(work, "notes.txt"), "foreign\n");
    gitOrThrow(work, ["add", "-u"]);

    await restoreDryRunSibling(work, "main", before, {
      files: new Set(["synced-new.txt"]),
      prevTracked,
    });

    expect(captureCheckoutState(work, "main")).toEqual(before);
    expect(readFileSync(path.join(work, "a.txt"), "utf8")).toBe("base\n");
    expect(existsSync(path.join(work, "synced-new.txt"))).toBe(false);
    expect(existsSync(path.join(work, "notes.txt"))).toBe(true);
    // Only the foreign untracked file remains; nothing staged.
    expect(listGit(work, ["status", "--porcelain"])).toEqual(["?? notes.txt"]);
    expect(listGit(work, ["diff", "--cached", "--name-only"])).toEqual([]);
  });

  it("restoreCheckoutState returns a fresh checkout to its unborn branch", () => {
    const work = initRepo("work"); // unborn HEAD on main, no commits
    const remote = addOrigin(work);
    pushRemote(remote, work, "upstream", "a.txt", "remote commit");
    const state = captureCheckoutState(work, "main");
    expect(state).toEqual({ headSha: null, headBranch: "main", branchSha: null });

    // Unborn HEAD + remote tip → the old -B origin/<branch> path creates the ref.
    expect(positionBranch(work, "main", {})).toBe(true);
    expect(git(work, ["rev-parse", "--quiet", "--verify", "refs/heads/main"])).not.toBeNull();

    restoreCheckoutState(work, "main", state, {});
    expect(git(work, ["rev-parse", "--quiet", "--verify", "refs/heads/main"])).toBeNull();
    expect(git(work, ["symbolic-ref", "--quiet", "--short", "HEAD"])).toBe("main");
    expect(git(work, ["rev-parse", "--quiet", "--verify", "HEAD"])).toBeNull();
  });
});

/**
 * applyShippedIgnoreRules — syncRepo's second ignore pass — must evaluate
 * the .gitignore rules the sync is about to ship, not the checkout's
 * previous revision: a stale `.ai/` rule there dropped every mirror doc
 * from `files` before mirror() could write the new .gitignore. Real
 * `git init` fixtures — check-ignore reads the worktree's .gitignore
 * files, no commits needed. `core.excludesFile` is pinned empty so a
 * host-level global ignore cannot skew the fixtures.
 */
describe("applyShippedIgnoreRules (real git repos)", { timeout: 30_000 }, () => {
  const initCheckout = async (name: string, oldGitignore: string) => {
    const work = path.join(root, name);
    gitOrThrow(root, ["init", "-b", "main", work]);
    gitOrThrow(work, ["config", "core.excludesFile", path.join(work, ".git", "no-excludes")]);
    await writeFile(path.join(work, ".gitignore"), oldGitignore);
    return work;
  };

  it("evaluates the shipped .gitignore, not the checkout's stale revision", async () => {
    const source = path.join(root, "monorepo");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, ".gitignore"), "node_modules/\n");

    // The checkout still carries the previous revision where .ai/ was ignored.
    const work = await initCheckout("checkout", "node_modules/\n.ai/\n");
    const files = new Set([
      ".gitignore",
      ".ai/apps/web/src/index.md",
      "node_modules/x/index.js",
      "apps/web/src/index.ts",
    ]);

    // Fixture validity: the stale rules alone would still drop the .ai
    // doc — exactly the ordering bug this regression pins.
    expect(ignoredPaths(work, files).has(".ai/apps/web/src/index.md")).toBe(true);

    const dropped = await applyShippedIgnoreRules(work, files, { root: source });

    // Incoming rules keep the .ai mirror yet still drop ignored paths.
    expect(dropped.has(".ai/apps/web/src/index.md")).toBe(false);
    expect(files.has(".ai/apps/web/src/index.md")).toBe(true);
    expect(dropped.has("node_modules/x/index.js")).toBe(true);
    expect(files.has("node_modules/x/index.js")).toBe(false);
    expect(files.has("apps/web/src/index.ts")).toBe(true);
    // The shipped .gitignore was pre-written into the checkout first.
    expect(readFileSync(path.join(work, ".gitignore"), "utf8")).toBe("node_modules/\n");
  });

  it("pre-writes nested .gitignore files the manifest ships", async () => {
    const source = path.join(root, "monorepo");
    await mkdir(path.join(source, "apps/desktop/src-tauri"), { recursive: true });
    await writeFile(path.join(source, ".gitignore"), "node_modules/\n");
    await writeFile(path.join(source, "apps/desktop/src-tauri/.gitignore"), "/target\n");

    // The checkout's nested .gitignore still has the old /gen rule.
    const work = await initCheckout("checkout", "node_modules/\n");
    await mkdir(path.join(work, "apps/desktop/src-tauri"), { recursive: true });
    await writeFile(path.join(work, "apps/desktop/src-tauri/.gitignore"), "/target\n/gen\n");

    const files = new Set([
      ".gitignore",
      "apps/desktop/src-tauri/.gitignore",
      "apps/desktop/src-tauri/gen/schemas/capabilities.json",
      "apps/desktop/src-tauri/target/bin",
      "apps/desktop/src-tauri/src/lib.rs",
    ]);

    const dropped = await applyShippedIgnoreRules(work, files, { root: source });

    expect(dropped.has("apps/desktop/src-tauri/gen/schemas/capabilities.json")).toBe(false);
    expect(files.has("apps/desktop/src-tauri/gen/schemas/capabilities.json")).toBe(true);
    expect(dropped.has("apps/desktop/src-tauri/target/bin")).toBe(true);
    expect(files.has("apps/desktop/src-tauri/target/bin")).toBe(false);
    expect(files.has("apps/desktop/src-tauri/src/lib.rs")).toBe(true);
    expect(readFileSync(path.join(work, "apps/desktop/src-tauri/.gitignore"), "utf8")).toBe(
      "/target\n",
    );
  });

  it("falls back to the checkout's own rules when no .gitignore ships", async () => {
    const source = path.join(root, "monorepo");
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, ".gitignore"), "node_modules/\n");

    const work = await initCheckout("checkout", "node_modules/\n.ai/\n");
    const files = new Set([".ai/apps/web/src/index.md", "apps/web/src/index.ts"]);

    const dropped = await applyShippedIgnoreRules(work, files, { root: source });

    // Nothing ships a replacement, so the checkout's stale rules still
    // decide — and its .gitignore is left untouched.
    expect(dropped.has(".ai/apps/web/src/index.md")).toBe(true);
    expect(files.has(".ai/apps/web/src/index.md")).toBe(false);
    expect(readFileSync(path.join(work, ".gitignore"), "utf8")).toBe("node_modules/\n.ai/\n");
  });
});

/**
 * Shipped-text honesty guards, run against the real manifests: docs and
 * prompts ship verbatim, so any `pnpm <name>` they name must exist in that
 * repo's generated package.json, and any `scripts/*.mjs` path they name must
 * be in the manifest — dangling references are the bug class that produced
 * the supabase:doctor / .devin/wiki.json gates above.
 */
describe("shipped-text consistency (real manifests)", { timeout: 60_000 }, () => {
  const repoRoot = realRepoRoot;
  const config = { repos: realRepoSpecs };
  const rootPkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const agentsMd = readRealSource("AGENTS.md");
  const envExample = readRealSource(".env.example");
  // mirror() only writes `.devin/wiki.json` when the monorepo has a source
  // wiki — the generated llms.txt gets the file in its link set only then.
  const wikiExists = existsSync(path.join(repoRoot, ".devin", "wiki.json"));

  // Runnable without a generated scripts entry: pnpm builtins (install,
  // create, dlx, exec…) plus node_modules/.bin passthroughs pnpm resolves
  // from devDependencies (vitest, turbo, eslint…).
  const PNPM_BUILTINS = new Set([
    "add",
    "approve-builds",
    "audit",
    "bin",
    "cache",
    "cat-file",
    "cat-index",
    "config",
    "create",
    "dedupe",
    "deploy",
    "dlx",
    "doctor",
    "env",
    "exec",
    "fetch",
    "find-hash",
    "help",
    "i",
    "ignored-builds",
    "import",
    "info",
    "init",
    "install",
    "install-test",
    "licenses",
    "link",
    "ll",
    "ln",
    "ls",
    "outdated",
    "pack",
    "patch",
    "patch-commit",
    "patch-remove",
    "prune",
    "publish",
    "rb",
    "rebuild",
    "remove",
    "rm",
    "root",
    "search",
    "self-update",
    "server",
    "setup",
    "show",
    "store",
    "un",
    "unlink",
    "up",
    "update",
    "version",
    "view",
    "why",
  ]);
  const PNPM_BINARIES = new Set([
    "changeset",
    "drizzle-kit",
    "eas",
    "eslint",
    "expo",
    "jest",
    "next",
    "playwright",
    "prettier",
    "supabase",
    "tailwind",
    "tauri",
    "tsc",
    "tsx",
    "turbo",
    "vitest",
  ]);

  // TODO(doc debt): shipped docs still name these monorepo-only gates —
  // Playwright suites and the unshipped vitest.real.config.ts can never run
  // downstream, so the scripts deliberately stay out of the manifests and
  // the doc wording is owned outside the sync pipeline. The assertion is an
  // exact match in both directions: a NEW dangling command fails, and so
  // does a stale entry once the docs stop referencing it.
  const KNOWN_UNSHIPPED_COMMANDS: Record<string, string[]> = {
    "supastack-desktop": ["verify:local"],
    "supastack-mobile": ["verify:local"],
    "supastack-web": ["smoke:providers", "test:e2e:production", "verify:local"],
  };

  // TODO(doc debt): shipped docs also run these commands through pnpm's
  // `--filter` workspace syntax or name monorepo-only gates inline — valid
  // in the monorepo but not in a standalone checkout. Lines that name the
  // owning repo (`supastack-web` / `web checkout` / `web repo`) are exempt;
  // every other reference must appear here, and a stale entry fails once a
  // line is rewritten or the doc stops shipping.
  const KNOWN_UNSHIPPED_REFERENCES: Record<string, string[]> = {
    "supastack-desktop": [
      "docs/deployment.md :: --filter @supastack/db",
      "docs/upgrading.md :: pnpm verify:local",
    ],
    "supastack-mobile": [
      "docs/deployment.md :: --filter @supastack/db",
      "docs/upgrading.md :: pnpm verify:local",
    ],
    "supastack-web": [
      "docs/agent-setup.md :: --filter @supastack/db",
      "docs/agent-setup.md :: --filter @supastack/web",
      "docs/agent-setup.md :: pnpm supabase:doctor",
      "docs/agent-setup.md :: pnpm supabase:provision",
      "docs/deployment.md :: --filter @supastack/db",
      "docs/production-ai-runtime.md :: --filter @supastack/web",
      "docs/production-ai-runtime.md :: pnpm test:e2e:production",
      "docs/production-ai-runtime.md :: pnpm verify:local",
      "docs/real-provider-smoke.md :: pnpm smoke:providers",
      "docs/real-provider-smoke.md :: pnpm verify:local",
      "docs/upgrading.md :: pnpm verify:local",
      "docs/vps-coolify.md :: --filter @supastack/db",
      "docs/vps-coolify.md :: --filter @supastack/web",
      "prompts/agent-setup.md :: pnpm supabase:doctor",
    ],
  };

  // TODO(translation debt): these PRE-EXISTING shipped `.ai` mirrors contain
  // Han prose and need English translations — remove entries as files are
  // translated. Any shipped mirror absent from this list must render
  // Han-free, so the test still fails on a new offender.
  const KNOWN_HAN_MIRRORS: Record<string, string[]> = {
    "supastack-desktop": [".ai/PROJECT_CONTEXT.md", ".ai/docs/deployment.md"],
    "supastack-mobile": [
      ".ai/PROJECT_CONTEXT.md",
      ".ai/apps/mobile/src/feature-board/client.md",
      ".ai/apps/mobile/src/feature-board/presentation.md",
      ".ai/docs/deployment.md",
    ],
    "supastack-web": [
      ".ai/PROJECT_CONTEXT.md",
      ".ai/apps/web/app/[locale]/page.md",
      ".ai/apps/web/app/admin/waitlist/page.md",
      ".ai/apps/web/app/api/mobile/api-keys/[keyId]/route.md",
      ".ai/apps/web/app/api/mobile/api-keys/route.md",
      ".ai/apps/web/app/api/mobile/audit/route.md",
      ".ai/apps/web/app/api/mobile/domains/[domainId]/refresh/route.md",
      ".ai/apps/web/app/api/mobile/domains/[domainId]/route.md",
      ".ai/apps/web/app/api/mobile/domains/route.md",
      ".ai/apps/web/app/api/mobile/invitations/[invitationId]/resend/route.md",
      ".ai/apps/web/app/api/mobile/invitations/[invitationId]/route.md",
      ".ai/apps/web/app/api/mobile/invitations/accept/route.md",
      ".ai/apps/web/app/api/mobile/invitations/route.md",
      ".ai/apps/web/app/api/mobile/members/[userId]/route.md",
      ".ai/apps/web/app/api/mobile/members/leave/route.md",
      ".ai/apps/web/app/api/mobile/organization/route.md",
      ".ai/apps/web/app/api/mobile/schedules/[scheduleId]/route.md",
      ".ai/apps/web/app/api/mobile/schedules/route.md",
      ".ai/apps/web/app/api/mobile/webhooks/[endpointId]/deliveries/route.md",
      ".ai/apps/web/app/api/mobile/webhooks/[endpointId]/ping/route.md",
      ".ai/apps/web/app/api/mobile/webhooks/[endpointId]/route.md",
      ".ai/apps/web/app/api/mobile/webhooks/route.md",
      ".ai/apps/web/app/api/notifications/route.md",
      ".ai/apps/web/app/blog/[slug]/page.md",
      ".ai/apps/web/app/kit-blocks/page.md",
      ".ai/apps/web/app/page.md",
      ".ai/apps/web/app/robots.md",
      ".ai/apps/web/app/sitemap.md",
      ".ai/apps/web/proxy.md",
      ".ai/apps/web/src/auth-server.md",
      ".ai/apps/web/src/data-export.md",
      ".ai/apps/web/src/feature-board-actions.md",
      ".ai/apps/web/src/feature-board-store.md",
      ".ai/apps/web/src/feature-board.md",
      ".ai/apps/web/src/growth/early-access.md",
      ".ai/apps/web/src/growth/early-access.test.md",
      ".ai/apps/web/src/growth/growth-cookies.md",
      ".ai/apps/web/src/growth/growth-cookies.test.md",
      ".ai/apps/web/src/growth/growth-store.md",
      ".ai/apps/web/src/growth/waitlist-actions.md",
      ".ai/apps/web/src/growth/waitlist-queries.md",
      ".ai/apps/web/src/growth/waitlist-service.md",
      ".ai/apps/web/src/growth/waitlist-service.test.md",
      ".ai/apps/web/src/growth/waitlist.md",
      ".ai/apps/web/src/growth/waitlist.test.md",
      ".ai/apps/web/src/i18n-proxy.test.md",
      ".ai/apps/web/src/marketing/public-routes-dynamic.test.md",
      ".ai/apps/web/src/marketing/site-config.md",
      ".ai/apps/web/src/marketing/site-header.md",
      ".ai/apps/web/src/marketing/social-metadata.test.md",
      ".ai/apps/web/src/mobile-feature-board-bff.md",
      ".ai/apps/web/src/mobile-feature-board.md",
      ".ai/apps/web/src/mobile-organization-bff.md",
      ".ai/apps/web/src/mobile-organization-bff.test.md",
      ".ai/apps/web/src/mobile-organization.md",
      ".ai/apps/web/src/mobile-workspace-context.md",
      ".ai/apps/web/src/web-feature-board-page.md",
      ".ai/apps/web/src/webhook-events.md",
      ".ai/apps/web/src/workspace-access.md",
      ".ai/docs/custom-billing-adapter.md",
      ".ai/docs/deployment.md",
      ".ai/docs/vps-coolify.md",
      ".ai/packages/auth/src/auth-signup.integration.test.md",
      ".ai/packages/auth/src/drizzle-schema.test.md",
      ".ai/packages/auth/src/server.test.md",
      ".ai/packages/db/drizzle/0001_far_luke_cage.md",
      ".ai/packages/db/drizzle/0004_luxuriant_switch.md",
      ".ai/packages/db/src/audit.md",
      ".ai/packages/db/src/migration-artifacts.test.md",
      ".ai/packages/db/src/schema.md",
      ".ai/packages/db/src/schema.test.md",
      ".ai/packages/i18n/src/index.md",
    ],
  };

  /** Command references are code-formatted: inline `…` spans and fenced
   * blocks. Scanning only those keeps prose mentions ("the pnpm shim",
   * "pnpm is pinned") from counting as commands. */
  const codeSpans = (text: string) => {
    const chunks: string[] = [];
    for (const m of text.matchAll(/```[^\n]*\n[\s\S]*?```/g)) chunks.push(m[0]);
    for (const m of text.matchAll(/`[^`\n]+`/g)) chunks.push(m[0]);
    return chunks.join("\n");
  };

  /** `pnpm <name>` / `pnpm run <name>` invocations inside code spans. The
   * `--filter <pkg> <script>` form targets a workspace package's own
   * script — a different namespace than the generated root manifest this
   * test pins — so filtered invocations are skipped entirely. */
  const pnpmCommandRefs = (text: string) => {
    const names = new Set<string>();
    for (const m of text.matchAll(/pnpm\s+(?:(--filter)\s+\S+|run\s+)?([a-z][a-z0-9:_-]*)/g)) {
      if (m[1] === undefined) names.add(m[2]);
    }
    return names;
  };

  const scriptPathRefs = (text: string) =>
    new Set([...text.matchAll(/(?<![\w/.-])scripts\/[\w.-]+\.mjs\b/g)].map((m) => m[0]));

  /** The doc sources a buyer sees: shipped docs/prompts verbatim, plus the
   * generated/rendered root files. */
  const shippedTextSources = async (spec: { app: string; name: string }) => {
    const files = await realManifest(spec);
    const sources = new Map<string, string>();
    for (const f of files) {
      if (/^(?:docs|prompts)\/.*\.md$/.test(f)) {
        sources.set(f, readRealSource(f));
      }
    }
    const llmsFiles = wikiExists ? [...files, ".devin/wiki.json"] : files;
    sources.set("<generated llms.txt>", renderLlmsTxt(spec, llmsFiles));
    sources.set("<generated README.md>", renderReadme(spec));
    sources.set("<rendered AGENTS.md>", renderAgentsMd(agentsMd));
    sources.set("<rendered .env.example>", renderEnvExample(envExample));
    return { files, sources };
  };

  it("every `pnpm <name>` command in shipped text exists in that repo's generated scripts", async () => {
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const scripts = new Set(
        Object.keys(renderRootPackageJson(rootPkg, spec, files).scripts ?? {}),
      );
      const { sources } = await shippedTextSources(spec);
      const dangling = new Map<string, string[]>();
      for (const [where, text] of sources) {
        // Native maps may explain that backend setup commands live in the
        // supastack-web checkout. Remove those explicitly qualified lines
        // before extracting code spans; web still validates every command.
        const commandText =
          spec.app === "apps/web"
            ? text
            : text
                .split(/\r?\n/)
                .filter((line) => !/supastack-web checkout/i.test(line))
                .join("\n");
        for (const name of pnpmCommandRefs(codeSpans(commandText))) {
          if (scripts.has(name) || PNPM_BUILTINS.has(name) || PNPM_BINARIES.has(name)) continue;
          dangling.set(name, [...(dangling.get(name) ?? []), where]);
        }
      }
      const found = [...dangling.keys()].sort();
      const detail = [...dangling]
        .map(([name, where]) => `${name} (${where.join(", ")})`)
        .join("; ");
      expect(found, `${spec.name}: ${detail}`).toEqual(
        [...(KNOWN_UNSHIPPED_COMMANDS[spec.name] ?? [])].sort(),
      );
    }
  });

  it("every `scripts/*.mjs` path named in shipped text is in the manifest", async () => {
    for (const spec of config.repos) {
      const { files, sources } = await shippedTextSources(spec);
      const shipped = new Set([...files, ...GENERATED]);
      for (const [where, text] of sources) {
        for (const ref of scriptPathRefs(text)) {
          expect(shipped.has(ref), `${spec.name}: ${ref} referenced by ${where}`).toBe(true);
        }
      }
    }
  });

  it("shipped .ai mirrors render Han-free beyond the known pre-existing set", async () => {
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const offenders: string[] = [];
      for (const f of files) {
        if (!f.startsWith(".ai/")) continue;
        const scrubbed = renderRealAiMirror(f);
        if (scrubbed !== null && /\p{Script=Han}/u.test(scrubbed)) offenders.push(f);
      }
      expect(offenders.sort(), spec.name).toEqual([...(KNOWN_HAN_MIRRORS[spec.name] ?? [])].sort());
    }
  });

  it("annotates every docs/prompts link in the generated llms.txt", async () => {
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const llmsFiles = wikiExists ? [...files, ".devin/wiki.json"] : files;
      const llms = renderLlmsTxt(spec, llmsFiles);
      for (const line of llms.split("\n")) {
        if (!/\]\((?:docs|prompts)\//.test(line)) continue;
        // The every-link-annotated convention: `- [Label](path): note`.
        expect(line, `${spec.name}: ${line}`).toMatch(/\]\((?:docs|prompts)\/[^)]*\)\s*:/);
      }
    }
  });

  it("every relative link in shipped docs resolves into that flavor's manifest", async () => {
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const shipped = new Set([...files, ...GENERATED]);
      const dead: string[] = [];
      for (const f of files) {
        if (!/^(?:docs|prompts)\/.*\.md$/.test(f)) continue;
        const dir = path.posix.dirname(f);
        const text = readRealSource(f);
        for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
          const target = m[1].split("#")[0].split("?")[0];
          if (target === "") continue; // anchor-only link stays in this file
          if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")) continue; // external
          if (target.startsWith("/")) continue; // leading-slash links are product routes, not repo paths
          const resolved = target.startsWith("/")
            ? path.posix.normalize(target.slice(1))
            : path.posix.normalize(path.posix.join(dir, target));
          if (!shipped.has(resolved)) dead.push(`${f} -> ${m[1]}`);
        }
      }
      expect(dead, `${spec.name}: ${dead.join("; ")}`).toEqual([]);
    }
  });

  it("ships and indexes the shared security checklist for every platform", async () => {
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      expect(files, spec.name).toContain("docs/agent-security.md");
      const llmsFiles = wikiExists ? [...files, ".devin/wiki.json"] : files;
      const llms = renderLlmsTxt(spec, llmsFiles);
      expect(llms, spec.name).toContain("[Agent security](docs/agent-security.md)");
      if (spec.app !== "apps/web") {
        expect(llms, spec.name).toContain("supastack-web checkout");
        expect(llms, spec.name).not.toContain("(packages/auth/src/index.ts)");
        expect(llms, spec.name).not.toContain("(packages/db/src/schema.ts)");
        expect(llms, spec.name).not.toContain("(packages/observability/src/index.ts)");
      } else {
        expect(llms, spec.name).toContain("(packages/auth/src/index.ts)");
        expect(llms, spec.name).toContain("(packages/db/src/schema.ts)");
        expect(llms, spec.name).toContain("(packages/observability/src/index.ts)");
        expect(llms, spec.name).toContain("(scripts/supabase-doctor.mjs)");
      }
    }
  });

  it("ships the environment bootstrap helper only with the web checkout", async () => {
    const webSpec = config.repos.find((spec) => spec.name === "supastack-web")!;
    const webFiles = await realManifest(webSpec);
    expect(webFiles).toContain("scripts/setup-env.mjs");
    const webLlms = renderLlmsTxt(webSpec, webFiles);
    expect(webLlms).toContain("[Environment setup helper](scripts/setup-env.mjs)");

    for (const spec of config.repos.filter((entry) => entry.app !== "apps/web")) {
      const files = await realManifest(spec);
      expect(files, spec.name).not.toContain("scripts/setup-env.mjs");
      expect(renderLlmsTxt(spec, files), spec.name).not.toContain("scripts/setup-env.mjs");
    }
  });

  it("ships the guided setup wizard only with the web checkout", async () => {
    const webSpec = config.repos.find((spec) => spec.name === "supastack-web")!;
    const webFiles = await realManifest(webSpec);
    expect(webFiles).toContain("scripts/setup.mjs");
    expect(webFiles).toContain(".ai/scripts/setup.mjs.md");
    expect(renderLlmsTxt(webSpec, webFiles)).toContain("[Guided setup wizard](scripts/setup.mjs)");

    for (const spec of config.repos.filter((entry) => entry.app !== "apps/web")) {
      const files = await realManifest(spec);
      const llms = renderLlmsTxt(spec, files);
      expect(files, spec.name).not.toContain("scripts/setup.mjs");
      expect(files, spec.name).not.toContain(".ai/scripts/setup.mjs.md");
      expect(llms, spec.name).not.toContain("scripts/setup.mjs");
    }
  });

  it("shipped docs invoke monorepo-only commands only on repo-qualified lines", async () => {
    const MONOREPO_COMMAND_REF =
      /--filter[= ]@supastack\/(?:web|db)\b|pnpm\s+(?:verify:[\w:]+|test:e2e[\w:-]*|smoke:providers|supabase:[\w-]+)/g;
    const REPO_QUALIFIED_LINE = /supastack-web|web checkout|web repo/;
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const debt = new Set<string>();
      for (const f of files) {
        if (!/^(?:docs|prompts)\/.*\.md$/.test(f)) continue;
        for (const line of readRealSource(f).split("\n")) {
          if (REPO_QUALIFIED_LINE.test(line)) continue;
          for (const m of line.matchAll(MONOREPO_COMMAND_REF)) debt.add(`${f} :: ${m[0]}`);
        }
      }
      expect([...debt].sort(), spec.name).toEqual(
        [...(KNOWN_UNSHIPPED_REFERENCES[spec.name] ?? [])].sort(),
      );
    }
  });

  it("rendered .ai mirrors carry no internal provenance tokens", async () => {
    const PROVENANCE =
      /Supastack-dev|Learnmore|kit-upstream|codex\/|feat\/|origin\/devin|docs\/superpowers|\.impeccable|sibling checkout|all 4 repos/;
    for (const spec of config.repos) {
      const files = await realManifest(spec);
      const offenders: string[] = [];
      for (const f of files) {
        if (!f.startsWith(".ai/")) continue;
        const scrubbed = renderRealAiMirror(f);
        if (scrubbed !== null && PROVENANCE.test(scrubbed)) offenders.push(f);
      }
      expect(offenders.sort(), spec.name).toEqual([]);
    }
  });
});
