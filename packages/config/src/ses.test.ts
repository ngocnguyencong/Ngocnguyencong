import { describe, expect, it } from "vitest";
import { parsePublicConfig, parseServerConfig } from "./index.js";

describe("SES SDK credentials", () => {
  it.each([undefined, "", " "])(
    "uses the SDK default credential chain with blank keys (%j)",
    (key) => {
      const email = parseServerConfig({
        EMAIL_PROVIDER: "ses",
        AWS_ACCESS_KEY_ID: key,
        AWS_SECRET_ACCESS_KEY: key,
        AWS_SESSION_TOKEN: key,
      }).providers.email;
      expect(email).toMatchObject({ kind: "ses", region: "us-east-1" });
      expect(email).not.toHaveProperty("accessKeyId");
      expect(email).not.toHaveProperty("secretAccessKey");
      expect(email).not.toHaveProperty("sessionToken");
    },
  );
  it("preserves explicit IAM API credentials", () => {
    expect(
      parseServerConfig({
        EMAIL_PROVIDER: "ses",
        AWS_ACCESS_KEY_ID: " sdk-key ",
        AWS_SECRET_ACCESS_KEY: " sdk-secret ",
        AWS_REGION: "eu-west-1",
      }).providers.email,
    ).toMatchObject({ accessKeyId: "sdk-key", secretAccessKey: "sdk-secret", region: "eu-west-1" });
  });
  it("keeps a temporary session token server-only", () => {
    const config = parseServerConfig({
      EMAIL_PROVIDER: "ses",
      AWS_ACCESS_KEY_ID: "sdk-key",
      AWS_SECRET_ACCESS_KEY: "sdk-secret",
      AWS_SESSION_TOKEN: " temporary-token ",
    });
    expect(config.providers.email).toMatchObject({ sessionToken: "temporary-token" });
    const publicText = JSON.stringify(parsePublicConfig(config));
    for (const value of ["sdk-key", "sdk-secret", "temporary-token", "sessionToken"])
      expect(publicText).not.toContain(value);
  });
  it.each([
    { AWS_ACCESS_KEY_ID: "sdk-key" },
    { AWS_SECRET_ACCESS_KEY: "sdk-secret" },
    { AWS_SESSION_TOKEN: "temporary-token" },
  ])("rejects incomplete explicit SDK credentials (%j)", (credentials) => {
    expect(() => parseServerConfig({ EMAIL_PROVIDER: "ses", ...credentials })).toThrow(
      /AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)/,
    );
  });
});
