import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkspaceExportCard } from "./workspace-export-card";

const here = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(here, "web-settings-page.tsx"), "utf8");

const copy = {
  title: "Workspace data",
  description: "Download a JSON copy of this workspace's content, commerce, members, and settings.",
  action: "Export workspace",
};

describe("WorkspaceExportCard", () => {
  it("renders a no-JS download link to the export route", () => {
    const html = renderToStaticMarkup(<WorkspaceExportCard copy={copy} />);
    expect(html).toContain('href="/api/workspace/export"');
    expect(html).toContain("<a");
    expect(html).toContain("Export workspace");
    expect(html).toContain("Workspace data");
  });
});

describe("Settings → General export card gating", () => {
  it("renders only when canExportWorkspace is true", () => {
    // The card must never appear for members/guests — the page resolves the
    // prop via requireWorkspaceManager before rendering.
    expect(pageSource).toContain("canExportWorkspace && workspaceExportCopy");
    expect(pageSource).toContain("<WorkspaceExportCard copy={workspaceExportCopy} />");
  });
});
