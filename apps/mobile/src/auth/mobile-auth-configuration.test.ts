import { afterEach, expect, test, vi } from "vitest";

vi.mock("@better-auth/expo/client", () => ({ expoClient: (options: unknown) => options }));
vi.mock("better-auth/react", () => ({ createAuthClient: (options: unknown) => options }));
vi.mock("better-auth/client/plugins", () => ({ emailOTPClient: () => ({ id: "email-otp" }) }));
vi.mock("expo-secure-store", () => ({ getItem: vi.fn(), setItem: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("projects the same configured scheme into manifest, auth client, and callback", async () => {
  vi.stubEnv("EXPO_PUBLIC_APP_SCHEME", "com.example.app");
  vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.example.test");
  const { default: configureExpo } = await import("../../app.config");
  const { createMobileAuthClient, mobileAuthApiUrl } = await import("./client");
  const { productionAuthCallbackURL, productionDeepLinkOrigins } =
    await import("../navigation/deep-links");
  const manifest = configureExpo({ config: { name: "Consumer", slug: "consumer" } });
  expect(manifest.scheme).toBe("com.example.app");
  expect(manifest.name).toBe("Consumer");
  expect(manifest.extra?.productionDeepLinkOrigins).toEqual(productionDeepLinkOrigins);
  expect(productionAuthCallbackURL).toBe(`${manifest.scheme as string}://auth/callback`);
  expect(mobileAuthApiUrl).toBe("https://api.example.test");
  expect(createMobileAuthClient("https://api.example.test")).toMatchObject({
    plugins: [{ id: "email-otp" }, { scheme: manifest.scheme }],
  });
});

test("defaults to the existing supastack scheme", async () => {
  vi.stubEnv("EXPO_PUBLIC_APP_SCHEME", undefined);
  const { createMobileAuthConfiguration } = await import("./mobile-auth-configuration");
  expect(createMobileAuthConfiguration().callbackURL).toBe("supastack://auth/callback");
});

test.each([
  "",
  "https",
  "http",
  "file",
  "javascript",
  "data",
  "exp",
  "exps",
  "custom://auth",
  "Custom",
  "custom*",
  " custom",
])("rejects unsafe native scheme %j", async (scheme) => {
  const { createMobileAuthConfiguration } = await import("./mobile-auth-configuration");
  expect(() => createMobileAuthConfiguration(scheme)).toThrow("native URI scheme");
});
