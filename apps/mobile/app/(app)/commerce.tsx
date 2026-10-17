import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import {
  allowedOrderTransitions,
  createMobileCommerceActions,
  formatCents,
  type CommerceOrder,
  type CommerceOrderStatus,
  type CommerceProduct,
} from "../../src/commerce/client";
import { readCachedOrFetch } from "../../src/offline/cached-read";
import { useRequiredMobileApp } from "../../src/session/provider";
import { OfflineNotice } from "../../src/ui/offline-notice";
import {
  AppButton,
  AppInput,
  Badge,
  Card,
  Detail,
  ErrorText,
  FieldLabel,
  H1,
  ListRow,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "../../src/ui/screen";

type Pane = "orders" | "products";

/** Cache-written payloads are self-validated — light shape checks drop corrupted entries. */
function parseProductList(value: unknown): { manageable: boolean; products: CommerceProduct[] } {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { products?: unknown }).products)
  ) {
    return {
      manageable: (value as { manageable?: unknown }).manageable === true,
      products: (value as { products: CommerceProduct[] }).products,
    };
  }
  throw new Error("The cached product list was invalid.");
}

function parseOrderList(value: unknown): { manageable: boolean; orders: CommerceOrder[] } {
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { orders?: unknown }).orders)
  ) {
    return {
      manageable: (value as { manageable?: unknown }).manageable === true,
      orders: (value as { orders: CommerceOrder[] }).orders,
    };
  }
  throw new Error("The cached order list was invalid.");
}

/** Mirrors `ORDER_STATUS_LABELS` in `apps/web/src/web-commerce-page.tsx`. */
const ORDER_STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancel",
  fulfilled: "Mark fulfilled",
  paid: "Mark paid",
  refunded: "Refund",
};

