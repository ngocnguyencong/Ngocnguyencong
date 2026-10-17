import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const marketingCss = readFileSync(join(here, "marketing.module.css"), "utf8");
const utilityCss = readFileSync(join(here, "utility-page.module.css"), "utf8");

describe("utility-page intro centering", () => {
  it("keeps the .home element margin reset at zero specificity", () => {
    // `.home h1` / `.home p` at (0,1,1) tie `.intro h1` / `.intro p` (0,1,1) and beat
    // `.status` / `.prose` (0,1,0) — stylesheet order then decides whether auto margins
    // survive, which pinned utility-page titles to the left edge. `:where()` keeps the
    // reset below every module rule while still beating the UA stylesheet.
    expect(marketingCss).not.toMatch(
      /\.home\s+(h1|h2|h3|p|ul|ol|figure)\b[^,{}]*\{[^}]*margin\s*:/,
    );
    expect(marketingCss).toMatch(/:where\(\.home\)[^{]*\{[^}]*margin\s*:\s*0/);
  });

  it("centers intro children without relying on cascade order", () => {
    const intro = utilityCss.match(/\.intro\s*\{[^}]*\}/)?.[0] ?? "";
    expect(intro).toContain("text-align: center");
    expect(intro).toMatch(/margin\s*:\s*0 auto/);
  });
});
