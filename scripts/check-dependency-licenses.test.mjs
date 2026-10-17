import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { findDeniedLicenses } from "./check-dependency-licenses.mjs";

test("flags denied SPDX licenses with package names and versions", () => {
  assert.deepEqual(
    findDeniedLicenses({
      "AGPL-3.0-only": [{ name: "restricted", versions: ["1.0.0"] }],
      MIT: [{ name: "allowed", versions: ["2.0.0"] }],
    }),
    ["restricted@1.0.0 (AGPL-3.0-only)"],
  );
});

test("allows packages with an alternative permitted license", () => {
  assert.deepEqual(
    findDeniedLicenses({
      "(BSD-3-Clause OR GPL-2.0)": [{ name: "dual-licensed", versions: ["1.0.0"] }],
    }),
    [],
  );
});

test("CLI reads a piped license report and reports denied packages", () => {
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-dependency-licenses.mjs", import.meta.url))],
    {
      encoding: "utf8",
      input: JSON.stringify({ "GPL-3.0-only": [{ name: "restricted", versions: ["2.0.0"] }] }),
    },
  );
  assert.equal(child.status, 1);
  assert.match(child.stderr, /restricted@2\.0\.0 \(GPL-3\.0-only\)/);
});