export default function CommerceScreen() {
  const { api, offlineCache, offlineScope, styles } = useRequiredMobileApp();
  const commerce = useMemo(() => createMobileCommerceActions(api), [api]);

  const [pane, setPane] = useState<Pane>("products");
  const [products, setProducts] = useState<CommerceProduct[] | null>(null);
  const [orders, setOrders] = useState<CommerceOrder[] | null>(null);
  const [manageable, setManageable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offlineSavedAt, setOfflineSavedAt] = useState<number | null>(null);

  const [editing, setEditing] = useState<CommerceProduct | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [inventory, setInventory] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        readCachedOrFetch(
          offlineCache,
          offlineScope,
          "commerce:products",
          () => commerce.products.list(),
          parseProductList,
        ).catch(() => null),
        readCachedOrFetch(
          offlineCache,
          offlineScope,
          "commerce:orders",
          () => commerce.orders.list(),
          parseOrderList,
        ).catch(() => null),
      ]);
      if (p) {
        setProducts(p.value.products);
        setManageable(p.value.manageable);
      }
      if (o) setOrders(o.value.orders);
      const savedAts = [p, o]
        .map((r) => (r !== null && r.source === "cache" ? r.savedAt : null))
        .filter((n): n is number => n !== null);
      setOfflineSavedAt(savedAts.length > 0 ? Math.min(...savedAts) : null);
      if (!p || !o) setError("The catalog could not be loaded.");
      else setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The catalog could not be loaded.");
    }
  }, [commerce, offlineCache, offlineScope]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      setBusy(true);
      setError(null);
      setMessage(null);
      try {
        await fn();
        setMessage(ok);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "The action failed.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const resetForm = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setPrice("");
    setCurrency("");
    setInventory("");
  };

  const startEdit = (product: CommerceProduct) => {
    setEditing(product);
    setName(product.name);
    setSlug(product.slug);
    setPrice((product.priceCents / 100).toFixed(2));
    setCurrency(product.currency);
    setInventory(product.inventory === null ? "" : String(product.inventory));
  };

  const submitProduct = () =>
    void run(
      async () => {
        // Full-form replace server-side: hidden fields ride along so an
        // edit does not silently clear description/imageUrl.
        const fields = {
          currency: currency.trim(),
          description: editing?.description ?? "",
          imageUrl: editing?.imageUrl ?? "",
          inventory: inventory.trim(),
          name: name.trim(),
          price: price.trim(),
          slug: slug.trim(),
        };
        if (editing === null) {
          await commerce.products.create(fields);
        } else {
          await commerce.products.update(editing.id, fields);
        }
        resetForm();
      },
      editing === null ? "Product created as a draft." : "Product saved.",
    );

  const advanceOrder = (order: CommerceOrder, status: CommerceOrderStatus) =>
    void run(() => commerce.orders.setStatus(order.id, status), `Order marked ${status}.`);

  return (
    <Screen>
      <H1>Commerce</H1>
      {offlineSavedAt !== null ? <OfflineNotice savedAt={offlineSavedAt} /> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["products", "orders"] as const).map((p) => (
          <AppButton
            key={p}
            label={{ orders: "Orders", products: "Products" }[p]}
            onPress={() => setPane(p)}
            variant={pane === p ? "primary" : "outline"}
          />
        ))}
      </View>

      {pane === "products" ? (
        <>
          {manageable ? (
            <Card>
              <SectionLabel>
                {editing === null ? "New product" : `Editing “${editing.name}”`}
              </SectionLabel>
              <FieldLabel>Name</FieldLabel>
              <AppInput onChangeText={setName} placeholder="Sample product" value={name} />
              <FieldLabel>Slug (blank derives from name)</FieldLabel>
              <AppInput
                autoCapitalize="none"
                onChangeText={setSlug}
                placeholder="sample-product"
                value={slug}
              />
              <FieldLabel>Price (decimal, e.g. 12.99)</FieldLabel>
              <AppInput
                autoCapitalize="none"
                keyboardType="decimal-pad"
                onChangeText={setPrice}
                placeholder="12.99"
                value={price}
              />
              <FieldLabel>Currency (blank = usd)</FieldLabel>
              <AppInput
                autoCapitalize="none"
                onChangeText={setCurrency}
                placeholder="usd"
                value={currency}
              />
              <FieldLabel>Inventory (blank = untracked)</FieldLabel>
              <AppInput
                keyboardType="number-pad"
                onChangeText={setInventory}
                placeholder="0"
                value={inventory}
              />
              <AppButton
                disabled={busy || name.trim() === "" || price.trim() === ""}
                label={editing === null ? "Create product" : "Save changes"}
                onPress={submitProduct}
              />
              {editing !== null ? (
                <AppButton
                  disabled={busy}
                  label="Cancel edit"
                  onPress={resetForm}
                  variant="outline"
                />
              ) : null}
            </Card>
          ) : null}
          <Card>
            <SectionLabel>Products</SectionLabel>
            {products === null && error === null ? <Loading /> : null}
            {products?.length === 0 ? <Detail>No products yet.</Detail> : null}
            {products?.map((product) => (
              <ListRow key={product.id}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Title numberOfLines={1}>{product.name}</Title>
                      <Detail>
                        /{product.slug} · {formatCents(product.priceCents, product.currency)}
                        {product.inventory !== null ? ` · ${product.inventory} in stock` : ""}
                      </Detail>
                    </View>
                    <Badge>{product.status}</Badge>
                  </View>
                  {manageable ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {product.status !== "active" ? (
                        <AppButton
                          disabled={busy}
                          label="Activate"
                          onPress={() =>
                            void run(
                              () => commerce.products.setStatus(product.id, "active"),
                              "Product activated.",
                            )
                          }
                          variant="outline"
                        />
                      ) : (
                        <AppButton
                          disabled={busy}
                          label="Set draft"
                          onPress={() =>
                            void run(
                              () => commerce.products.setStatus(product.id, "draft"),
                              "Product moved to draft.",
                            )
                          }
                          variant="outline"
                        />
                      )}
                      {product.status !== "archived" ? (
                        <AppButton
                          disabled={busy}
                          label="Archive"
                          onPress={() =>
                            void run(
                              () => commerce.products.setStatus(product.id, "archived"),
                              "Product archived.",
                            )
                          }
                          variant="outline"
                        />
                      ) : null}
                      <AppButton
                        disabled={busy}
                        label="Edit"
                        onPress={() => startEdit(product)}
                        variant="outline"
                      />
                    </View>
                  ) : null}
                </View>
              </ListRow>
            ))}
          </Card>
        </>
      ) : null}

      {pane === "orders" ? (
        <Card>
          <SectionLabel>Orders</SectionLabel>
          {orders === null && error === null ? <Loading /> : null}
          {orders?.length === 0 ? <Detail>No orders yet.</Detail> : null}
          {orders?.map((order) => (
            <ListRow key={order.id}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Title numberOfLines={1}>{order.customerEmail}</Title>
                    <Detail>
                      {order.id} · {formatCents(order.totalCents, order.currency)} ·{" "}
                      {new Date(order.createdAt).toLocaleDateString()}
                    </Detail>
                    {order.items.length > 0 ? (
                      <Detail>
                        {order.items
                          .map((item) => `${item.quantity}× ${item.productName}`)
                          .join(", ")}
                      </Detail>
                    ) : null}
                  </View>
                  <Badge>{order.status}</Badge>
                </View>
                {manageable && allowedOrderTransitions(order.status).length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {allowedOrderTransitions(order.status).map((status) => (
                      <AppButton
                        key={status}
                        disabled={busy}
                        label={ORDER_STATUS_LABELS[status] ?? status}
                        onPress={() => advanceOrder(order, status)}
                        variant="outline"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </ListRow>
          ))}
        </Card>
      ) : null}

      {message ? <Text style={styles.detail}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
