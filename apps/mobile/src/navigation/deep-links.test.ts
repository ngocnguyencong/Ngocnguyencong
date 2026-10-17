import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const loadDeepLinks = () => import("./deep-links");

test("uses the configured native scheme and rejects stale or lookalike schemes", async () => {
  vi.stubEnv("EXPO_PUBLIC_APP_SCHEME", "com.example.app");
  vi.resetModules();
  const { isAllowedProductionDeepLink, productionAuthCallbackURL } = await loadDeepLinks();
  expect(productionAuthCallbackURL).toBe("com.example.app://auth/callback");
  expect(isAllowedProductionDeepLink(productionAuthCallbackURL)).toBe(true);
  expect(isAllowedProductionDeepLink("supastack://auth/callback")).toBe(false);
  expect(isAllowedProductionDeepLink("com.example.app://auth.evil/callback")).toBe(false);
  expect(isAllowedProductionDeepLink("com.example.app://user@auth/callback")).toBe(false);
});

test("accepts only exact configured production callback origins", async () => {
  vi.stubEnv("EXPO_PUBLIC_APP_SCHEME", undefined);
  vi.resetModules();
  const { isAllowedProductionDeepLink, productionAuthCallbackURL } = await loadDeepLinks();

  expect(productionAuthCallbackURL).toBe("supastack://auth/callback");
  expect(isAllowedProductionDeepLink(productionAuthCallbackURL)).toBe(true);
  expect(isAllowedProductionDeepLink("supastack://auth/callback?code=ok")).toBe(true);
  expect(
    isAllowedProductionDeepLink("https://app.supastack.example.com/auth/callback?code=ok"),
  ).toBe(true);
  expect(
    isAllowedProductionDeepLink("https://app.supastack.example.com.evil.test/auth/callback"),
  ).toBe(false);
  expect(isAllowedProductionDeepLink("http://localhost:8081/auth/callback")).toBe(false);
});
