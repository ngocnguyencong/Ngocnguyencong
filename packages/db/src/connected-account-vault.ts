/**
 * AES-256-GCM token envelope for connected external accounts.
 *
 * NOTE: this mirrors the crypto in `packages/ai/src/key-vault.ts` (~60 lines)
 * because `@supastack/db` has no dependency on `@supastack/ai`. Keep the two
 * implementations in sync: same `aes-256-gcm` algorithm, 12-byte IVs, base64
 * envelope fields, JSON AAD. The master key is the same 32-byte base64 value
 * supplied via `CREDENTIAL_ENCRYPTION_KEY`.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const AES_256_GCM = "aes-256-gcm";
export const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const MASTER_KEY_BYTES = 32;

export class ConnectedAccountVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectedAccountVaultError";
  }
}

/**
 * AAD scope bound into every envelope: provider + workspace + account row id.
 * `accountId` must be the `connected_account.id` the envelope belongs to —
 * encrypting against one row and storing on another makes the envelope
 * permanently undecryptable.
 */
export interface ConnectedAccountVaultScope {
  readonly accountId: string;
  readonly provider: string;
  readonly workspaceId: string;
}

/**
 * Plaintext token payload — only ever in memory, never persisted. OAuth
 * accounts carry `accessToken` (+ optional `refreshToken`); SMTP accounts
 * carry `smtpPassword` plus their transport config (`smtpHost`, `smtpUser`,
 * `smtpPort`, `smtpSecure`) so a decrypted token set is the complete send
 * configuration — the "host:user" externalAccountId stays an opaque identity
 * key, never parsed back into fields. SMTP-backed mailboxes may also carry an
 * explicit `imapHost` and optional `imapUser`/`imapPassword` override for
 * read-only reply sync; the inbox adapter fixes port/TLS at 993/implicit TLS.
 * The IMAP host is never inferred from the SMTP host. At least one of
 * accessToken/smtpPassword is required — refreshToken alone is meaningless
 * without a way to use it.
 */
export interface ConnectedAccountTokenSet {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly smtpPassword?: string;
  /** SMTP relay host (hostname or IP literal), 1-255 chars. */
  readonly smtpHost?: string;
  /** SMTP login username, 1-255 chars — may itself contain ':'. */
  readonly smtpUser?: string;
  /** SMTP port — integer 1-65535. */
  readonly smtpPort?: number;
  /** Whether the SMTP transport uses implicit TLS. */
  readonly smtpSecure?: boolean;
  /** Explicit IMAP host for inbox sync; never inferred from smtpHost. */
  readonly imapHost?: string;
  /** Optional IMAP login username; may fall back to smtpUser if omitted. */
  readonly imapUser?: string;
  /** Optional IMAP login password; may fall back to smtpPassword if omitted. */
  readonly imapPassword?: string;
}

/** Storage-only envelope; safe to persist on the `connected_account` row. */
export interface ConnectedAccountTokenEnvelope {
  readonly algorithm: typeof AES_256_GCM;
  readonly authTag: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly version: typeof ENVELOPE_VERSION;
}

export interface ConnectedAccountVaultCrypto {
  randomBytes(size: number): Uint8Array;
}

export interface ConnectedAccountVault {
  decrypt(
    scope: ConnectedAccountVaultScope,
    envelope: ConnectedAccountTokenEnvelope,
  ): ConnectedAccountTokenSet;
  encrypt(
    scope: ConnectedAccountVaultScope,
    tokens: ConnectedAccountTokenSet,
  ): ConnectedAccountTokenEnvelope;
}

export function createConnectedAccountVault(
  masterKey: string,
  crypto: ConnectedAccountVaultCrypto = { randomBytes },
): ConnectedAccountVault {
  const key = parseMasterKey(masterKey);

  return Object.freeze({
    decrypt(scope: ConnectedAccountVaultScope, envelope: ConnectedAccountTokenEnvelope) {
      const normalized = normalizeScope(scope);
      try {
        const validated = validateEnvelope(envelope);
        const iv = decodeBase64(validated.iv);
        const authTag = decodeBase64(validated.authTag);
        const ciphertext = decodeBase64(validated.ciphertext);
        if (iv === null || iv.byteLength !== IV_BYTES || authTag === null || ciphertext === null) {
          throw new Error("Invalid encrypted envelope.");
        }

        const decipher = createDecipheriv(AES_256_GCM, key, iv);
        decipher.setAAD(authenticationContext(normalized));
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
          "utf8",
        );

        return parseTokenSet(plaintext); // frozen — shared across callers
      } catch {
        throw new ConnectedAccountVaultError("Stored account tokens could not be decrypted.");
      }
    },
    encrypt(scope: ConnectedAccountVaultScope, tokens: ConnectedAccountTokenSet) {
      const normalized = normalizeScope(scope);
      const plaintext = serializeTokenSet(tokens);
      try {
        const iv = newIv(crypto);
        const cipher = createCipheriv(AES_256_GCM, key, iv);
        cipher.setAAD(authenticationContext(normalized));
        const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
        return Object.freeze({
          algorithm: AES_256_GCM,
          authTag: cipher.getAuthTag().toString("base64"),
          ciphertext: ciphertext.toString("base64"),
          iv: iv.toString("base64"),
          version: ENVELOPE_VERSION,
        });
      } catch {
        throw new ConnectedAccountVaultError("Account token encryption failed.");
      }
    },
  });
}

