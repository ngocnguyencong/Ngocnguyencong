import console from "node:console";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DENIED_LICENSES = new Set([
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "SSPL-1.0",
]);

export function findDeniedLicenses(report) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    throw new TypeError("Expected the pnpm license report to be an object");
  }

  return Object.entries(report)
    .filter(([license]) => DENIED_LICENSES.has(license))
    .flatMap(([license, packages]) =>
      packages.flatMap((entry) =>
        entry.versions.map((version) => `${entry.name}@${version} (${license})`),
      ),
    )
    .sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let reportText = "";
  for await (const chunk of process.stdin) {
    reportText += chunk;
  }
  const denied = findDeniedLicenses(JSON.parse(reportText));
  if (denied.length > 0) {
    console.error(`Denied dependency licenses:\n${denied.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("Dependency license check passed");
  }
}
