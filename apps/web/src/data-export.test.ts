import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "data-export.ts"), "utf8");

/**
 * The connected-account select list is pinned: it is the only thing standing
 * between a GDPR export and the encrypted token envelope. If a column is
 * ever added here it must be deliberate — never a `select()` wildcard.
 */
describe("data export — connected accounts", () => {
  const selectBlock = source.match(/connectedAccounts\s*=[\s\S]*?\.select\(\{([\s\S]*?)\}\)/);

  it("selects only non-secret connected-account columns", () => {
    expect(selectBlock).not.toBeNull();
    const columns = selectBlock?.[1] ?? "";
    expect(columns).toContain("connectedAccount.provider");
    expect(columns).toContain("connectedAccount.label");
    expect(columns).toContain("connectedAccount.externalAccountId");
    expect(columns).toContain("connectedAccount.scopes");
    expect(columns).toContain("connectedAccount.status");
    expect(columns).toContain("connectedAccount.createdAt");
  });

  it("can never emit token_* material", () => {
    const columns = selectBlock?.[1] ?? "";
    expect(columns).not.toMatch(/token/i);
    expect(columns).not.toContain("tokenCiphertext");
    expect(columns).not.toContain("tokenIv");
    expect(columns).not.toContain("tokenAuthTag");
    expect(columns).not.toContain("tokenAlgorithm");
    expect(columns).not.toContain("tokenVersion");
  });

  it("scopes rows to the user's workspaces and exposes them on the export", () => {
    expect(source).toContain("inArray(connectedAccount.workspaceId, membershipWorkspaceIds)");
    expect(source).toContain("connectedAccounts,");
    // The membership workspace ids must come from the memberships select.
    expect(source).toContain("memberships.map((row) => row.workspaceId)");
  });

  it("masks external account ids like the settings UI does", () => {
    // Guests otherwise see full mailbox identities in the export that the
    // connections panel hides behind maskExternalAccountId.
    expect(source).toMatch(/externalAccountId:\s*maskExternalAccountId\(/);
  });
});
