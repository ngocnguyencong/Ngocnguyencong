import { describe, expect, test } from "vitest";

type Scope = Readonly<{ provider: string; workspaceId: string }>;

type EncryptedProviderKey = Readonly<{
  algorithm: "aes-256-gcm";
  authTag: string;
  ciphertext: string;
  iv: string;
  provider: string;
  version: 1;
  workspaceId: string;
}>;

type KeyVaultRepository = {
  delete(scope: Scope): Promise<void>;
  get(scope: Scope): Promise<EncryptedProviderKey | null>;
  put(record: EncryptedProviderKey): Promise<void>;
};

type PlatformKeyResolver = {
  resolve(scope: Scope): Promise<string>;
};

type WorkspaceProviderKeyVault = {
  delete(scope: Scope): Promise<void>;
  put(input: Scope & Readonly<{ apiKey: string }>): Promise<void>;
  resolve(input: Scope & Readonly<{ keyMode: "byok" | "platform" }>): Promise<string>;
};

type VaultConstructor = new (
  input: Readonly<{
    crypto?: Readonly<{ randomBytes(size: number): Uint8Array }>;
    masterKey: string;
    platformKeys: PlatformKeyResolver;
    repository: KeyVaultRepository;
  }>,
) => WorkspaceProviderKeyVault;

type AiExports = {
  KeyVaultError?: new (message: string) => Error;
  WorkspaceProviderKeyVault?: VaultConstructor;
};

async function loadAi(): Promise<AiExports> {
  return (await import("./index.js").catch(() => ({}))) as AiExports;
}

const masterKey = Buffer.alloc(32, 7).toString("base64");
const workspaceScope = { provider: "openai", workspaceId: "workspace-1" } as const;

class MemoryKeyVaultRepository implements KeyVaultRepository {
  readonly deleted: Scope[] = [];
  readonly putRecords: EncryptedProviderKey[] = [];
  private readonly records = new Map<string, EncryptedProviderKey>();

  async delete(scope: Scope): Promise<void> {
    this.deleted.push(scope);
    this.records.delete(key(scope));
  }

  async get(scope: Scope): Promise<EncryptedProviderKey | null> {
    return this.records.get(key(scope)) ?? null;
  }

  async put(record: EncryptedProviderKey): Promise<void> {
    this.putRecords.push(record);
    this.records.set(key(record), record);
  }

  async read(scope: Scope): Promise<EncryptedProviderKey> {
    const record = await this.get(scope);
    if (record === null) {
      throw new Error("Expected record to exist.");
    }
    return record;
  }
}

function key(scope: Scope): string {
  return `${scope.workspaceId}:${scope.provider}`;
}

function createVault(
  Vault: VaultConstructor,
  repository: KeyVaultRepository,
  platformKeys: PlatformKeyResolver = {
    async resolve() {
      return "platform-key";
    },
  },
) {
  return new Vault({
    crypto: {
      randomBytes(size) {
        expect(size).toBe(12);
        return new Uint8Array(size).fill(9);
      },
    },
    masterKey,
    platformKeys,
    repository,
  });
}

