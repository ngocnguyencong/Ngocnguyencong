import { parsePublicConfig, parseServerConfig } from "@supastack/config";

export const dynamic = "force-dynamic";

import { WorkspaceShell } from "../../src/app-chrome";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import {
  productPlanPriceMapFromEnv,
  PRODUCT_PLANS,
  type ProductPlanId,
} from "../../src/product-plans";

export default async function ChoosePlanPage() {
  const serverConfig = parseServerConfig();
  const publicConfig = parsePublicConfig(serverConfig);
  const priceMap = productPlanPriceMapFromEnv(process.env);
  const configured = new Set(Object.keys(priceMap) as ProductPlanId[]);
  const stripeEnabled = publicConfig.providers.billing === "stripe";
  const brand = await getRequestBrand();

  return (
    <WorkspaceShell active="Billing" brand={brand}>
      <div className="auth-card auth-form">
        <h1>Choose a plan</h1>
        <p>
          Onboarding gate for product SaaS plans. Checkout stays on <a href="/billing">/billing</a>{" "}
          so price IDs never leave the server.
        </p>
        <ul className="plan-catalog">
          {PRODUCT_PLANS.map((plan) => (
            <li
              key={plan.id}
              className="plan-catalog-item"
              data-recommended={plan.recommended ? "true" : "false"}
            >
              <strong>{plan.name}</strong> — {plan.priceLabel}
              {plan.trialDays ? ` · ${plan.trialDays}-day trial` : ""}
              {plan.seatsIncluded ? ` · ${plan.seatsIncluded} seats` : ""}
              {plan.checkout === "stripe"
                ? stripeEnabled && configured.has(plan.id)
                  ? " · Checkout ready"
                  : " · price not configured"
                : plan.checkout === "sales"
                  ? " · sales-assisted"
                  : " · no Checkout"}
            </li>
          ))}
        </ul>
        <a className="button button-primary" href="/billing">
          Continue to product plans
        </a>
        <a href="/select-organization">Select workspace</a>
        <a href="/onboarding">Back to onboarding</a>
      </div>
    </WorkspaceShell>
  );
}
