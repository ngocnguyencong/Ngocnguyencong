import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const aiDir = path.join(repoRoot, ".ai");

/**
 * `.ai/` mirror docs are repo-scoped: they describe this repository only and
 * must never reference other repositories, private products, or
 * maintainer-only checkouts. The sub-repo sync also scrubs these terms in
 * transit, but the source docs stay clean so the memory tree is safe to
 * publish/fork as-is. `supastack-dev`, `learnmore` (the private GitHub orgs
 * the upstream repos live under) and `kit-upstream` (the private remote name
 * once hardcoded into shipped guide copy) are banned for the same reason.
 */
const BANNED_TERM =
  /starterkit|vorlee|fklearn|supastack-site|supastarter|supastack-kit|supastack-dev|learnmore|kit-upstream|seller|storefront|\.\.\/(starterkit|supastack)|dev-01/i;

function walkFiles(dir: string, extension: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, extension));
    } else if (entry.isFile() && extension.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function bannedTermsIn(dir: string, extension: RegExp): string[] {
  const offenders: string[] = [];
  const globalBan = new RegExp(BANNED_TERM.source, "gi");
  for (const file of walkFiles(dir, extension)) {
    const text = readFileSync(file, "utf8");
    const terms = [...new Set([...text.matchAll(globalBan)].map((m) => m[0].toLowerCase()))];
    if (terms.length > 0) {
      offenders.push(`${path.relative(repoRoot, file)} — ${terms.join(", ")}`);
    }
  }
  return offenders;
}

describe(".ai mirror docs", () => {
  it("has the entry docs", () => {
    expect(existsSync(path.join(aiDir, "PROJECT_CONTEXT.md"))).toBe(true);
    expect(existsSync(path.join(aiDir, "AGENTS.md"))).toBe(true);
  });

  it(
    "stays repo-scoped — no banned cross-repo or maintainer-only terms",
    { timeout: 30000 },
    () => {
      const offenders = bannedTermsIn(aiDir, /\.md$/);
      expect(offenders, offenders.join("\n")).toEqual([]);
    },
  );
});

/**
 * The in-app docs catalog (`apps/web/src/resources/**` — guide sources plus
 * the aligned translation JSONs) ships verbatim into every buyer checkout.
 * It must carry the same banned-term guarantee as `.ai/`: a private org URL
 * once shipped verbatim in the `web/upgrading` guide and its de/es/fr
 * translations, so this scan pins the boundary at the source.
 */
describe("shipped buyer-facing resources", () => {
  const resourcesDir = path.join(repoRoot, "apps", "web", "src", "resources");

  it(
    "stays buyer-clean — no private-org, cross-repo or maintainer-only terms",
    { timeout: 30000 },
    () => {
      const offenders = bannedTermsIn(resourcesDir, /\.(?:tsx?|json)$/);
      expect(offenders, offenders.join("\n")).toEqual([]);
    },
  );
});
