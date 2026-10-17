import type { ReactNode } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  CreditCard,
  FileText,
  ShoppingBag,
  Lightbulb,
  Settings,
  UserRound,
  CircleHelp,
  Mail,
  Bell,
  Code,
  ListChecks,
} from "lucide-react";
import { ShellNavigation } from "./shell-navigation";
import { AppearanceSync } from "./theme/appearance-sync";
import { copyForLocale } from "./ui/ui-copy";
import { localePath, type AppLocale } from "@supastack/i18n";
import { AdminNavLink, AnnouncementBanner, ImpersonationBanner } from "./admin-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

/** White-label brand resolved per request host (custom domains), else default. */
export interface ChromeBrand {
  logoUrl: string | null;
  name: string;
}

export function AppBrand({
  locale,
  logo,
  name = "supastack",
}: {
  locale?: AppLocale | undefined;
  logo?: string | null | undefined;
  name?: string | undefined;
} = {}) {
  const homeHref = locale && locale !== "en" ? localePath(locale, "/") : "/";
  return (
    <a className="app-brand brand" href={homeHref} aria-label={`${name} home`}>
      {logo && (
        <img
          src={logo}
          alt={`${name} logo`}
          className="app-brand-logo"
          style={{ width: "22px", height: "22px", borderRadius: "4px", objectFit: "cover" }}
        />
      )}
      <span>{name}</span>
    </a>
  );
}

export function AppIcon({ name }: { name: string }) {
  const Icon =
    (
      {
        Dashboard: LayoutDashboard,
        Chat: MessageSquare,
        "AI task": Sparkles,
        Billing: CreditCard,
        Content: FileText,
        Commerce: ShoppingBag,
        Feedback: Lightbulb,
        Settings,
        Account: UserRound,
        Documentation: CircleHelp,
        "Mail preview": Mail,
        Notifications: Bell,
        OpenAPI: Code,
        Onboarding: ListChecks,
      } as Record<string, typeof LayoutDashboard>
    )[name] ?? CircleHelp;
  return <Icon className="app-nav-icon" aria-hidden="true" size={18} strokeWidth={1.5} />;
}

export type WorkspaceNavItem =
  "Dashboard" | "Chat" | "AI task" | "Content" | "Commerce" | "Feedback" | "Billing" | "Settings";

export function WorkspaceShell({
  active,
  brand,
  workspaceLabel = "Personal account",
  workspaceLogo,
  children,
  locale,
}: {
  active: WorkspaceNavItem;
  /** White-label brand for the request host; an explicit workspaceLogo wins. */
  brand?: ChromeBrand | undefined;
  workspaceLabel?: string | undefined;
  workspaceLogo?: string | null | undefined;
  children: ReactNode;
  locale?: AppLocale | undefined;
}) {
  const copy = copyForLocale(locale).chrome;
  const settingsHref = locale && locale !== "en" ? localePath(locale, "/settings") : "/settings";
  const appearanceHref =
    locale && locale !== "en" ? localePath(locale, "/settings/appearance") : "/settings/appearance";
  const notificationsHref =
    locale && locale !== "en"
      ? localePath(locale, "/settings/notifications")
      : "/settings/notifications";

  return (
    <div className="token-root app-theme">
      <AppearanceSync />
      <ImpersonationBanner />
      <AnnouncementBanner />
      <ShellNavigation
        locale={locale}
        brand={
          <AppBrand locale={locale} logo={workspaceLogo ?? brand?.logoUrl} name={brand?.name} />
        }
        sidebar={
          <>
            <WorkspaceSwitcher
              fallbackLabel={workspaceLabel}
              fallbackLogo={workspaceLogo}
              locale={locale}
            />
            <nav className="primary-navigation" aria-label={copy.workspaceNavigation}>
              {(
                [
                  ["Dashboard", "/dashboard"],
                  ["Chat", "/chat"],
                  ["AI task", "/ai"],
                  ["Content", "/content"],
                  ["Commerce", "/commerce"],
                  ["Feedback", "/feedback"],
                  ["Billing", "/billing"],
                  ["Settings", "/settings"],
                ] as const
              ).map(([name, href]) => {
                const target = locale && locale !== "en" ? localePath(locale, href) : href;
                return (
                  <a
                    key={name}
                    href={target}
                    aria-label={copy.nav[name]}
                    data-label={copy.nav[name]}
                    className={`nav-item ${active === name ? "nav-item-active" : ""}`}
                    aria-current={active === name ? "page" : undefined}
                  >
                    <AppIcon name={name} />
                    <span className="nav-label">{copy.nav[name]}</span>
                  </a>
                );
              })}
              <AdminNavLink />
            </nav>
            <div className="app-rail-footer">
              <a href="/onboarding" aria-label={copy.onboarding} data-label={copy.onboarding}>
                <AppIcon name="Onboarding" />
                <span className="nav-label">{copy.onboarding}</span>
              </a>
              <a href="/docs" aria-label={copy.documentation} data-label={copy.documentation}>
                <AppIcon name="Documentation" />
                <span className="nav-label">{copy.documentation}</span>
              </a>
              <a href="/auth" aria-label={copy.account} data-label={copy.account}>
                <AppIcon name="Account" />
                <span className="nav-label">{copy.account}</span>
              </a>
              <a href="/api/docs" aria-label={copy.openApi} data-label={copy.openApi}>
                <AppIcon name="OpenAPI" />
                <span className="nav-label">{copy.openApi}</span>
              </a>
              <a href="/mail-preview" aria-label={copy.mailPreview} data-label={copy.mailPreview}>
                <AppIcon name="Mail preview" />
                <span className="nav-label">{copy.mailPreview}</span>
              </a>
              <a
                href={notificationsHref}
                aria-label={copy.notifications}
                data-label={copy.notifications}
              >
                <AppIcon name="Notifications" />
                <span className="nav-label">{copy.notifications}</span>
              </a>
            </div>
            <div className="app-rail-account">
              <UserMenu locale={locale} />
            </div>
          </>
        }
      >
        <main className="main-panel">
          <div className="main-header">
            <span>{copy.nav[active]}</span>
            <div className="main-header-actions">
              <a className="mobile-shell-settings" href={settingsHref}>
                {copy.settings}
              </a>
              <a className="mobile-shell-appearance" href={appearanceHref}>
                {copy.appearance}
              </a>
              <NotificationBell notificationsHref={notificationsHref} locale={locale} />
              <a href="/docs">{copy.help}</a>
            </div>
          </div>
          <div className="account-content">{children}</div>
        </main>
      </ShellNavigation>
    </div>
  );
}
