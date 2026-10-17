import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { listCommerceOrders, listCommerceProducts } from "../../../src/commerce-actions";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { WebCommercePage } from "../../../src/web-commerce-page";

export const dynamic = "force-dynamic";

export default async function LocaleCommercePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect("/commerce");
  }
  const [products, orders, brand] = await Promise.all([
    listCommerceProducts(),
    listCommerceOrders(),
    getRequestBrand(),
  ]);
  return (
    <WebCommercePage
      brand={brand}
      locale={locale}
      manageable={products.manageable && orders.manageable}
      orders={orders.orders}
      ordersError={orders.error}
      products={products.products}
      productsError={products.error}
    />
  );
}
