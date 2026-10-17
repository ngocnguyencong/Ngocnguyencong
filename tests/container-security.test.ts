import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseServerConfig } from "../packages/config/src/index";

describe("production image environment", () => {
  it.each(["local", "test", "development"])(
    "rejects local providers when an env-file overrides APP_ENV to %s",
    (appEnvironment) => {
      const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
      const runner = dockerfile.split(/^FROM /m).at(-1)!;
      const command = JSON.parse(/^CMD (.*)\r?$/m.exec(runner)![1]!) as string[];
      const forcedEnvironment = /^APP_ENV=(\w+) exec node apps\/web\/server\.js$/.exec(
        command[2] ?? "",
      )?.[1];
      expect(() =>
        parseServerConfig({
          NODE_ENV: "production",
          APP_ENV: forcedEnvironment ?? appEnvironment,
          EMAIL_PROVIDER: "local",
          BILLING_PROVIDER: "local",
        }),
      ).toThrow();
    },
  );
  it("compiles without production credentials in the separate build stage", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    const build = dockerfile.split(/^FROM /m).find((stage) => stage.startsWith("deps AS build"))!;
    const environment = /^RUN APP_ENV=(\w+) pnpm --filter @supastack\/web build\r?$/m.exec(
      build,
    )?.[1];
    expect(environment).toBeDefined();
    expect(
      parseServerConfig({ NODE_ENV: "production", APP_ENV: environment }).app.environment,
    ).toBe("local");
  });
  it("rejects an unconfigured final image rather than accepting local provider defaults", () => {
    const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
    const runner = dockerfile.split(/^FROM /m).at(-1)!;
    const environment: Record<string, string> = {};
    for (const line of runner.split(/\r?\n/)) {
      const setting = /^ENV ([A-Z_]+)=(.*)$/.exec(line);
      if (setting) environment[setting[1]!] = setting[2]!;
    }
    expect(() => parseServerConfig(environment)).toThrow();
  });
});

describe("published Compose services", () => {
  const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const service = (name: string) => {
    const block = new RegExp(`^  ${name}:\\r?\\n([\\s\\S]*?)(?=^  [\\w-]+:|^volumes:)`, "m");
    return block.exec(compose)?.[1] ?? "";
  };

  it("binds Postgres, the app, and MinIO to host loopback", () => {
    expect(service("postgres")).toContain('"127.0.0.1:5432:5432"');
    expect(service("web")).toContain('"127.0.0.1:3000:8080"');
    expect(service("minio")).toContain('"127.0.0.1:9000:9000"');
    expect(service("minio")).toContain('"127.0.0.1:9001:9001"');
  });

  it("allows production Postgres and MinIO credentials while retaining local defaults", () => {
    expect(service("postgres")).toMatch(
      /^ {6}POSTGRES_PASSWORD: \$\{POSTGRES_PASSWORD:-supastack\}$/m,
    );
    expect(service("minio")).toMatch(/^ {6}MINIO_ROOT_USER: \$\{MINIO_ROOT_USER:-supastack\}$/m);
    expect(service("minio")).toMatch(
      /^ {6}MINIO_ROOT_PASSWORD: \$\{MINIO_ROOT_PASSWORD:-supastack\}$/m,
    );
  });
});
