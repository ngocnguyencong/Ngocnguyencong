import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const store = fileURLToPath(new URL("../node_modules/.pnpm/", import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- These transitive CommonJS packages do not expose types here.
function dependency(name: string, version: string): any {
  expect(
    (require(`${store}/node_modules/${name}/package.json`) as { version: string }).version,
  ).toBe(version);
  return require(`${store}/node_modules/${name}`);
}

describe("patched dependency security", () => {
  it("keeps gray-matter's YAML parser compatible without sprintf-js", () => {
    const agentsRequire = createRequire(
      fileURLToPath(new URL("../packages/agents/package.json", import.meta.url)),
    );
    const mastraRequire = createRequire(agentsRequire.resolve("@mastra/core"));
    const grayMatterPath = mastraRequire.resolve("gray-matter");
    const grayMatterRequire = createRequire(grayMatterPath);
    const grayMatter = grayMatterRequire(grayMatterPath) as (source: string) => {
      data: Record<string, unknown>;
    };
    const yamlRequire = createRequire(grayMatterRequire.resolve("js-yaml"));
    const argparsePackagePath = yamlRequire.resolve("argparse/package.json");
    const yamlPackagePath = yamlRequire.resolve("js-yaml/package.json");
    const argparse = JSON.parse(readFileSync(argparsePackagePath, "utf8")) as {
      version: string;
    };
    const yamlCliPath = join(dirname(yamlPackagePath), "bin", "js-yaml.js");

    expect(argparse.version).toBe("2.0.1");
    expect(() => createRequire(argparsePackagePath).resolve("sprintf-js")).toThrow();
    expect(grayMatter("---\ntitle: Security regression\n---\nBody").data).toEqual({
      title: "Security regression",
    });

    const help = spawnSync(process.execPath, [yamlCliPath, "--help"], { encoding: "utf8" });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Display errors in compact mode");

    const parsed = spawnSync(process.execPath, [yamlCliPath], {
      encoding: "utf8",
      input: "title: CLI regression\n",
    });
    expect(parsed.status).toBe(0);
    expect(JSON.parse(parsed.stdout)).toEqual({ title: "CLI regression" });
  });

  it("rejects extra nested DigestAlgorithm elements while preserving valid RSA signatures", () => {
    const forge = dependency("node-forge", "1.4.0");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const key = forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" }));
    const publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
    const message = forge.md.sha256.create().update("security regression");
    const digest = message.digest().getBytes();
    expect(publicKey.verify(digest, key.sign(message))).toBe(true);
    const { asn1 } = forge;
    const algorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      asn1.create(
        asn1.Class.UNIVERSAL,
        asn1.Type.OID,
        false,
        asn1.oidToDer(forge.oids.sha256).getBytes(),
      ),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ""),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "garbage"),
    ]);
    const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
      algorithm,
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest),
    ]);
    const malformed = forge.pki.rsa.encrypt(asn1.toDer(info).getBytes(), key, 0x01);
    expect(() => publicKey.verify(digest, malformed)).toThrow(/valid.*DigestInfo/);
  });

  it.each(["{", "("])("rejects deeply nested %s patterns before walking the AST", (open) => {
    const braces = dependency("braces", "3.0.3");
    const close = open === "{" ? "}" : ")";
    expect(() => braces.parse(open.repeat(256) + "x" + close.repeat(256))).toThrow(SyntaxError);
    expect(braces.expand("src/{app,lib}/{a,b}.ts")).toEqual([
      "src/app/a.ts",
      "src/app/b.ts",
      "src/lib/a.ts",
      "src/lib/b.ts",
    ]);
  });

  it("bounds direct AST compilation and stringification", () => {
    const braces = dependency("braces", "3.0.3");
    type Ast = { type: string; value?: string; nodes?: Ast[] };
    let ast: Ast = { type: "text", value: "x" };
    for (let depth = 0; depth < 256; depth++) ast = { type: "root", nodes: [ast] };
    expect(() => braces.compile(ast)).toThrow(SyntaxError);
    expect(() => braces.stringify(ast)).toThrow(SyntaxError);
  });

  it("decodes malformed URI runs with bounded work and preserves the CommonJS API", () => {
    const decode = dependency("decode-uri-component", "0.2.2") as (value: string) => string;
    const calls = vi.spyOn(globalThis, "decodeURIComponent");
    try {
      const input = "%FF".repeat(128);
      expect(decode(input)).toBe(input);
      expect(calls.mock.calls.length).toBeLessThan(128 * 8);
      expect(decode("hello+world%20%C3%A9%FF")).toBe("hello world é%FF");
    } finally {
      calls.mockRestore();
    }
  });
});
