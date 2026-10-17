import { describe, expect, it } from "vitest";

const providerCredentialsModule = await import("./" + "provider-credentials.js").catch(() => null);

describe("encrypted provider credential repository", () => {
  it("exports the workspace-scoped encrypted-envelope storage adapter", () => {
    expect(providerCredentialsModule).toEqual(
      expect.objectContaining({
        createDrizzleProviderCredentialRepository: expect.any(Function),
      }),
    );
  });
});
