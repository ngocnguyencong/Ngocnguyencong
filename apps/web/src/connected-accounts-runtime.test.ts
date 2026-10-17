import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));
vi.mock("./audit-runtime", () => ({
  recordAuditEvent: vi.fn(),
  recordSystemAuditEvent: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: { captureException: vi.fn(), track: vi.fn() },
}));
vi.stubEnv("CONNECTED_X_CLIENT_ID", "x-test-client-id");
// A malformed key must never 500 a route — the callback wrapper maps vault
// construction failures onto the generic error status.
vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "not-a-valid-base64-key!!");

describe("connected-accounts-runtime", () => {
  // The first import can exceed Vitest's 5s default during a cold full-suite Windows run.
  it("maps provider env config onto ConnectedAccountProviderConfig", async () => {
    const runtime = await import("./connected-accounts-runtime.js");

    expect(runtime.connectedAccountProviderConfig("x")).toEqual({
      clientId: "x-test-client-id",
      enabled: true,
    });
    expect(runtime.connectedAccountProviderConfig("google")).toEqual({ enabled: false });
    expect(runtime.connectedAccountProviderConfig("microsoft")).toEqual({ enabled: false });
    // Non-OAuth providers (smtp rows, future providers) resolve disabled.
    expect(runtime.connectedAccountProviderConfig("smtp")).toEqual({ enabled: false });
  }, 15_000);

  it("re-exports the smtp identity helper for K3's save action", async () => {
    const { smtpExternalAccountId } = await import("./connected-accounts-runtime.js");
    expect(smtpExternalAccountId("SMTP.Example.TEST ", " ada@x.test")).toBe(
      "smtp.example.test:ada@x.test",
    );
  });

  it("maps an invalid CREDENTIAL_ENCRYPTION_KEY onto a generic callback error", async () => {
    const runtime = await import("./connected-accounts-runtime.js");

    // The stubbed key fails ConnectedAccountVault construction — the wrapper
    // must catch it instead of letting ConnectedAccountVaultError 500 the route.
    const outcome = await runtime.handleConnectedAccountCallback({
      actorUserId: "user_1",
      code: "auth-code",
      origin: "http://localhost:3000",
      provider: "x",
      providerError: null,
      state: "csrf-state",
      stateCookieValue: "any.thing",
      workspaceId: "ws_1",
    });
    expect(outcome).toEqual({ returnTo: "/settings/connections", status: "error" });
  });
});
