import console from "node:console";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const STARTER_IDENTIFIER = "com.supastack.desktop";
const TAURI_CONFIG = new URL("../src-tauri/tauri.conf.json", import.meta.url);
const UPDATER_VERSION_TOKEN = "{{current_version}}";
const UPDATER_PLATFORM_TOKENS = ["{{target}}", "{{arch}}"];
// Optional release-channel placeholder (`stable`/`beta`) — substituted by
// the desktop shell at update-check time, so it only belongs in the path.
export const UPDATER_CHANNEL_TOKEN = "{{channel}}";
const UPDATER_PUBKEY_MIN_LENGTH = 40;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isSet(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isIpv4InRange(address, network, prefix) {
  const toNumber = (value) =>
    value.split(".").reduce((total, octet) => (total << 8) | Number(octet), 0) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (toNumber(address) & mask) === (toNumber(network) & mask);
}

function isValidPublicDnsName(host) {
  const labels = host.split(".");
  return (
    labels.length >= 2 &&
    host.length <= 253 &&
    labels.every(
      (label) =>
        label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
  );
}

function isLocalOrReservedHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".corp") ||
    host.endsWith(".home") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".lan") ||
    host.endsWith(".test") ||
    host.endsWith(".example") ||
    host.endsWith(".invalid")
  ) {
    return true;
  }

  const address = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const family = isIP(address);
  if (family === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([network, prefix]) => isIpv4InRange(address, network, prefix));
  }
  if (family === 6) {
    const normalizedAddress = address.toLowerCase();
    return (
      normalizedAddress === "::" ||
      normalizedAddress === "::1" ||
      normalizedAddress.startsWith("::ffff:") ||
      /^(?:fc|fd)[0-9a-f]{2}:/.test(normalizedAddress) ||
      /^fe[89ab][0-9a-f]:/.test(normalizedAddress) ||
      normalizedAddress.startsWith("2001:db8:")
    );
  }

  return !isValidPublicDnsName(host);
}

function isReverseDomainIdentifier(identifier) {
  if (typeof identifier !== "string") return false;
  const labels = identifier.split(".");
  return (
    labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
  );
}

