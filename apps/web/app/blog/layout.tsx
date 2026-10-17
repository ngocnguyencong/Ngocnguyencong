import type { ReactNode } from "react";
import { ResourceShell } from "../../src/resources/resource-shell";
export default function BlogLayout({ children }: { children: ReactNode }) {
  return <ResourceShell active="blog">{children}</ResourceShell>;
}
