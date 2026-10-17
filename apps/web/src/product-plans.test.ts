import { describe, expect, it } from "vitest";

import {
  getProductPlan,
  productPlanPriceMapFromEnv,
  resolveProductCheckout,
  PRODUCT_PLANS,
} from "./product-plans.js";

describe("product plans catalog", () => {
  it("exposes Free/Pro/Lifetime/Enterprise like the demo product catalog", () => {
    expect(PRODUCT_PLANS.map((plan) => plan.id)).toEqual(["free", "pro", "lifetime", "enterprise"]);
    expect(getProductPlan("pro")?.recommended).toBe(true);
    expect(getProductPlan("pro")?.trialDays).toBe(7);
    expect(getProductPlan("pro")?.seatsIncluded).toBe(5);
  });

  it("maps checkoutable plans to server price ids without trusting browser prices", () => {
    expect(resolveProductCheckout("free", { pro: "price_pro" })).toEqual({
      ok: false,
      reason: "not-checkoutable",
    });
    expect(resolveProductCheckout("enterprise", {})).toEqual({
      ok: false,
      reason: "not-checkoutable",
    });
    expect(resolveProductCheckout("lifetime", { pro: "price_pro" })).toEqual({
      ok: false,
      reason: "price-unconfigured",
    });
    expect(
      resolveProductCheckout("pro", productPlanPriceMapFromEnv({ STRIPE_PRICE_ID: "price_pro" })),
    ).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: null,
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "price_pro",
    });
  });

  it("resolves yearly interval to its own configured price id", () => {
    const prices = productPlanPriceMapFromEnv({
      STRIPE_PRICE_ID: "price_pro_m",
      STRIPE_PRICE_ID_PRO_YEARLY: "price_pro_y",
    });
    expect(resolveProductCheckout("pro", prices, "year")).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: "year",
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "price_pro_y",
    });
    // plans without yearly pricing fall back to unconfigured rather than silently charging monthly
    expect(resolveProductCheckout("lifetime", { pro_yearly: "x" }, "year")).toEqual({
      ok: false,
      reason: "price-unconfigured",
    });
    expect(resolveProductCheckout("pro", { pro: "price_pro_m" }, "year")).toEqual({
      ok: false,
      reason: "price-unconfigured",
    });
  });

  it("maps CREEM_PRODUCT_ID_* envs to plan prices when the provider is creem", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        CREEM_PRODUCT_ID: "prod_pro_m",
        CREEM_PRODUCT_ID_PRO_YEARLY: "prod_pro_y",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "creem",
    );
    expect(prices).toEqual({ pro: "prod_pro_m", pro_yearly: "prod_pro_y" });
    expect(resolveProductCheckout("pro", prices, "year")).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: "year",
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "prod_pro_y",
    });
  });

  it("maps POLAR_PRODUCT_ID_* envs to plan prices when the provider is polar", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        POLAR_PRODUCT_ID: "polar_pro_m",
        POLAR_PRODUCT_ID_PRO_YEARLY: "polar_pro_y",
        POLAR_PRODUCT_ID_LIFETIME: "polar_lifetime",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "polar",
    );
    expect(prices).toEqual({
      lifetime: "polar_lifetime",
      pro: "polar_pro_m",
      pro_yearly: "polar_pro_y",
    });
    expect(resolveProductCheckout("lifetime", prices)).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: null,
      plan: expect.objectContaining({ id: "lifetime" }),
      priceId: "polar_lifetime",
    });
  });

  it("maps WHOP_PLAN_ID_* envs to plan prices when the provider is whop", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        WHOP_PLAN_ID: "plan_pro_m",
        WHOP_PLAN_ID_PRO_YEARLY: "plan_pro_y",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "whop",
    );
    expect(prices).toEqual({ pro: "plan_pro_m", pro_yearly: "plan_pro_y" });
    expect(resolveProductCheckout("pro", prices)).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: null,
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "plan_pro_m",
    });
  });

  it("maps PADDLE_PRICE_ID_* envs to plan prices when the provider is paddle", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        PADDLE_PRICE_ID: "pri_pro_m",
        PADDLE_PRICE_ID_PRO_YEARLY: "pri_pro_y",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "paddle",
    );
    expect(prices).toEqual({ pro: "pri_pro_m", pro_yearly: "pri_pro_y" });
    expect(resolveProductCheckout("pro", prices, "year")).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: "year",
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "pri_pro_y",
    });
  });

  it("maps DODO_PRODUCT_ID_* envs to plan prices when the provider is dodo", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        DODO_PRODUCT_ID: "pdt_pro_m",
        DODO_PRODUCT_ID_LIFETIME: "pdt_lifetime",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "dodo",
    );
    expect(prices).toEqual({ lifetime: "pdt_lifetime", pro: "pdt_pro_m" });
    expect(resolveProductCheckout("lifetime", prices)).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: null,
      plan: expect.objectContaining({ id: "lifetime" }),
      priceId: "pdt_lifetime",
    });
  });

  it("maps PAYPAL_PLAN_ID_* envs to plan prices when the provider is paypal", () => {
    const prices = productPlanPriceMapFromEnv(
      {
        PAYPAL_PLAN_ID: "P-pro_m",
        PAYPAL_PLAN_ID_PRO_YEARLY: "P-pro_y",
        STRIPE_PRICE_ID: "price_ignored",
      },
      "paypal",
    );
    expect(prices).toEqual({ pro: "P-pro_m", pro_yearly: "P-pro_y" });
    expect(resolveProductCheckout("pro", prices)).toEqual({
      ok: true,
      entitlement: "ai.reference-task",
      interval: null,
      plan: expect.objectContaining({ id: "pro" }),
      priceId: "P-pro_m",
    });
  });
});
