import type { ReactNode } from "react";
import { ResourceShell } from "../../src/resources/resource-shell";

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <ResourceShell active="pricing">{children}</ResourceShell>;
}
