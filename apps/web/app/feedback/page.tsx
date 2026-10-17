import { listFeatureRequests } from "../../src/feature-board-actions";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { WebFeatureBoardPage } from "../../src/web-feature-board-page";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const [result, brand] = await Promise.all([listFeatureRequests(), getRequestBrand()]);
  return (
    <WebFeatureBoardPage
      brand={brand}
      canManage={result.canManage}
      canWrite={result.canWrite}
      error={result.error}
      myVoteIds={result.myVoteIds}
      requests={result.requests}
    />
  );
}
