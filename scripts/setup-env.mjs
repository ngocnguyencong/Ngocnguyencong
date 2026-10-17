#!/usr/bin/env node
import { Buffer } from "node:buffer";
import { error, log } from "node:console";
import { randomBytes, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const secretKeys = ["AUTH_SECRET", "SCHEDULER_TICK_SECRET", "CREDENTIAL_ENCRYPTION_KEY"];
const needsValue = (value) => !value || value.startsWith("replace-with-");
const assignmentPattern = (key) =>
  new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*\\r?$`, "gm");

function inspectPath(root, relative) {
  const parts = relative.split("/");
  let filename = root;
  for (let i = 0; i < parts.length; i++) {
    filename = path.join(filename, parts[i]);
    let stat;
    try {
      stat = lstatSync(filename);
    } catch (err) {
      if (err.code === "ENOENT") return undefined;
      throw err;
    }
    if (stat.isSymbolicLink()) throw new Error(`${relative} must not use a symlink path.`);
    if (i < parts.length - 1) {
      if (!stat.isDirectory()) throw new Error(`${relative} requires directory parents.`);
    } else {
      if (!stat.isFile()) throw new Error(`${relative} must be a regular file.`);
      return stat;
    }
  }
}

function inlineComment(line) {
  const contents = line.replace(/\r$/, "");
  let quote;
  for (let i = contents.indexOf("=") + 1; i < contents.length; i++) {
    const character = contents[i];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (["'", '"', "`"].includes(character)) {
      quote = character;
    } else if (character === "#") {
      const whitespace = /[ \t]*$/.exec(contents.slice(0, i))[0];
      return contents.slice(i - whitespace.length);
    }
  }
  return "";
}

function isValid(key, value) {
  if (/[\r\n]/.test(value)) return false;
  if (key !== "CREDENTIAL_ENCRYPTION_KEY") return value.length >= 32;
  return (
    /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, "base64").toString("base64") === value
  );
}

function setValue(source, key, value) {
  const assignment = `${key}=${JSON.stringify(value)}`;
  if (parseEnv(assignment)[key] !== value) {
    throw new Error(`${key} cannot be synchronized automatically; existing values were preserved.`);
  }
  const pattern = assignmentPattern(key);
  if (pattern.test(source)) {
    return source.replace(
      pattern,
      (matched) => `${assignment}${inlineComment(matched)}${matched.endsWith("\r") ? "\r" : ""}`,
    );
  }
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return `${source}${source && !source.endsWith("\n") ? newline : ""}${assignment}${newline}`;
}

/** Bootstrap only missing secrets; validate both files before any writes. */
export function setupEnvironment(root, { check = false } = {}) {
  root = path.resolve(root);
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error("The checkout root must be a directory without a symlink.");
  }
  if (!inspectPath(root, ".env.example"))
    throw new Error(".env.example is missing from the checkout.");
  const template = readFileSync(path.join(root, ".env.example"), "utf8");
  const inventory = parseEnv(template);
  for (const key of secretKeys) {
    if (!(key in inventory)) throw new Error(`.env.example is missing the ${key} declaration.`);
  }

  const files = [".env", "apps/web/.env.local"].map((relative) => {
    const filename = path.join(root, relative);
    const stat = inspectPath(root, relative);
    if (check && !stat) throw new Error(`${relative} is missing; run setup first.`);
    const source = stat ? readFileSync(filename, "utf8") : template;
    const values = parseEnv(source);
    for (const key of secretKeys) {
      if ([...source.matchAll(assignmentPattern(key))].length > 1) {
        throw new Error(`${key} has duplicate assignments in ${relative}; no files were changed.`);
      }
    }
    return { filename, relative, source, values, exists: Boolean(stat) };
  });

  const chosen = new Map();
  for (const key of secretKeys) {
    const existing = [];
    for (const file of files) {
      const value = file.values[key];
      if (needsValue(value)) {
        if (check) throw new Error(`${key} is missing or a placeholder in ${file.relative}.`);
      } else {
        if (!isValid(key, value)) {
          throw new Error(`${key} is invalid in ${file.relative}; existing values were preserved.`);
        }
        existing.push(value);
      }
    }
    if (new Set(existing).size > 1) {
      throw new Error(`${key} values conflict between env files; no files were changed.`);
    }
    chosen.set(
      key,
      existing[0] ??
        randomBytes(32).toString(key === "CREDENTIAL_ENCRYPTION_KEY" ? "base64" : "hex"),
    );
  }

  const planned = files.map((file) => {
    let contents = file.source;
    for (const key of secretKeys) {
      if (needsValue(file.values[key])) contents = setValue(contents, key, chosen.get(key));
    }
    return { ...file, contents };
  });
  if (check) return { changedFiles: [] };

  const changedFiles = [];
  for (const file of planned) {
    if (file.exists && file.contents === file.source) continue;
    mkdirSync(path.dirname(file.filename), { recursive: true });
    const temporary = path.join(path.dirname(file.filename), `.env.setup-tmp-${randomUUID()}`);
    try {
      writeFileSync(temporary, file.contents, { flag: "wx", mode: 0o600 });
      renameSync(temporary, file.filename);
      changedFiles.push(file.relative);
    } finally {
      if (existsSync(temporary)) rmSync(temporary);
    }
  }
  return { changedFiles };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) {
      throw new Error("Usage: node scripts/setup-env.mjs [--check]");
    }
    setupEnvironment(process.cwd(), { check: args[0] === "--check" });
    log("PASS: env files have synchronized valid secrets; existing valid values preserved.");
  } catch (err) {
    error(`FAIL: ${err instanceof Error ? err.message : "Environment setup could not complete."}`);
    process.exitCode = 1;
  }
}
