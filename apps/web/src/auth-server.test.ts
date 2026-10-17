import { parseServerConfig } from "@supastack/config";
import { describe, expect, it, vi } from "vitest";

import { createWebAuthServer } from "./auth-server.js";

const unusedDatabase = {} as Parameters<typeof createWebAuthServer>[0]["database"];

describe("createWebAuthServer", () => {
  it("passes only injected server resources into auth composition", () => {
    const createAuth = vi.fn(() => ({ handler: vi.fn() }));
    const auth = createWebAuthServer({
      database: unusedDatabase,
      admitAuthMail: async () => true,
      provisionPersonalWorkspace: async () => undefined,
      sendMagicLink: async () => undefined,
      sendVerificationOTP: async () => undefined,
      serverConfig: parseServerConfig(),
      factories: { createAdapter: () => ({ adapter: "drizzle" }), createAuth },
    });

    expect(auth).toEqual({ handler: expect.any(Function) });
    expect(createAuth).toHaveBeenCalledTimes(1);
  });
});
