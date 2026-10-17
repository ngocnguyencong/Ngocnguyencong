import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { featureRequestSubmitPresentation } from "./web-feature-board-presentation";

const here = dirname(fileURLToPath(import.meta.url));

describe("feature request submission presentation", () => {
  it("acknowledges an in-flight request and blocks repeat input", () => {
    expect(featureRequestSubmitPresentation(false)).toEqual({
      busy: false,
      disabled: false,
      label: "Submit request",
    });
    expect(featureRequestSubmitPresentation(true)).toEqual({
      busy: true,
      disabled: true,
      label: "Submitting request…",
    });
  });

  it("reserves a spinner slot and disables its animation for reduced motion", () => {
    const css = readFileSync(join(here, "../app/app-theme.css"), "utf8");
    expect(css).toMatch(/\.feature-submit-spinner\s*\{[^}]*width:\s*16px;/s);
    expect(css).toMatch(/\.feature-submit-spinner\s*\{[^}]*opacity:\s*0;/s);
    expect(css).toMatch(/\.feature-submit-form\[aria-busy="true"\][\s\S]*opacity:\s*1;/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.feature-submit-spinner\s*\{[^}]*animation:\s*none\s*!important;/,
    );
  });
});