describe("WorkspaceProviderKeyVault", () => {
  test("persists only a versioned tenant-bound AES-GCM envelope and resolves its BYOK key", async () => {
    const ai = await loadAi();
    const repository = new MemoryKeyVaultRepository();
    const secret = "byok-plaintext-must-not-persist";

    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    const vault = createVault(ai.WorkspaceProviderKeyVault!, repository);

    await vault.put({ ...workspaceScope, apiKey: secret });

    const record = await repository.read(workspaceScope);
    expect(record).toMatchObject({
      algorithm: "aes-256-gcm",
      authTag: expect.any(String),
      ciphertext: expect.any(String),
      iv: Buffer.alloc(12, 9).toString("base64"),
      provider: "openai",
      version: 1,
      workspaceId: "workspace-1",
    });
    expect(JSON.stringify(record)).not.toContain(secret);
    expect(record).not.toHaveProperty("apiKey");
    await expect(vault.resolve({ ...workspaceScope, keyMode: "byok" })).resolves.toBe(secret);
  });

  test("delegates platform keys to the injected server-only resolver", async () => {
    const ai = await loadAi();
    const repository = new MemoryKeyVaultRepository();
    const calls: Scope[] = [];
    const platformKeys: PlatformKeyResolver = {
      async resolve(scope) {
        calls.push(scope);
        return "platform-secret";
      },
    };

    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    const vault = createVault(ai.WorkspaceProviderKeyVault!, repository, platformKeys);

    await expect(vault.resolve({ ...workspaceScope, keyMode: "platform" })).resolves.toBe(
      "platform-secret",
    );
    expect(calls).toEqual([workspaceScope]);
    expect(repository.putRecords).toEqual([]);
  });

  test("rejects a master key that is not an exact 32-byte Base64 value", async () => {
    const ai = await loadAi();
    const repository = new MemoryKeyVaultRepository();

    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    expect(
      () =>
        new ai.WorkspaceProviderKeyVault!({
          masterKey: "this is not a valid 32-byte base64 key",
          platformKeys: {
            async resolve() {
              return "platform-secret";
            },
          },
          repository,
        }),
    ).toThrow("Master key must be a 32-byte Base64 value.");
  });

  test("rejects a ciphertext moved to a different workspace without disclosing plaintext", async () => {
    const ai = await loadAi();
    const repository = new MemoryKeyVaultRepository();
    const secret = "workspace-bound-secret";

    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    const vault = createVault(ai.WorkspaceProviderKeyVault!, repository);
    await vault.put({ ...workspaceScope, apiKey: secret });
    const record = await repository.read(workspaceScope);
    await repository.put({ ...record, workspaceId: "workspace-2" });

    const error = await vault
      .resolve({ keyMode: "byok", provider: "openai", workspaceId: "workspace-2" })
      .then(() => new Error("Expected decryption to fail."))
      .catch((caught: unknown) => caught as Error);

    expect(error.message).toBe("Stored BYOK key could not be decrypted.");
    expect(error.message).not.toContain(secret);
  });

  test("rejects a ciphertext moved to a different provider", async () => {
    const ai = await loadAi();
    const repository = new MemoryKeyVaultRepository();

    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    const vault = createVault(ai.WorkspaceProviderKeyVault!, repository);
    await vault.put({ ...workspaceScope, apiKey: "provider-bound-secret" });
    const record = await repository.read(workspaceScope);
    await repository.put({ ...record, provider: "anthropic" });

    await expect(
      vault.resolve({ keyMode: "byok", provider: "anthropic", workspaceId: "workspace-1" }),
    ).rejects.toThrow("Stored BYOK key could not be decrypted.");
  });

  test("sanitizes repository failures and deletes only the scoped encrypted record", async () => {
    const ai = await loadAi();
    const secret = "never-copy-this-repository-error-secret";
    const repository: KeyVaultRepository = {
      async delete() {},
      async get() {
        return null;
      },
      async put() {
        throw new ai.KeyVaultError!(`repository rejected ${secret}`);
      },
    };

    expect(ai.KeyVaultError).toBeTypeOf("function");
    expect(ai.WorkspaceProviderKeyVault).toBeTypeOf("function");
    const vault = createVault(ai.WorkspaceProviderKeyVault!, repository);

    const error = await vault
      .put({ ...workspaceScope, apiKey: secret })
      .then(() => new Error("Expected storage to fail."))
      .catch((caught: unknown) => caught as Error);
    expect(error.message).toBe("BYOK key storage failed.");
    expect(error.message).not.toContain(secret);

    const deletableRepository = new MemoryKeyVaultRepository();
    const deletableVault = createVault(ai.WorkspaceProviderKeyVault!, deletableRepository);
    await deletableVault.put({ ...workspaceScope, apiKey: "delete-me" });
    await deletableVault.delete(workspaceScope);

    expect(deletableRepository.deleted).toEqual([workspaceScope]);
    await expect(deletableVault.resolve({ ...workspaceScope, keyMode: "byok" })).rejects.toThrow(
      "No BYOK key is configured.",
    );
  });
});
