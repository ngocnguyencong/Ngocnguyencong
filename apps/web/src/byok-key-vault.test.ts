import { WorkspaceProviderKeyVault, type KeyVaultRepository } from "@supastack/ai";
import { parseServerConfig, type ServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Scope = Readonly<{ provider: string; workspaceId: string }>;
type ProviderKeyResolver = Readonly<{
  resolve(input: Scope & Readonly<{ keyMode: "byok" | "platform" }>): Promise<string>;
}>;
type ByokExports = Readonly<{
  createServerDrizzleProviderKeyResolver?: (input: unknown) => ProviderKeyResolver;
  createServerProviderKeyResolver?: (
    input: Readonly<{
      repository: KeyVaultRepository;
      serverConfig: ServerConfig;
    }>,
  ) => ProviderKeyResolver;
}>;

async function loadByok(): Promise<ByokExports> {
  return (await import("./" + "byok-key-vault.js").catch(() => ({}))) as ByokExports;
}

class MemoryKeyVaultRepository implements KeyVaultRepository {
  readonly records = new Map<string, Awaited<ReturnType<KeyVaultRepository["get"]>>>();

  async delete(scope: Scope): Promise<void> {
    this.records.delete(key(scope));
  }

  async get(scope: Scope) {
    return this.records.get(key(scope)) ?? null;
  }

  async put(record: Parameters<KeyVaultRepository["put"]>[0]): Promise<void> {
    this.records.set(key(record), record);
  }
}

function key(scope: Scope): string {
  return `${scope.workspaceId}:${scope.provider}`;
}

function serverConfig() {
  return parseServerConfig({
    AI_PROVIDER: "openai",
    CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
    OPENAI_API_KEY: "synthetic-platform-key",
  });
}

describe("createServerProviderKeyResolver", () => {
  it("uses the parsed server encryption key to resolve an encrypted BYOK envelope", async () => {
    const byok = await loadByok();
    const config = serverConfig();
    const repository = new MemoryKeyVaultRepository();
    const secret = "synthetic-byok-key-must-stay-encrypted";
    const scope = { provider: "openai", workspaceId: "workspace_01" } as const;
    const seedVault = new WorkspaceProviderKeyVault({
      masterKey: config.auth.credentialEncryptionKey,
      platformKeys: {
        async resolve() {
          return "seed-platform-key";
        },
      },
      repository,
    });

    await seedVault.put({ ...scope, apiKey: secret });

    expect(byok.createServerProviderKeyResolver).toBeTypeOf("function");
    const resolver = byok.createServerProviderKeyResolver!({ repository, serverConfig: config });

    await expect(resolver.resolve({ ...scope, keyMode: "byok" })).resolves.toBe(secret);
    expect(JSON.stringify([...repository.records.values()])).not.toContain(secret);
  });

  it("resolves a platform key only for the selected configured provider", async () => {
    const byok = await loadByok();
    const repository = new MemoryKeyVaultRepository();

    expect(byok.createServerProviderKeyResolver).toBeTypeOf("function");
    const resolver = byok.createServerProviderKeyResolver!({
      repository,
      serverConfig: serverConfig(),
    });

    await expect(
      resolver.resolve({ keyMode: "platform", provider: "openai", workspaceId: "workspace_01" }),
    ).resolves.toBe("synthetic-platform-key");
    await expect(
      resolver.resolve({ keyMode: "platform", provider: "anthropic", workspaceId: "workspace_01" }),
    ).rejects.toThrow("Key resolution failed.");
  });

  it("does not construct or query BYOK storage for a platform-only request", async () => {
    const byok = await loadByok();
    const repository: KeyVaultRepository = {
      delete: vi.fn(),
      get: vi.fn(async () => {
        throw new Error("must not read BYOK storage");
      }),
      put: vi.fn(),
    };
    const config = parseServerConfig({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "synthetic-platform-key",
    });
    const resolver = byok.createServerProviderKeyResolver!({ repository, serverConfig: config });

    await expect(
      resolver.resolve({ keyMode: "platform", provider: "openai", workspaceId: "workspace_01" }),
    ).resolves.toBe("synthetic-platform-key");
    expect(repository.get).not.toHaveBeenCalled();
  });

  it("exports a Drizzle convenience resolver without widening the client surface", async () => {
    const byok = await loadByok();

    expect(byok.createServerDrizzleProviderKeyResolver).toBeTypeOf("function");
  });
});