function normalizeScope(scope: ConnectedAccountVaultScope): ConnectedAccountVaultScope {
  if (
    typeof scope.workspaceId !== "string" ||
    scope.workspaceId.trim().length === 0 ||
    typeof scope.provider !== "string" ||
    scope.provider.trim().length === 0 ||
    typeof scope.accountId !== "string" ||
    scope.accountId.trim().length === 0
  ) {
    throw new ConnectedAccountVaultError("A workspace, provider, and account are required.");
  }
  return Object.freeze({
    accountId: scope.accountId,
    provider: scope.provider,
    workspaceId: scope.workspaceId,
  });
}

/** SMTP text fields (host/user) are bounded so the envelope can't smuggle junk. */
const SMTP_TEXT_FIELD_MAX = 255;

/** Non-blank string within the SMTP field bound (validates runtime input too). */
function isSmtpTextField(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= SMTP_TEXT_FIELD_MAX
  );
}

/** Integer TCP port. */
function isSmtpPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535;
}

/** Non-empty secret bounded to the same size accepted by the setup form. */
function isImapPassword(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= SMTP_TEXT_FIELD_MAX;
}

function serializeTokenSet(tokens: ConnectedAccountTokenSet): string {
  if (typeof tokens !== "object" || tokens === null) {
    throw new ConnectedAccountVaultError("Account tokens are required.");
  }
  // Empty/missing fields are dropped from the payload — decrypt then simply
  // omits them from the token set.
  const payload: Record<string, boolean | number | string> = {};
  if (typeof tokens.accessToken === "string" && tokens.accessToken.length > 0) {
    payload.accessToken = tokens.accessToken;
  }
  if (typeof tokens.refreshToken === "string" && tokens.refreshToken.length > 0) {
    payload.refreshToken = tokens.refreshToken;
  }
  if (typeof tokens.smtpPassword === "string" && tokens.smtpPassword.length > 0) {
    payload.smtpPassword = tokens.smtpPassword;
  }
  // Optional SMTP transport config — validated so a malformed send config can
  // never be persisted inside the envelope.
  if (tokens.smtpHost !== undefined) {
    if (!isSmtpTextField(tokens.smtpHost)) {
      throw new ConnectedAccountVaultError("Invalid SMTP transport configuration.");
    }
    payload.smtpHost = tokens.smtpHost;
  }
  if (tokens.smtpUser !== undefined) {
    if (!isSmtpTextField(tokens.smtpUser)) {
      throw new ConnectedAccountVaultError("Invalid SMTP transport configuration.");
    }
    payload.smtpUser = tokens.smtpUser;
  }
  if (tokens.smtpPort !== undefined) {
    if (!isSmtpPort(tokens.smtpPort)) {
      throw new ConnectedAccountVaultError("Invalid SMTP transport configuration.");
    }
    payload.smtpPort = tokens.smtpPort;
  }
  if (tokens.smtpSecure !== undefined) {
    if (typeof tokens.smtpSecure !== "boolean") {
      throw new ConnectedAccountVaultError("Invalid SMTP transport configuration.");
    }
    payload.smtpSecure = tokens.smtpSecure;
  }
  if (tokens.imapHost !== undefined) {
    if (!isSmtpTextField(tokens.imapHost)) {
      throw new ConnectedAccountVaultError("Invalid IMAP transport configuration.");
    }
    payload.imapHost = tokens.imapHost;
  }
  if (tokens.imapUser !== undefined) {
    if (!isSmtpTextField(tokens.imapUser) || tokens.imapHost === undefined) {
      throw new ConnectedAccountVaultError("Invalid IMAP transport configuration.");
    }
    payload.imapUser = tokens.imapUser;
  }
  if (tokens.imapPassword !== undefined) {
    if (!isImapPassword(tokens.imapPassword) || tokens.imapHost === undefined) {
      throw new ConnectedAccountVaultError("Invalid IMAP transport configuration.");
    }
    payload.imapPassword = tokens.imapPassword;
  }
  if (payload.accessToken === undefined && payload.smtpPassword === undefined) {
    throw new ConnectedAccountVaultError("At least one account token is required.");
  }
  return JSON.stringify(payload);
}