export function validateReleaseConfiguration({
  appUrl,
  identifier,
  updaterEndpoint,
  updaterPubkey,
}) {
  const errors = [];
  const warnings = [];
  let parsedUrl;

  if (typeof appUrl !== "string" || appUrl.trim() === "") {
    errors.push("Set SUPASTACK_APP_URL to a public HTTPS URL before a release build.");
  } else {
    try {
      parsedUrl = new URL(appUrl);
    } catch {
      errors.push("SUPASTACK_APP_URL must be a valid absolute HTTPS URL.");
    }
  }

  if (parsedUrl) {
    if (parsedUrl.protocol !== "https:") {
      errors.push("SUPASTACK_APP_URL must use HTTPS.");
    }
    if (parsedUrl.username || parsedUrl.password) {
      errors.push("SUPASTACK_APP_URL must not contain credentials.");
    }
    if (isLocalOrReservedHost(parsedUrl.hostname)) {
      errors.push("SUPASTACK_APP_URL must use a publicly reachable host.");
    }
  }

  if (!isReverseDomainIdentifier(identifier)) {
    errors.push("The Tauri bundle identifier must be a valid reverse-domain identifier.");
  } else if (identifier.toLowerCase() === STARTER_IDENTIFIER) {
    errors.push(
      `Replace the starter bundle identifier (${STARTER_IDENTIFIER}) with one you control.`,
    );
  }

  const hasEndpoint = isSet(updaterEndpoint);
  const hasPubkey = isSet(updaterPubkey);
  if (hasEndpoint !== hasPubkey) {
    errors.push(
      hasEndpoint
        ? "SUPASTACK_UPDATER_PUBKEY is required when SUPASTACK_UPDATER_ENDPOINT is set."
        : "SUPASTACK_UPDATER_ENDPOINT is required when SUPASTACK_UPDATER_PUBKEY is set.",
    );
  }

  if (hasEndpoint) {
    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(updaterEndpoint);
    } catch {
      errors.push("SUPASTACK_UPDATER_ENDPOINT must be a valid absolute HTTPS URL.");
    }
    if (parsedEndpoint) {
      if (parsedEndpoint.protocol !== "https:") {
        errors.push("SUPASTACK_UPDATER_ENDPOINT must use HTTPS.");
      }
      if (parsedEndpoint.username || parsedEndpoint.password) {
        errors.push("SUPASTACK_UPDATER_ENDPOINT must not contain credentials.");
      }
      if (isLocalOrReservedHost(parsedEndpoint.hostname)) {
        errors.push("SUPASTACK_UPDATER_ENDPOINT must use a publicly reachable host.");
      }
    }
    // Placeholder tokens are checked on the raw value — URL parsing
    // percent-encodes the braces in the path.
    if (!updaterEndpoint.includes(UPDATER_VERSION_TOKEN)) {
      errors.push(`SUPASTACK_UPDATER_ENDPOINT must contain ${UPDATER_VERSION_TOKEN}.`);
    }
    const missingPlatformTokens = UPDATER_PLATFORM_TOKENS.filter(
      (token) => !updaterEndpoint.includes(token),
    );
    if (missingPlatformTokens.length > 0) {
      warnings.push(
        `SUPASTACK_UPDATER_ENDPOINT does not contain ${missingPlatformTokens.join(" and ")}; ` +
          `the documented static update endpoint shape is ` +
          `…/${UPDATER_PLATFORM_TOKENS.join("/")}/${UPDATER_VERSION_TOKEN}.`,
      );
    }
  }

  if (hasPubkey) {
    const pubkey = updaterPubkey.trim();
    if (pubkey.length < UPDATER_PUBKEY_MIN_LENGTH || !BASE64_PATTERN.test(pubkey)) {
      errors.push("SUPASTACK_UPDATER_PUBKEY must be a base64 minisign public key.");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Builds the `--config` overlay that injects updater endpoints and the
 * minisign public key into `plugins.updater` at build time.
 */
export function buildUpdaterConfigOverlay({ updaterEndpoint, updaterPubkey }) {
  return JSON.stringify({
    plugins: {
      updater: {
        endpoints: [updaterEndpoint.trim()],
        pubkey: updaterPubkey.trim(),
      },
    },
  });
}

function readTauriConfig() {
  const configPath = fileURLToPath(TAURI_CONFIG);
  return JSON.parse(readFileSync(configPath, "utf8"));
}

export function checkDesktopReleaseConfiguration({
  appUrl = process.env.SUPASTACK_APP_URL,
  updaterEndpoint = process.env.SUPASTACK_UPDATER_ENDPOINT,
  updaterPubkey = process.env.SUPASTACK_UPDATER_PUBKEY,
  config = readTauriConfig(),
} = {}) {
  return validateReleaseConfiguration({
    appUrl,
    identifier: config.identifier,
    updaterEndpoint,
    updaterPubkey,
  });
}

function main() {
  const result = checkDesktopReleaseConfiguration();
  for (const warning of result.warnings) console.warn(`Warning: ${warning}`);

  if (result.valid) {
    const appOrigin = new URL(process.env.SUPASTACK_APP_URL).origin;
    console.log(`Desktop release configuration is ready for ${appOrigin}.`);
    const { SUPASTACK_UPDATER_ENDPOINT, SUPASTACK_UPDATER_PUBKEY } = process.env;
    if (isSet(SUPASTACK_UPDATER_ENDPOINT) && isSet(SUPASTACK_UPDATER_PUBKEY)) {
      console.log("Updater config detected — pass this overlay to 'tauri build --config':");
      console.log(
        buildUpdaterConfigOverlay({
          updaterEndpoint: SUPASTACK_UPDATER_ENDPOINT,
          updaterPubkey: SUPASTACK_UPDATER_PUBKEY,
        }),
      );
    } else {
      console.log("Updater is not configured — builds report updates as unconfigured.");
    }
    console.log("Configure platform signing separately before distributing installers.");
    return;
  }

  console.error("Desktop release configuration needs attention:");
  for (const error of result.errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) main();
