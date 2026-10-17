import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("OpenAPI docs UI route", () => {
  it("serves Scalar HTML pointed at the typed OpenAPI JSON", () => {
    const source = readFileSync(join(webRoot, "app/api/docs/route.ts"), "utf8");
    expect(source).toContain("/api/v1/openapi");
    expect(source).toContain("@scalar/api-reference");
    expect(source).toContain("text/html");
  });
});
