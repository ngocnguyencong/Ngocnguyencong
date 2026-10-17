import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { getAdminSession } from "../../src/admin-actions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  if (session === null) {
    notFound();
  }
  return <>{children}</>;
}
