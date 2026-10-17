import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildWorkspaceObjectKey } from "@supastack/storage";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("organization logo upload and display", () => {
  it("generates correct object keys for organization logos", () => {
    const key = buildWorkspaceObjectKey("ws_org_123", "logo", "ws_org_123-1726000000.png");
    expect(key).toBe("ws_org_123/logo/ws_org_123-1726000000.png");
  });

  it("exposes organization logo endpoint in api/storage/logo and api/storage/organization-logo", () => {
    const route = readWeb("app/api/storage/logo/route.ts");
    expect(route).toContain("export async function POST");
    expect(route).toContain("canManageWorkspaceMembers");
    expect(route).toContain("replaceStoredWorkspaceImage");
    expect(route).toContain("checkStorageImageUploadAdmission");
    expect(route).toContain("MAX_LOGO_BYTES");
    expect(route).toContain("ALLOWED_TYPES");
    expect(route.indexOf("if (!canManageWorkspaceMembers(role))")).toBeLessThan(
      route.indexOf("const admission = await checkStorageImageUploadAdmission"),
    );
    expect(route.indexOf("const admission = await checkStorageImageUploadAdmission")).toBeLessThan(
      route.indexOf("const bounded = await readImageUploadFormData"),
    );

    const avatar = readWeb("app/api/storage/avatar/route.ts");
    expect(avatar).toContain("replaceStoredWorkspaceImage");
    expect(avatar).toContain("checkStorageImageUploadAdmission");
    expect(avatar.indexOf("const admission = await checkStorageImageUploadAdmission")).toBeLessThan(
      avatar.indexOf("const bounded = await readImageUploadFormData"),
    );

    const aliasRoute = readWeb("app/api/storage/organization-logo/route.ts");
    expect(aliasRoute).toContain('export const runtime = "nodejs"');
    expect(aliasRoute).toContain('export { POST } from "../logo/route"');
  });

  it("includes organization logo section and upload form in organization settings page", () => {
    const orgSettings = readWeb("app/organization/settings/page.tsx");
    expect(orgSettings).toContain("Organization logo");
    expect(orgSettings).toContain("org-logo-preview");
    expect(orgSettings).toContain("org-logo-placeholder");
    expect(orgSettings).toContain("uploadOrganizationLogoAction");
    expect(orgSettings).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(orgSettings).toContain("workspaceLogo={logoUrl}");
  });

  it("handles logo update status messages in organization settings page", () => {
    const orgSettings = readWeb("app/organization/settings/page.tsx");
    expect(orgSettings).toContain('status === "logo-updated"');
    expect(orgSettings).toContain('status === "invalid-logo"');
    expect(orgSettings).toContain('status === "invalid-logo-type"');
    expect(orgSettings).toContain('status === "upload-rate-limited"');
  });

  it("displays organization logo in workspace selector and brand mark when present", () => {
    const chrome = readWeb("src/app-chrome.tsx");
    expect(chrome).toContain("workspaceLogo");
    expect(chrome).toContain("<WorkspaceSwitcher");
    expect(chrome).toContain("app-brand-logo");

    const switcher = readWeb("src/workspace-switcher.tsx");
    expect(switcher).toContain("workspace-switcher-logo");

    const selectOrg = readWeb("app/select-organization/page.tsx");
    expect(selectOrg).toContain("workspace-selector-logo");

    const actions = readWeb("src/organization-actions.ts");
    expect(actions).toContain("workspaceLogo: logoMap.get(row.workspaceId)");
    const uploadActionStart = actions.indexOf("export async function uploadOrganizationLogoAction");
    const uploadActionEnd = actions.indexOf(
      "export async function getWorkspaceSeatLimit",
      uploadActionStart,
    );
    const uploadAction = actions.slice(uploadActionStart, uploadActionEnd);
    expect(uploadAction).toContain("checkStorageImageUploadAdmission");
    expect(uploadAction).toContain("replaceStoredWorkspaceImage");
    expect(uploadAction.indexOf("checkStorageImageUploadAdmission")).toBeLessThan(
      uploadAction.indexOf("file.arrayBuffer()"),
    );
    expect(uploadAction).not.toContain("Date.now()");
  });
});
