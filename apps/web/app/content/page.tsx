import { listContentEntries } from "../../src/content-actions";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { WebContentPage } from "../../src/web-content-page";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  const [result, brand] = await Promise.all([listContentEntries(), getRequestBrand()]);
  return (
    <WebContentPage
      brand={brand}
      entries={result.entries}
      error={result.error}
      writable={result.writable}
    />
  );
}
