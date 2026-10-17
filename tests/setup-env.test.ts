import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { setupEnvironment } from "../scripts/setup-env.mjs";

const fixtures: string[] = [];
const template = [
  "APP_ENV=local",
  "AUTH_SECRET=replace-with-auth-secret",
  "SCHEDULER_TICK_SECRET=",
  "CREDENTIAL_ENCRYPTION_KEY=replace-with-base64-key",
  "EMAIL_PROVIDER=local",
  "",
].join("\n");
const authSecret = "a".repeat(64);
const tickSecret = "b".repeat(64);
const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const validEnvironment = [
  `AUTH_SECRET='${authSecret}'`,
  `SCHEDULER_TICK_SECRET=${tickSecret}`,
  `CREDENTIAL_ENCRYPTION_KEY=${encryptionKey}`,
  "EMAIL_PROVIDER=smtp",
  "# preserve this comment and provider choice",
  "",
].join("\n");

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "supastack-env-test-"));
  fixtures.push(root);
  mkdirSync(path.join(root, "apps/web"), { recursive: true });
  writeFileSync(path.join(root, ".env.example"), template);
  return root;
}
const webEnv = (root: string) => path.join(root, "apps/web/.env.local");
const rootEnv = (root: string) => path.join(root, ".env");

afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("agent environment bootstrap", () => {
  it("creates synchronized valid secrets and is byte-for-byte idempotent", () => {
    const root = fixture();
    setupEnvironment(root);
    const first = readFileSync(rootEnv(root), "utf8");
    expect(readFileSync(webEnv(root), "utf8")).toBe(first);
    const values = parseEnv(first);
    expect(values.AUTH_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(values.SCHEDULER_TICK_SECRET).toMatch(/^[a-f0-9]{64}$/);
    expect(values.CREDENTIAL_ENCRYPTION_KEY).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    expect(Buffer.from(values.CREDENTIAL_ENCRYPTION_KEY, "base64")).toHaveLength(32);
    setupEnvironment(root);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(first);
    expect(readFileSync(webEnv(root), "utf8")).toBe(first);
  });

  it("reuses existing keys in the absent web file without changing existing config", () => {
    const root = fixture();
    writeFileSync(rootEnv(root), validEnvironment);
    setupEnvironment(root);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
    const values = parseEnv(readFileSync(webEnv(root), "utf8"));
    expect(values.AUTH_SECRET).toBe(authSecret);
    expect(values.SCHEDULER_TICK_SECRET).toBe(tickSecret);
    expect(values.CREDENTIAL_ENCRYPTION_KEY).toBe(encryptionKey);
  });

  it("fills a placeholder from the other file while preserving CRLF and unrelated config", () => {
    const root = fixture();
    const valid = validEnvironment.replaceAll("\n", "\r\n");
    const pending = valid.replace(tickSecret, "replace-with-tick-secret");
    writeFileSync(rootEnv(root), pending);
    writeFileSync(webEnv(root), valid);
    setupEnvironment(root);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(
      pending.replace("replace-with-tick-secret", JSON.stringify(tickSecret)),
    );
    expect(readFileSync(webEnv(root), "utf8")).toBe(valid);
  });

  it("preserves inline operator comments when generating a missing value", () => {
    const root = fixture();
    const pending = validEnvironment.replace(tickSecret, '"replace-with-tick" # operator note');
    writeFileSync(rootEnv(root), pending);
    writeFileSync(webEnv(root), validEnvironment);
    setupEnvironment(root);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(
      pending.replace('"replace-with-tick"', JSON.stringify(tickSecret)),
    );
  });

  it("rejects conflicting keys before editing either file and omits their values", () => {
    const root = fixture();
    const conflicting = validEnvironment.replace(authSecret, "c".repeat(64));
    writeFileSync(rootEnv(root), validEnvironment);
    writeFileSync(webEnv(root), conflicting);
    expect(() => setupEnvironment(root)).toThrow(/AUTH_SECRET.*conflict/i);
    try {
      setupEnvironment(root);
    } catch (error) {
      expect(String(error)).not.toContain(authSecret);
      expect(String(error)).not.toContain("c".repeat(64));
    }
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
    expect(readFileSync(webEnv(root), "utf8")).toBe(conflicting);
  });

  it("never rotates an invalid existing encryption key or edits the other file", () => {
    const root = fixture();
    const invalid = validEnvironment.replace(encryptionKey, "existing-key-with-data");
    writeFileSync(rootEnv(root), invalid);
    writeFileSync(webEnv(root), template);
    expect(() => setupEnvironment(root)).toThrow(/CREDENTIAL_ENCRYPTION_KEY.*invalid/i);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(invalid);
    expect(readFileSync(webEnv(root), "utf8")).toBe(template);
  });

  it("rejects missing assignments and placeholders in check mode without writing", () => {
    const root = fixture();
    writeFileSync(rootEnv(root), "APP_ENV=local\n");
    writeFileSync(webEnv(root), template);
    expect(() => setupEnvironment(root, { check: true })).toThrow(/AUTH_SECRET.*missing/i);
    expect(readFileSync(rootEnv(root), "utf8")).toBe("APP_ENV=local\n");
    expect(readFileSync(webEnv(root), "utf8")).toBe(template);
  });

  it("rejects duplicate secret assignments without rewriting config", () => {
    const root = fixture();
    const duplicate = `${validEnvironment}AUTH_SECRET=${authSecret}\n`;
    writeFileSync(rootEnv(root), duplicate);
    expect(() => setupEnvironment(root)).toThrow(/AUTH_SECRET.*duplicate/i);
    expect(readFileSync(rootEnv(root), "utf8")).toBe(duplicate);
  });

  it("refuses non-file env paths", () => {
    const root = fixture();
    mkdirSync(rootEnv(root));
    expect(() => setupEnvironment(root)).toThrow(/regular file/i);
  });

  it("refuses a symlinked parent before writing any env files", () => {
    const root = fixture();
    const outside = fixture();
    const parent = path.join(root, "apps/web");
    rmSync(parent, { recursive: true });
    symlinkSync(outside, parent, "junction");
    expect(() => setupEnvironment(root)).toThrow(/symlink|symbolic/i);
    expect(existsSync(rootEnv(root))).toBe(false);
    expect(existsSync(path.join(outside, ".env.local"))).toBe(false);
  });

  it("refuses a non-file template", () => {
    const root = fixture();
    rmSync(path.join(root, ".env.example"));
    mkdirSync(path.join(root, ".env.example"));
    expect(() => setupEnvironment(root)).toThrow(/regular file/i);
    expect(existsSync(rootEnv(root))).toBe(false);
  });

  it("prints safe CLI check status without any configured secret", () => {
    const root = fixture();
    writeFileSync(rootEnv(root), validEnvironment);
    writeFileSync(webEnv(root), validEnvironment);
    const script = path.resolve("scripts/setup-env.mjs");
    const output = execFileSync(process.execPath, [script, "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output).toContain("PASS");
    expect(readFileSync(rootEnv(root), "utf8")).toBe(validEnvironment);
    expect(readFileSync(webEnv(root), "utf8")).toBe(validEnvironment);
    for (const value of [authSecret, tickSecret, encryptionKey])
      expect(output).not.toContain(value);
  });
});
