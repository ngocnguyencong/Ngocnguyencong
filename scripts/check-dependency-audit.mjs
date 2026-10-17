import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import console from "node:console";

const root = fileURLToPath(new URL("../", import.meta.url));
const backports = [
  {
    advisory: "GHSA-86w9-cpqp-85rv",
    package: "node-forge",
    version: "1.4.0",
    hash: "b7c83f1048de1fed7b79ea126641c8d7cd7a27fed66c77062e9a92b8b9e01800",
  },
  {
    advisory: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    version: "3.0.3",
    hash: "932c0dc42e7f47b87d62312f261993904690f6e5b6b8b4ac0c7acbebdd54ec29",
  },
  {
    advisory: "GHSA-vcc3-ghjq-m6fr",
    package: "decode-uri-component",
    version: "0.2.2",
    hash: "d65d5127eadcd58c09235253bddbc3a3d9108d19db6c6408a2de994a33d6d6ac",
  },
];

function mapping(text) {
  const section = /^patchedDependencies:\r?\n((?: {2}[^\r\n]+\r?\n?)+)/m.exec(text)?.[1];
  return new Map(
    (section ?? "").split(/\r?\n/).flatMap((line) => {
      const match = /^ {2}([^:]+): ([^\s]+)$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
}

/** Only reviewed bytes bound by both pnpm declarations count as a backport. */
export function verifyBackports(read = readFileSync) {
  const verified = new Set();
  let workspace, lock;
  try {
    workspace = mapping(read(path.join(root, "pnpm-workspace.yaml"), "utf8"));
    lock = mapping(read(path.join(root, "pnpm-lock.yaml"), "utf8"));
  } catch {
    return verified;
  }
  for (const item of backports) {
    const identity = `${item.package}@${item.version}`;
    const patch = `patches/${identity}.patch`;
    try {
      const bytes = read(path.join(root, patch), "utf8");
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hash === item.hash && workspace.get(identity) === patch && lock.get(identity) === hash)
        verified.add(item.advisory);
    } catch {
      /* Missing or altered backports remain unmitigated. */
    }
  }
  return verified;
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function evaluateDependencyAudit(report, verified) {
  if (
    !object(report) ||
    report.error ||
    !object(report.advisories) ||
    !object(report.metadata?.vulnerabilities)
  )
    throw new Error("Malformed dependency audit report.");
  const advisories = Object.values(report.advisories);
  const counts = Object.values(report.metadata.vulnerabilities);
  if (
    counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
    (advisories.length === 0 && counts.some((count) => count > 0))
  )
    throw new Error("Incomplete dependency audit report.");
  const result = { blocked: [], mitigated: [] };
  for (const item of advisories) {
    if (
      !object(item) ||
      typeof item.github_advisory_id !== "string" ||
      typeof item.module_name !== "string" ||
      !["low", "moderate", "high", "critical", "info"].includes(item.severity) ||
      !Array.isArray(item.findings) ||
      item.findings.length === 0 ||
      item.findings.some(
        (finding) =>
          !object(finding) || typeof finding.version !== "string" || !Array.isArray(finding.paths),
      )
    )
      throw new Error("Malformed dependency advisory.");
    const patch = backports.find(
      (entry) => entry.advisory === item.github_advisory_id && entry.package === item.module_name,
    );
    const mitigated =
      patch &&
      verified.has(patch.advisory) &&
      item.findings.every(
        (finding) =>
          finding.version === patch.version &&
          finding.paths.length > 0 &&
          finding.paths.every((p) => typeof p === "string" && p.length > 0),
      );
    result[mitigated ? "mitigated" : "blocked"].push({
      advisory: item.github_advisory_id,
      package: item.module_name,
      severity: item.severity,
    });
  }
  for (const severity of ["info", "low", "moderate", "high", "critical"]) {
    const actual = advisories.filter((item) => item.severity === severity).length;
    if ((report.metadata.vulnerabilities[severity] ?? 0) !== actual)
      throw new Error("Incomplete dependency audit report.");
  }
  return result;
}

function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--report")
    throw new Error("Usage: check-dependency-audit.mjs --report <audit.json>");
  const reportPath = process.argv[3];
  if (statSync(reportPath).size > 8 * 1024 * 1024)
    throw new Error("Audit report exceeds its size limit.");
  const result = evaluateDependencyAudit(
    JSON.parse(readFileSync(reportPath, "utf8")),
    verifyBackports(),
  );
  for (const entry of result.mitigated)
    console.warn(
      `${entry.advisory} (${entry.package}, ${entry.severity}): registry warning retained; exact local backport verified. Runtime patch regressions must pass before this gate.`,
    );
  for (const entry of result.blocked)
    console.error(
      `${entry.advisory} (${entry.package}, ${entry.severity}): unmitigated dependency advisory.`,
    );
  if (result.blocked.length) process.exitCode = 1;
  else
    console.log(
      `Dependency policy passed: ${result.mitigated.length} verified backports; no unmitigated advisories.`,
    );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch {
    console.error(
      "Dependency audit policy failed: missing, malformed, or incomplete report/configuration.",
    );
    process.exitCode = 1;
  }
}
