import { listCommerceOrders, listCommerceProducts } from "../../src/commerce-actions";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { WebCommercePage } from "../../src/web-commerce-page";

export const dynamic = "force-dynamic";

export default async function CommercePage() {
  const [products, orders, brand] = await Promise.all([
    listCommerceProducts(),
    listCommerceOrders(),
    getRequestBrand(),
  ]);
  return (
    <WebCommercePage
      brand={brand}
      manageable={products.manageable && orders.manageable}
      orders={orders.orders}
      ordersError={orders.error}
      products={products.products}
      productsError={products.error}
    />
  );
}
