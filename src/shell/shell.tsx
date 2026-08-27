"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";
import type { Permission } from "@/domains/rbac/types";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { adminNavItems, userNavItems } from "./nav-config";

type NotificationRow = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "title" | "body" | "read_at" | "created_at"
>;

export function Shell({
  variant,
  homeHref,
  userDisplayName,
  notifications,
  permissions,
  children,
}: {
  variant: "user" | "admin";
  homeHref: string;
  userDisplayName?: string | null;
  notifications?: NotificationRow[];
  /** Prompt 23 — filtre les items admin (cosmétique : l'accès réel est gardé côté serveur sur chaque page/action). */
  permissions?: Permission[];
  children: ReactNode;
}) {
  const { t } = useLocale();
  const allNavItems = variant === "admin" ? adminNavItems : userNavItems;
  const navItems =
    variant === "admin" && permissions
      ? allNavItems.filter((item) => !item.permission || permissions.includes(item.permission))
      : allNavItems;
  const spaceLabel = variant === "admin" ? t("shell.backOffice") : t("shell.userApp");

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        homeHref={homeHref}
        spaceLabel={spaceLabel}
        brandName={t("brand.name")}
        lightLabel={t("theme.light")}
        darkLabel={t("theme.dark")}
        variant={variant}
        userDisplayName={userDisplayName}
        notifications={notifications}
      />
      <div className="flex flex-1">
        <Sidebar items={navItems} />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <MobileNav items={navItems} title={spaceLabel} />
    </div>
  );
}
