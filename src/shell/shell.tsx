"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/design-system/i18n/locale-provider";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { adminNavItems, userNavItems } from "./nav-config";

export function Shell({
  variant,
  homeHref,
  children,
}: {
  variant: "user" | "admin";
  homeHref: string;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const navItems = variant === "admin" ? adminNavItems : userNavItems;
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
      />
      <div className="flex flex-1">
        <Sidebar items={navItems} />
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <MobileNav items={navItems} title={spaceLabel} />
    </div>
  );
}
