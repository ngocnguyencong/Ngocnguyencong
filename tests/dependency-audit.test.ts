import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { evaluateDependencyAudit, verifyBackports } from "../scripts/check-dependency-audit.mjs";

const advisory = (changes: Record<string, unknown> = {}) => ({
  github_advisory_id: "GHSA-86w9-cpqp-85rv",
  module_name: "node-forge",
  severity: "high",
  findings: [{ version: "1.4.0", paths: ["apps__mobile>expo>node-forge"] }],
  ...changes,
});
const report = (value: unknown) => ({
  advisories: { one: value },
  metadata: { vulnerabilities: { high: 1 } },
});

describe("dependency audit backport policy", () => {
  it("recognizes only the current reviewed backport and keeps its warning", () => {
    const result = evaluateDependencyAudit(report(advisory()), verifyBackports(readFileSync));
    expect(result.blocked).toEqual([]);
    expect(result.mitigated).toEqual([
      expect.objectContaining({ advisory: "GHSA-86w9-cpqp-85rv", package: "node-forge" }),
    ]);
  });

  it.each([
    { github_advisory_id: "GHSA-aaaa-bbbb-cccc" },
    { module_name: "other-package" },
    { findings: [{ version: "1.3.0", paths: ["other>node-forge"] }] },
    { findings: [{ version: "1.4.0", paths: [] }] },
  ])("blocks a changed advisory or dependency identity: %j", (changes) => {
    expect(
      evaluateDependencyAudit(report(advisory(changes)), verifyBackports(readFileSync)).blocked,
    ).toHaveLength(1);
  });

  it("fails closed if the patch file is missing or has changed", () => {
    for (const changed of [false, true]) {
      const files = (path: string, encoding: "utf8") => {
        if (String(path).replaceAll("\\", "/").endsWith("patches/node-forge@1.4.0.patch")) {
          if (!changed) throw new Error("Missing patch");
          return "different patch";
        }
        return readFileSync(path, encoding);
      };
      expect(
        evaluateDependencyAudit(report(advisory()), verifyBackports(files)).blocked,
      ).toHaveLength(1);
    }
  });

  it.each(["pnpm-lock.yaml", "pnpm-workspace.yaml"])(
    "fails closed on a missing %s patch mapping",
    (name) => {
      const files = (path: string, encoding: "utf8") =>
        String(path).endsWith(name)
          ? readFileSync(path, encoding).replace(/^ {2}node-forge@1\.4\.0:.*$/m, "")
          : readFileSync(path, encoding);
      expect(
        evaluateDependencyAudit(report(advisory()), verifyBackports(files)).blocked,
      ).toHaveLength(1);
    },
  );

  it.each([
    null,
    {},
    { error: "Registry unavailable" },
    { advisories: {}, metadata: { vulnerabilities: { high: 1 } } },
    { advisories: { one: advisory() }, metadata: { vulnerabilities: { high: 0 } } },
    report({}),
  ])("rejects malformed or incomplete reports", (value) => {
    expect(() => evaluateDependencyAudit(value, verifyBackports(readFileSync))).toThrow();
  });

  it("accepts an explicit clean registry report", () => {
    expect(
      evaluateDependencyAudit(
        { advisories: {}, metadata: { vulnerabilities: { high: 0 } } },
        new Set(),
      ).blocked,
    ).toEqual([]);
  });
});
