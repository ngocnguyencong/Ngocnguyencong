"use client";
import type { ReactNode } from "react";
import { marketingThemeAttrs } from "../theme/marketing-theme";
export function HomeShell({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={className} data-ready="true" {...marketingThemeAttrs()}>
      {children}
    </div>
  );
}
