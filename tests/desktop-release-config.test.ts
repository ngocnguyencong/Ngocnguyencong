import { describe, expect, it } from "vitest";
import {
  buildUpdaterConfigOverlay,
  checkDesktopReleaseConfiguration,
  validateReleaseConfiguration,
} from "../apps/desktop/scripts/check-release-config.mjs";

const validRelease = {
  appUrl: "https://app.acme.com",
  identifier: "com.acme.product",
};

const validUpdater = {
  updaterEndpoint: "https://releases.acme.com/{{target}}/{{arch}}/{{current_version}}",
  updaterPubkey: "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDFCMkMzRDhGNzU2MDkwMTIK",
};

describe("desktop release configuration", () => {
  it("accepts a product-specific identifier and public HTTPS app URL", () => {
    expect(validateReleaseConfiguration(validRelease)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it("requires a credential-free HTTPS URL", () => {
    expect(
      validateReleaseConfiguration({ ...validRelease, appUrl: "http://app.acme.test" }).valid,
    ).toBe(false);
    expect(
      validateReleaseConfiguration({
        ...validRelease,
        appUrl: "https://user:secret@app.acme.test",
      }).valid,
    ).toBe(false);
    expect(validateReleaseConfiguration({ ...validRelease, appUrl: "not a URL" }).valid).toBe(
      false,
    );
    const credentialErrors = validateReleaseConfiguration({
      ...validRelease,
      appUrl: "https://user:secret@app.acme.com",
    }).errors;
    expect(credentialErrors.join(" ")).toContain("credentials");
    expect(credentialErrors.join(" ")).not.toContain("secret");
  });

  it("rejects hostnames that are not valid public DNS names", () => {
    for (const appUrl of [
      "https://bad_label.acme.com",
      "https://bad-.acme.com",
      "https://acme..com",
    ]) {
      expect(validateReleaseConfiguration({ ...validRelease, appUrl }).valid, appUrl).toBe(false);
    }
  });

  it("rejects localhost, loopback, link-local, and private app hosts", () => {
    for (const appUrl of [
      "https://localhost",
      "https://desktop.localhost",
      "https://127.0.0.1",
      "https://10.10.0.8",
      "https://192.168.1.20",
      "https://169.254.10.4",
      "https://100.64.10.4",
      "https://192.0.2.15",
      "https://198.18.0.3",
      "https://203.0.113.25",
      "https://224.0.0.1",
      "https://[::1]",
      "https://[fd00::1]",
      "https://[2001:db8::1]",
    ]) {
      expect(validateReleaseConfiguration({ ...validRelease, appUrl }).valid, appUrl).toBe(false);
    }
  });

  it("requires a valid non-starter bundle identifier", () => {
    expect(
      validateReleaseConfiguration({ ...validRelease, identifier: "com.supastack.desktop" }).valid,
    ).toBe(false);
    expect(
      validateReleaseConfiguration({ ...validRelease, identifier: "Acme Product" }).valid,
    ).toBe(false);
  });

  it("reads the real Tauri identifier for its explicit preflight", () => {
    const result = checkDesktopReleaseConfiguration({
      appUrl: validRelease.appUrl,
      updaterEndpoint: "",
      updaterPubkey: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("com.supastack.desktop");
  });

  it("accepts a fully configured updater endpoint and minisign pubkey", () => {
    expect(validateReleaseConfiguration({ ...validRelease, ...validUpdater })).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
  });

  it("requires endpoint and pubkey as a pair", () => {
    const missingKey = validateReleaseConfiguration({
      ...validRelease,
      updaterEndpoint: validUpdater.updaterEndpoint,
    });
    expect(missingKey.valid).toBe(false);
    expect(missingKey.errors.join(" ")).toContain("SUPASTACK_UPDATER_PUBKEY");

    const missingEndpoint = validateReleaseConfiguration({
      ...validRelease,
      updaterPubkey: validUpdater.updaterPubkey,
    });
    expect(missingEndpoint.valid).toBe(false);
    expect(missingEndpoint.errors.join(" ")).toContain("SUPASTACK_UPDATER_ENDPOINT");
  });

  it("requires a credential-free HTTPS update endpoint", () => {
    for (const updaterEndpoint of [
      "http://releases.acme.com/{{target}}/{{arch}}/{{current_version}}",
      "https://user:secret@releases.acme.com/{{target}}/{{arch}}/{{current_version}}",
      "not a URL",
    ]) {
      const result = validateReleaseConfiguration({
        ...validRelease,
        ...validUpdater,
        updaterEndpoint,
      });
      expect(result.valid, updaterEndpoint).toBe(false);
    }
  });

  it("rejects local or reserved hosts for the update endpoint", () => {
    for (const updaterEndpoint of [
      "https://localhost/{{target}}/{{arch}}/{{current_version}}",
      "https://releases.internal/{{target}}/{{arch}}/{{current_version}}",
      "https://192.168.1.10/{{target}}/{{arch}}/{{current_version}}",
    ]) {
      const result = validateReleaseConfiguration({
        ...validRelease,
        ...validUpdater,
        updaterEndpoint,
      });
      expect(result.valid, updaterEndpoint).toBe(false);
      expect(result.errors.join(" ")).toContain("publicly reachable");
    }
  });

  it("requires the current-version token and warns about missing platform tokens", () => {
    const noVersion = validateReleaseConfiguration({
      ...validRelease,
      ...validUpdater,
      updaterEndpoint: "https://releases.acme.com/latest.json",
    });
    expect(noVersion.valid).toBe(false);
    expect(noVersion.errors.join(" ")).toContain("{{current_version}}");

    const noPlatform = validateReleaseConfiguration({
      ...validRelease,
      ...validUpdater,
      updaterEndpoint: "https://releases.acme.com/desktop/{{current_version}}",
    });
    expect(noPlatform.valid).toBe(true);
    expect(noPlatform.warnings.join(" ")).toContain("{{target}}");
    expect(noPlatform.warnings.join(" ")).toContain("{{arch}}");
  });

  it("rejects pubkeys that do not look like base64 minisign keys", () => {
    for (const updaterPubkey of [
      "short",
      "not-a-base64-key-value-that-is-long-enough-to-pass-length",
      `${"A".repeat(39)} `,
    ]) {
      const result = validateReleaseConfiguration({
        ...validRelease,
        ...validUpdater,
        updaterPubkey,
      });
      expect(result.valid, updaterPubkey).toBe(false);
      expect(result.errors.join(" ")).toContain("SUPASTACK_UPDATER_PUBKEY");
    }
  });

  it("accepts an optional {{channel}} placeholder in the endpoint path", () => {
    const channeled = validateReleaseConfiguration({
      ...validRelease,
      ...validUpdater,
      updaterEndpoint:
        "https://releases.acme.com/{{channel}}/{{target}}/{{arch}}/{{current_version}}",
    });
    expect(channeled).toEqual({ valid: true, errors: [], warnings: [] });
    // Endpoints without the placeholder remain valid — one shared feed.
    expect(validateReleaseConfiguration({ ...validRelease, ...validUpdater })).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    });
    // The channel name is substituted into the URL path at check time, so
    // a placeholder in the host is still rejected as unreachable.
    const hostChannel = validateReleaseConfiguration({
      ...validRelease,
      ...validUpdater,
      updaterEndpoint:
        "https://{{channel}}.releases.acme.com/{{target}}/{{arch}}/{{current_version}}",
    });
    expect(hostChannel.valid).toBe(false);
  });

  it("emits the plugins.updater overlay for a build-time config injection", () => {
    const overlay = JSON.parse(
      buildUpdaterConfigOverlay({
        updaterEndpoint: validUpdater.updaterEndpoint,
        updaterPubkey: validUpdater.updaterPubkey,
      }),
    );
    expect(overlay).toEqual({
      plugins: {
        updater: {
          endpoints: [validUpdater.updaterEndpoint],
          pubkey: validUpdater.updaterPubkey,
        },
      },
    });
  });

  it("plumbs the updater env vars through the CLI check", () => {
    const result = checkDesktopReleaseConfiguration({
      ...validRelease,
      updaterEndpoint: validUpdater.updaterEndpoint,
      updaterPubkey: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("SUPASTACK_UPDATER_PUBKEY");
  });
});
