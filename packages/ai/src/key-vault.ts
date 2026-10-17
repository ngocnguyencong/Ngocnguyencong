import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { WorkspaceKeyMode } from "./contracts";

const AES_256_GCM = "aes-256-gcm";
const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const MASTER_KEY_BYTES = 32;

export interface KeyVaultScope {
  readonly provider: string;
  readonly workspaceId: string;
}

export interface EncryptedProviderKey extends KeyVaultScope {
  readonly algorithm: typeof AES_256_GCM;
  readonly authTag: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly version: typeof ENVELOPE_VERSION;
}

export interface KeyVaultRepository {
  delete(scope: KeyVaultScope): Promise<void>;
  get(scope: KeyVaultScope): Promise<EncryptedProviderKey | null>;
  put(record: EncryptedProviderKey): Promise<void>;
}

export interface PlatformKeyResolver {
  resolve(scope: KeyVaultScope): Promise<string>;
}

export interface KeyVaultCrypto {
  randomBytes(size: number): Uint8Array;
}

export interface WorkspaceProviderKeyVaultOptions {
  readonly crypto?: KeyVaultCrypto;
  readonly masterKey: string;
  readonly platformKeys: PlatformKeyResolver;
  readonly repository: KeyVaultRepository;
}

export interface PutProviderKeyInput extends KeyVaultScope {
  readonly apiKey: string;
}

export interface ResolveProviderKeyInput extends KeyVaultScope {
  readonly keyMode: WorkspaceKeyMode;
}

export class KeyVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyVaultError";
  }
}

export class WorkspaceProviderKeyVault {
  private readonly crypto: KeyVaultCrypto;
  private readonly masterKey: Buffer;

  constructor(private readonly options: WorkspaceProviderKeyVaultOptions) {
    this.masterKey = parseMasterKey(options.masterKey);
    this.crypto = options.crypto ?? { randomBytes };
  }

  async put(input: PutProviderKeyInput): Promise<void> {
    const scope = normalizedScope(input);
    const apiKey = requiredKey(input.apiKey);
    let record: EncryptedProviderKey;

    try {
      const iv = this.newIv();
      const cipher = createCipheriv(AES_256_GCM, this.masterKey, iv);
      cipher.setAAD(authenticationContext(scope));
      const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
      record = Object.freeze({
        algorithm: AES_256_GCM,
        authTag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        iv: iv.toString("base64"),
        provider: scope.provider,
        version: ENVELOPE_VERSION,
        workspaceId: scope.workspaceId,
      });
    } catch {
      throw new KeyVaultError("BYOK key storage failed.");
    }

    try {
      await this.options.repository.put(record);
    } catch {
      throw new KeyVaultError("BYOK key storage failed.");
    }
  }

  async resolve(input: ResolveProviderKeyInput): Promise<string> {
    const scope = normalizedScope(input);

    if (input.keyMode === "platform") {
      try {
        return requiredKey(await this.options.platformKeys.resolve(scope));
      } catch {
        throw new KeyVaultError("Key resolution failed.");
      }
    }

    if (input.keyMode !== "byok") {
      throw new KeyVaultError("A valid key mode is required.");
    }

    let record: EncryptedProviderKey | null;
    try {
      record = await this.options.repository.get(scope);
    } catch {
      throw new KeyVaultError("Key resolution failed.");
    }

    if (record === null) {
      throw new KeyVaultError("No BYOK key is configured.");
    }

    return this.decrypt(record, scope);
  }

  async delete(scope: KeyVaultScope): Promise<void> {
    const normalized = normalizedScope(scope);

    try {
      await this.options.repository.delete(normalized);
    } catch {
      throw new KeyVaultError("BYOK key deletion failed.");
    }
  }

  private decrypt(record: EncryptedProviderKey, scope: KeyVaultScope): string {
    try {
      const envelope = validatedEnvelope(record, scope);
      const iv = decodeBase64(envelope.iv);
      const authTag = decodeBase64(envelope.authTag);
      const ciphertext = decodeBase64(envelope.ciphertext);

      if (iv === null || iv.byteLength !== IV_BYTES || authTag === null || ciphertext === null) {
        throw new Error("Invalid encrypted envelope.");
      }

      const decipher = createDecipheriv(AES_256_GCM, this.masterKey, iv);
      decipher.setAAD(authenticationContext(scope));
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      );

      return requiredKey(plaintext);
    } catch {
      throw new KeyVaultError("Stored BYOK key could not be decrypted.");
    }
  }

  private newIv(): Buffer {
    const iv = this.crypto.randomBytes(IV_BYTES);

    if (!(iv instanceof Uint8Array) || iv.byteLength !== IV_BYTES) {
      throw new KeyVaultError("A valid IV could not be generated.");
    }

    return Buffer.from(iv);
  }
}

function normalizedScope(scope: KeyVaultScope): KeyVaultScope {
  if (
    typeof scope.workspaceId !== "string" ||
    scope.workspaceId.trim().length === 0 ||
    typeof scope.provider !== "string" ||
    scope.provider.trim().length === 0
  ) {
    throw new KeyVaultError("A workspace and provider are required.");
  }

  return Object.freeze({ provider: scope.provider, workspaceId: scope.workspaceId });
}

function requiredKey(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new KeyVaultError("A provider API key is required.");
  }

  return value;
}

function parseMasterKey(value: unknown): Buffer {
  const masterKey = decodeBase64(value);

  if (masterKey === null || masterKey.byteLength !== MASTER_KEY_BYTES) {
    throw new KeyVaultError("Master key must be a 32-byte Base64 value.");
  }

  return masterKey;
}

function authenticationContext(scope: KeyVaultScope): Buffer {
  return Buffer.from(
    JSON.stringify({ provider: scope.provider, workspaceId: scope.workspaceId }),
    "utf8",
  );
}

function validatedEnvelope(
  record: EncryptedProviderKey,
  scope: KeyVaultScope,
): EncryptedProviderKey {
  if (
    typeof record !== "object" ||
    record === null ||
    record.algorithm !== AES_256_GCM ||
    record.version !== ENVELOPE_VERSION ||
    record.workspaceId !== scope.workspaceId ||
    record.provider !== scope.provider ||
    typeof record.iv !== "string" ||
    typeof record.authTag !== "string" ||
    typeof record.ciphertext !== "string"
  ) {
    throw new Error("Invalid encrypted envelope.");
  }

  return record;
}

function decodeBase64(value: unknown): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  ) {
    return null;
  }

  const decoded = Buffer.from(value, "base64");
  return decoded.toString("base64") === value ? decoded : null;
}