function parseTokenSet(plaintext: string): ConnectedAccountTokenSet {
  const parsed: unknown = JSON.parse(plaintext);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid token payload.");
  }
  const record = parsed as Record<string, unknown>;
  const tokens: {
    -readonly [K in keyof ConnectedAccountTokenSet]: ConnectedAccountTokenSet[K];
  } = {};
  if (typeof record.accessToken === "string") {
    tokens.accessToken = record.accessToken;
  }
  if (typeof record.refreshToken === "string") {
    tokens.refreshToken = record.refreshToken;
  }
  if (typeof record.smtpPassword === "string") {
    tokens.smtpPassword = record.smtpPassword;
  }
  // Optional SMTP transport fields: absent stays absent (pre-change envelopes
  // still parse); present-but-malformed fails the decrypt.
  if (record.smtpHost !== undefined) {
    if (!isSmtpTextField(record.smtpHost)) {
      throw new Error("Invalid token payload.");
    }
    tokens.smtpHost = record.smtpHost;
  }
  if (record.smtpUser !== undefined) {
    if (!isSmtpTextField(record.smtpUser)) {
      throw new Error("Invalid token payload.");
    }
    tokens.smtpUser = record.smtpUser;
  }
  if (record.smtpPort !== undefined) {
    if (!isSmtpPort(record.smtpPort)) {
      throw new Error("Invalid token payload.");
    }
    tokens.smtpPort = record.smtpPort;
  }
  if (record.smtpSecure !== undefined) {
    if (typeof record.smtpSecure !== "boolean") {
      throw new Error("Invalid token payload.");
    }
    tokens.smtpSecure = record.smtpSecure;
  }
  // Optional IMAP transport config. Legacy SMTP-only envelopes remain valid;
  // present auth overrides require an explicit IMAP host.
  if (record.imapHost !== undefined) {
    if (!isSmtpTextField(record.imapHost)) {
      throw new Error("Invalid token payload.");
    }
    tokens.imapHost = record.imapHost;
  }
  if (record.imapUser !== undefined) {
    if (!isSmtpTextField(record.imapUser) || record.imapHost === undefined) {
      throw new Error("Invalid token payload.");
    }
    tokens.imapUser = record.imapUser;
  }
  if (record.imapPassword !== undefined) {
    if (!isImapPassword(record.imapPassword) || record.imapHost === undefined) {
      throw new Error("Invalid token payload.");
    }
    tokens.imapPassword = record.imapPassword;
  }
  if (tokens.accessToken === undefined && tokens.smtpPassword === undefined) {
    throw new Error("Invalid token payload.");
  }
  return Object.freeze(tokens);
}

function authenticationContext(scope: ConnectedAccountVaultScope): Buffer {
  return Buffer.from(
    JSON.stringify({
      accountId: scope.accountId,
      provider: scope.provider,
      workspaceId: scope.workspaceId,
    }),
    "utf8",
  );
}

function validateEnvelope(envelope: ConnectedAccountTokenEnvelope): ConnectedAccountTokenEnvelope {
  if (
    typeof envelope !== "object" ||
    envelope === null ||
    envelope.algorithm !== AES_256_GCM ||
    envelope.version !== ENVELOPE_VERSION ||
    typeof envelope.iv !== "string" ||
    typeof envelope.authTag !== "string" ||
    typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Invalid encrypted envelope.");
  }
  return envelope;
}

function newIv(crypto: ConnectedAccountVaultCrypto): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  if (!(iv instanceof Uint8Array) || iv.byteLength !== IV_BYTES) {
    throw new ConnectedAccountVaultError("A valid IV could not be generated.");
  }
  return Buffer.from(iv);
}

function parseMasterKey(value: unknown): Buffer {
  const masterKey = decodeBase64(value);
  if (masterKey === null || masterKey.byteLength !== MASTER_KEY_BYTES) {
    throw new ConnectedAccountVaultError("Master key must be a 32-byte Base64 value.");
  }
  return masterKey;
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
