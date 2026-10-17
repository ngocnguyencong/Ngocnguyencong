import { parseServerConfig } from "@supastack/config";
import { headers } from "next/headers";

import { ProductionReferenceApp } from "../../src/production-reference-app";
import { ReferenceApp } from "../../src/reference-app";
import { getReferenceMode } from "../../src/reference-mode";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { getGithubConnection } from "../../src/auth-runtime";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const mode = getReferenceMode(parseServerConfig());
  const brand = await getRequestBrand();
  if (mode.mode === "local") return <ReferenceApp brand={brand} />;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${proto}://${host.split(",")[0]!.trim()}` : "";
  return (
    <ProductionReferenceApp
      aiEnabled={mode.aiEnabled}
      aliases={mode.aliases}
      brand={brand}
      githubApiUrl={requestOrigin}
      githubCallbackURL={`${requestOrigin}/ai`}
      githubConnection={await getGithubConnection(requestHeaders)}
    />
  );
}
