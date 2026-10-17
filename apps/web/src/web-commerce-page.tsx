"use client";

import { Select } from "./ui/primitives";
import type { AppLocale } from "@supastack/i18n";
import { useState, type FormEvent } from "react";

import { WorkspaceShell, type ChromeBrand } from "./app-chrome";
import {
  createCommerceOrderAction,
  createCommerceProductAction,
  setCommerceOrderStatusAction,
  setCommerceProductStatusAction,
  updateCommerceProductAction,
  type CommerceOrderRow,
  type CommerceProductRow,
} from "./commerce-actions";
import { allowedOrderTransitions, formatCents } from "./commerce";

const ORDER_STATUS_LABELS: Record<string, string> = {
  cancelled: "Cancel",
  fulfilled: "Mark fulfilled",
  paid: "Mark paid",
  refunded: "Refund",
};

function formatDate(value: Date | string | null): string {
  if (value === null) {
    return "—";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function WebCommercePage({
  brand,
  locale,
  orders,
  products,
  productsError,
  ordersError,
  manageable,
}: Readonly<{
  brand?: ChromeBrand | undefined;
  locale?: AppLocale | undefined;
  manageable: boolean;
  orders: CommerceOrderRow[];
  ordersError?: string | undefined;
  products: CommerceProductRow[];
  productsError?: string | undefined;
}>) {
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<CommerceProductRow | null>(null);
  const [orderLines, setOrderLines] = useState<readonly { productId: string; quantity: number }[]>([
    { productId: "", quantity: 1 },
  ]);

  const activeProducts = products.filter((product) => product.status === "active");

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    setPending(true);
    setFormMessage(null);
    try {
      const payload = {
        currency: text("currency"),
        description: text("description"),
        imageUrl: text("imageUrl"),
        inventory: text("inventory"),
        name: text("name"),
        price: text("price"),
        slug: text("slug"),
      };
      const result = editing
        ? await updateCommerceProductAction({ ...payload, productId: editing.id })
        : await createCommerceProductAction(payload);
      if (result.ok) {
        setEditing(null);
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const customerEmail = data.get("customerEmail");
    setPending(true);
    setFormMessage(null);
    try {
      const result = await createCommerceOrderAction({
        customerEmail: typeof customerEmail === "string" ? customerEmail : "",
        items: orderLines.filter((line) => line.productId !== ""),
      });
      if (result.ok) {
        setOrderLines([{ productId: "", quantity: 1 }]);
        form.reset();
      } else {
        setFormMessage(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <WorkspaceShell active="Commerce" brand={brand} locale={locale}>
      <div className="auth-card">
        <div className="auth-heading">
          <h1>Commerce</h1>
          <p>
            Workspace-scoped product catalog and order management. Orders compute totals server-side
            from active products; tracked inventory decrements on purchase and restocks on cancel.
          </p>
        </div>

        {!manageable ? <p role="status">{productsError ?? ordersError}</p> : null}

        <h3>Products</h3>
        {products.length === 0 ? (
          <p>No products yet.</p>
        ) : (
          <ul className="notification-list" aria-label="Products">
            {products.map((product) => (
              <li key={product.id}>
                <strong>{product.name}</strong>{" "}
                <span className="status-badge">{product.status}</span>
                <br />
                <span className="quiet-note">
                  {product.slug} · {formatCents(product.priceCents, product.currency)}
                  {product.inventory !== null
                    ? ` · ${product.inventory} in stock`
                    : " · untracked stock"}
                </span>
                {manageable ? (
                  <>
                    {" "}
                    <button
                      className="button button-secondary"
                      onClick={() => setEditing(product)}
                      type="button"
                    >
                      Edit
                    </button>{" "}
                    {product.status !== "active" ? (
                      <form action={setCommerceProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="active" />
                        <button className="button button-secondary" type="submit">
                          Activate
                        </button>
                      </form>
                    ) : null}{" "}
                    {product.status === "active" ? (
                      <form action={setCommerceProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="draft" />
                        <button className="button button-secondary" type="submit">
                          Unpublish
                        </button>
                      </form>
                    ) : null}{" "}
                    {product.status !== "archived" ? (
                      <form action={setCommerceProductStatusAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="status" value="archived" />
                        <button className="button button-secondary" type="submit">
                          Archive
                        </button>
                      </form>
                    ) : null}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {manageable ? (
          <form className="auth-form" onSubmit={(event) => void submitProduct(event)}>
            <h3>{editing === null ? "New product" : `Editing “${editing.name}”`}</h3>
            <label htmlFor="product-name">Name</label>
            <input
              defaultValue={editing?.name ?? ""}
              disabled={pending}
              id="product-name"
              maxLength={200}
              name="name"
              required
            />
            <label htmlFor="product-slug">Slug (blank derives from name)</label>
            <input
              defaultValue={editing?.slug ?? ""}
              disabled={pending}
              id="product-slug"
              maxLength={120}
              name="slug"
            />
            <label htmlFor="product-price">Price</label>
            <input
              defaultValue={editing === null ? "" : (editing.priceCents / 100).toFixed(2)}
              disabled={pending}
              id="product-price"
              inputMode="decimal"
              name="price"
              placeholder="19.99"
              required
            />
            <label htmlFor="product-currency">Currency</label>
            <input
              defaultValue={editing?.currency ?? "usd"}
              disabled={pending}
              id="product-currency"
              maxLength={3}
              minLength={3}
              name="currency"
            />
            <label htmlFor="product-inventory">Inventory (blank = untracked)</label>
            <input
              defaultValue={editing?.inventory ?? ""}
              disabled={pending}
              id="product-inventory"
              inputMode="numeric"
              name="inventory"
            />
            <label htmlFor="product-image">Image URL</label>
            <input
              defaultValue={editing?.imageUrl ?? ""}
              disabled={pending}
              id="product-image"
              name="imageUrl"
              type="url"
            />
            <label htmlFor="product-description">Description</label>
            <textarea
              defaultValue={editing?.description ?? ""}
              disabled={pending}
              id="product-description"
              key={editing?.id ?? "new"}
              name="description"
              rows={3}
            />
            <button className="button button-primary" disabled={pending} type="submit">
              {editing === null ? "Create product" : "Save changes"}
            </button>
            {editing !== null ? (
              <button
                className="button button-secondary"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancel edit
              </button>
            ) : null}
          </form>
        ) : null}

        <h3>Orders</h3>
        {orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <ul className="notification-list" aria-label="Orders">
            {orders.map((order) => (
              <li key={order.id}>
                <strong>{order.customerEmail}</strong>{" "}
                <span className="status-badge">{order.status}</span>
                <br />
                <span className="quiet-note">
                  {formatCents(order.totalCents, order.currency)} · {order.items.length} item
                  {order.items.length === 1 ? "" : "s"} · {formatDate(order.createdAt)}
                </span>
                <ul aria-label={`Items for order ${order.id}`}>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.productName} (
                      {formatCents(item.unitPriceCents, order.currency)})
                    </li>
                  ))}
                </ul>
                {manageable
                  ? allowedOrderTransitions(order.status).map((status) => (
                      <form action={setCommerceOrderStatusAction} key={status}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="status" value={status} />
                        <button className="button button-secondary" type="submit">
                          {ORDER_STATUS_LABELS[status] ?? status}
                        </button>
                      </form>
                    ))
                  : null}
              </li>
            ))}
          </ul>
        )}

        {manageable ? (
          <form className="auth-form" onSubmit={(event) => void submitOrder(event)}>
            <h3>Record order</h3>
            <p className="quiet-note">
              Totals are computed from catalog prices — draft/archived products and oversells are
              rejected.
            </p>
            <label htmlFor="order-email">Customer email</label>
            <input
              disabled={pending}
              id="order-email"
              name="customerEmail"
              placeholder="buyer@example.com"
              required
              type="email"
            />
            <fieldset>
              <legend>Line items</legend>
              {orderLines.map((line, index) => (
                <div key={index}>
                  <Select
                    aria-label={`Product for line ${index + 1}`}
                    disabled={pending}
                    onChange={(event) =>
                      setOrderLines((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, productId: event.target.value } : entry,
                        ),
                      )
                    }
                    value={line.productId}
                  >
                    <option value="">Choose a product…</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {formatCents(product.priceCents, product.currency)}
                      </option>
                    ))}
                  </Select>{" "}
                  <input
                    aria-label={`Quantity for line ${index + 1}`}
                    disabled={pending}
                    inputMode="numeric"
                    min={1}
                    onChange={(event) =>
                      setOrderLines((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, quantity: Number(event.target.value) } : entry,
                        ),
                      )
                    }
                    type="number"
                    value={line.quantity}
                  />{" "}
                  {orderLines.length > 1 ? (
                    <button
                      className="button button-secondary"
                      onClick={() =>
                        setOrderLines((current) => current.filter((_entry, i) => i !== index))
                      }
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                className="button button-secondary"
                onClick={() =>
                  setOrderLines((current) => [...current, { productId: "", quantity: 1 }])
                }
                type="button"
              >
                Add line
              </button>
            </fieldset>
            <button className="button button-primary" disabled={pending} type="submit">
              Record order
            </button>
          </form>
        ) : null}

        {formMessage !== null ? <p role="alert">{formMessage}</p> : null}
      </div>
    </WorkspaceShell>
  );
}
