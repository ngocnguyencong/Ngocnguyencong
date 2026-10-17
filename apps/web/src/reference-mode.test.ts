import { afterEach, describe, expect, it, vi } from "vitest";
import { parseServerConfig } from "@supastack/config";
import { getReferenceMode } from "./reference-mode";

describe("reference interface configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not render the local reference UI in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getReferenceMode(parseServerConfig({}))).toEqual({
      mode: "production",
      aiEnabled: false,
      aliases: ["fast", "smart", "cheap"],
    });
  });

  it("preserves the credential-free local demo", () => {
    expect(getReferenceMode(parseServerConfig({}))).toEqual({ mode: "local" });
  });

  it("never uses automatic demo entitlement in a deployed environment", () => {
    const config = parseServerConfig({});
    for (const environment of ["development", "production"] as const) {
      expect(getReferenceMode({ ...config, app: { ...config.app, environment } })).toEqual({
        mode: "production",
        aiEnabled: false,
        aliases: ["fast", "smart", "cheap"],
      });
    }
  });

  it("switches to real UI when a provider is configured, without requiring a worker", () => {
    expect(
      getReferenceMode(parseServerConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-only" })),
    ).toEqual({ mode: "production", aiEnabled: false, aliases: ["fast", "smart", "cheap"] });
  });

  it("projects only enabled alias names and enables submission with Trigger", () => {
    const config = parseServerConfig({});
    expect(
      getReferenceMode({
        ...config,
        aiRouting: { fast: [], smart: ["private-model"], cheap: [] },
        providers: {
          ...config.providers,
          jobs: { kind: "trigger", secretKey: "secret", projectRef: "project" },
        },
      }),
    ).toEqual({ mode: "production", aiEnabled: true, aliases: ["smart"] });
  });

  it("disables submission when every alias is disabled", () => {
    const config = parseServerConfig({
      APP_ENV: "development",
      AI_MODEL_POLICY: '{"fast":[],"smart":[],"cheap":[]}',
    });
    expect(
      getReferenceMode({
        ...config,
        providers: {
          ...config.providers,
          jobs: { kind: "trigger", secretKey: "secret", projectRef: "project" },
        },
      }),
    ).toEqual({ mode: "production", aiEnabled: false, aliases: [] });
  });
});
